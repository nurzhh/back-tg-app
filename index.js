require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

app.use(express.json());
app.use(cors());

const WEB_APP_URL = process.env.WEB_APP_URL;

// 📌 1. Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    await bot.sendMessage(
        chatId,
        "Привет! Это Telegram Mini App. Нажми кнопку, чтобы пройти профориентационный тест.",
        {
            reply_markup: {
                keyboard: [[{ text: "Пройти тест", web_app: { url: `${WEB_APP_URL}/test` } }]],
                resize_keyboard: true,
            },
        }
    );
});

// 📌 2. Обработчик полученных данных из Mini App
bot.on("web_app_data", async (msg) => {
    const chatId = msg.chat.id;

    try {
        const data = JSON.parse(msg.web_app_data.data);

        // Отправляем данные на сервер для анализа
        const response = await axios.post("http://localhost:8000/api/analyze", {
            answers: data.answers,
        });

        const { result } = response.data;

        // Отправляем пользователю результат
        await bot.sendMessage(
            chatId,
            `🎯 **Твой результат:**\n\n📌 **Направление:** ${result.direction}\n🔢 **Процент соответствия:**\n- Frontend: ${result.scores.frontend}%\n- Backend: ${result.scores.backend}%\n- Gamedev: ${result.scores.gamedev}%\n- Design: ${result.scores.design}%\n\n📌 **Почему тебе подходит это направление:**\n${result.analysis}`
        );
    } catch (error) {
        console.error(error);
        await bot.sendMessage(chatId, "❌ Ошибка анализа. Попробуй снова позже.");
    }
});

// 📌 3. API для обработки ответов и запроса к Groq API
app.post("/api/analyze", async (req, res) => {
    try {
        const { answers } = req.body;

        // Отправляем запрос в Groq API
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "gemma2-9b-it",
                messages: [
                    {
                        role: "system",
                        content:
                            "Ты эксперт по профориентации в IT. Тебе будут передаваться только *ответы пользователя* без самих вопросов. 💡 *Твоя задача*: 1. На основе ответов определи *наиболее подходящее направление* (frontend, backend, gamedev, design). 2. Выдай процентное соответствие *по каждому направлению*. 3. Объясни выбор *в 4-5 предложениях*. 🔹 *Направления*: - *Frontend* – если пользователь любит UI, дизайн, взаимодействие с пользователем. - *Backend* – если он любит базы данных, логику, серверную часть. - *Gamedev* – если ему интересны игры, физика, графика. - *Design* – если он больше тяготеет к UX/UI, визуальному мышлению. 📌 *Формат ответа* – JSON: {'direction': 'Backend', 'scores': {'frontend': 30, 'backend': 85, 'gamedev': 50, 'design': 20}, 'analysis': 'Ты предпочитаешь решать сложные логические задачи, работать с данными и оптимизировать производительность систем. Это делает тебя идеальным кандидатом для Backend-разработки. Твой стиль работы подходит для долгосрочных проектов, где важна надежность и масштабируемость решений. Если тебе интересна кибербезопасность, backend также является хорошим выбором.'} Вопросы: 'Что вам больше нравится: создавать визуальные элементы или работать с данными?' 'Вы предпочитаете работать самостоятельно или в команде?' 'Вас больше интересует дизайн или функциональность?' 'Вы любите решать сложные логические задачи?' 'Вам нравится изучать новые языки программирования?' 'Вы предпочитаете работать над долгосрочными или краткосрочными проектами?' 'Вас интересует оптимизация производительности систем?' 'Вы любите анализировать большие объемы данных?' 'Вам нравится создавать пользовательские интерфейсы?' 'Вы интересуетесь кибербезопасностью?' ❗ *Отвечай только JSON без дополнительного текста.*",
                    },
                    {
                        role: "user",
                        content: `Ответы пользователя: ${answers.join(", ")}`,
                    },
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const result = response.data.choices[0].message.content;
        const parsedResult = parseGroqResult(result);

        res.json({ result: parsedResult });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Ошибка обработки ответа" });
    }
});

// 📌 4. Функция парсинга ответа от нейросети
function parseGroqResult(responseText) {
    const directionMatch = responseText.match(/📌 Направление: (.*)/);
    const scoresMatch = responseText.match(/🔢 Процент соответствия:(.*)/s);
    const analysisMatch = responseText.match(/📌 Почему тебе подходит это направление:(.*)/s);

    return {
        direction: directionMatch ? directionMatch[1] : "Не определено",
        scores: {
            frontend: extractPercentage(responseText, "Frontend"),
            backend: extractPercentage(responseText, "Backend"),
            gamedev: extractPercentage(responseText, "Gamedev"),
            design: extractPercentage(responseText, "Design"),
        },
        analysis: analysisMatch ? analysisMatch[1].trim() : "Нет данных",
    };
}

// 📌 5. Вспомогательная функция для извлечения процента
function extractPercentage(text, label) {
    const match = text.match(new RegExp(`${label}: (\\d+)%`));
    return match ? parseInt(match[1], 10) : 0;
}

// 📌 6. Запуск сервера
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
