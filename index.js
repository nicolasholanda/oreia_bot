require('dotenv').config()
const { OpenAI } = require('openai')
const { Client, LocalAuth, MessageMedia, MessageTypes } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal')
const axios = require('axios')
const {readEnv} = require("openai/core");


const openai = new OpenAI()
openai.baseURL = 'https://zukijourney.xyzbot.net/v1'

const commands = [
    {'id': '.menu', 'descricao': 'Ver comandos'},
    {'id': '.sticker', 'descricao': 'Gerar figurinha da imagem/vídeo/gif anexado'},
    {'id': '.audio <descrição>', 'descricao': 'Gerar áudio do texto'},
    {'id': '.sticker <link>', 'descricao': 'Gerar figurinha da imagem do link'},
    {'id': '.sticker <descrição da imagem>', 'descricao': 'Gerar imagem por IA'},
]

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('authenticated', () => {
    console.log('Client is authenticated!');
});


client.on('message_create', msg => {
    const command = msg.body.split(' ')[0];
    if(command.startsWith('.') && !msg.fromMe) {
        handleMessage(command, msg);
    }
});

client.on('group_join', notification => {
    let grouṕId = notification.chatId;
    let greetingMsg = '*Oreia BOT 🐵*\n\n\n' + createMenuStr();
    client.sendMessage(grouṕId, greetingMsg);
});

const handleMessage = (command, msg) => {
    if (command === ".sticker") {
        generateSticker(msg)
    } else if(command === '.menu') {
        showMenu(msg)
    } else {
        msg.reply('🧐 Não entendi. Digita .menu pra ver os comandos.')
    }
}

const showMenu = (msg) => {
    msg.reply(createMenuStr())
}

const createMenuStr = () => {
    const title = '*COMANDOS*\n\n';
    return title + commands.map(c => '♦️ *' + c.id + '* ~> ' + c.descricao).join('\n\n')
}

const getMediaFromText = async (msg) => {
    const msgContent = msg.body.substring(msg.body.indexOf(" ")).trim();
    return isLink(msgContent) ? getMediaFromLink(msgContent) : getMediaFromGpt(msgContent)
}

const getMediaFromGpt = async (msgContent) => {
    const gptResponse = await openai.images.generate({
        user: 'oreiabot',
        size: '256x256',
        quality: 'standard',
        model: 'dall-e-3',
        prompt: msgContent,
        n: 1,
        response_format: 'b64_json'
    })

    if(!gptResponse || !gptResponse.data) {
        throw new Error("Prompt inválido para o GPT")
    }

    const imgUrl = gptResponse.data[0].url

    return getMediaFromLink(imgUrl)
}

const getMediaFromLink = async (msgContent) => {
    const url = msgContent.substring(msgContent.indexOf(" ")).trim()
    const { data } = await axios.get(url, {responseType: 'arraybuffer', headers: {'Authorization': 'Bearer ' + readEnv('OPENAI_API_KEY')}})
    const returnedB64 = Buffer.from(data).toString('base64');
    return new MessageMedia("image/jpeg", returnedB64, "image.jpg")
}

const getMediaFromImage = async (msg) => {
    const { data } = await msg.downloadMedia()
    return new MessageMedia("image/jpeg", data, "image.jpg");
}

const getMediaFromVideo = async (msg) => {
    const { data } = await msg.downloadMedia()
    return new MessageMedia("video/mp4", data, "video.mp4");
}

const mediaFunctionMap = [
    {'msgType': MessageTypes.IMAGE, 'handler': getMediaFromImage},
    {'msgType': MessageTypes.VIDEO, 'handler': getMediaFromVideo},
    {'msgType': MessageTypes.TEXT, 'handler': getMediaFromText}
]

const isLink = (str) => {
    const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].\S*$/i;
    return urlRegex.test(str);
}

const generateSticker = async (msg) => {
    const sender = msg.from
    const msgOptions = { sendMediaAsSticker: true, stickerAuthor: 'OreiaBOT🐵'}

    msg.reply("🕘 Na hora, autoridade. Já já eu mando.")

    const mediaHandler = mediaFunctionMap.find(mediaFunction => mediaFunction.msgType === msg.type)

    if(!mediaHandler) {
        msg.reply('❌ Tipo de mensagem inválida pra gerar sticker.')
        return
    }

    try {
        const media = await mediaHandler.handler(msg)
        await client.sendMessage(sender, media, msgOptions)
    } catch(exception) {
        console.error(exception)
        msg.reply('❌ Erro ao gerar o sticker.')
    }
}

client.initialize();
