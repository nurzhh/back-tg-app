const TelegramBot = require('node-telegram-bot-api');
const express = require('express')
const cors = require('cors')

const token = "7595862197:AAFHA6ow0OGLJmUj33PZk9rw-lT0ZR-e5W8"
const webpAppUrl = 'https://front-tg-react.vercel.app'
const bot = new TelegramBot(token, {polling: true});
const app = express()

app.arguments(express.json());
app.arguments(cors())

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === '/start') {
    await bot.sendMessage(chatId, "Ниже появится кнопка, заполни форму", {
      reply_markup: {
        keyboard: [
          [{text: 'Заполнить форму', web_app: {url: webpAppUrl + '/form'}}]  
        ]
      }
    }); 

    await bot.sendMessage(chatId, "Вход в интернет магазин", {
      reply_markup: {
        inline_keyboard: [
          [{text: 'Сделать заказ', web_app: {url: webpAppUrl}}]  
        ]
      }

    }); 
  }
  if (msg?.web_app_data?.data) {
    try {
      const data = JSON.parse(msg.web_app_data?.data);
      await bot.sendMessage(chatId, 'Спасибо за обратную связь!')
      await bot.sendMessage(chatId, 'Ваша страна' + data.country)
      await bot.sendMessage(chatId, 'Ваша страна' + data?.city)
      
      setTimeout( async () => {
        await bot.sendMessage(chatId, 'Всю информацию вы получите в этом чате')
      }, [3000])
    } catch (e) {
      console.log(e)
    }
  }
});

app.post('/web-data', async (req, res) => {
  const {queryId, products = [], totalPrice} = req.body;
  try {
      await bot.answerWebAppQuery(queryId, {
          type: 'article',
          id: queryId,
          title: 'Успешная покупка',
          input_message_content: {
              message_text: ` Поздравляю с покупкой, вы приобрели товар на сумму ${totalPrice}, ${products.map(item => item.title).join(', ')}`
          }
      })
      return res.status(200).json({});
  } catch (e) {
      return res.status(500).json({})
  }
})

const PORT = 8000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
