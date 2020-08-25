// panggil konfigurasi di file .env
require('dotenv').config()
// Panggil library
const TelegramBot = require('node-telegram-bot-api');

// Ngambil collections di Database
const {queue , active_sessions} = require('./config/database')

// Fungsi Helper
const helper = require('./helper/helper')

// Moment buat ngambil tanggal
const moment = require('moment')

// Start Pooling bot
const bot = new TelegramBot(process.env.TELEGRAM_KEY, {polling: true});

// lakukan fungsi di bawah kalo ada pesan ke bot
bot.on('message' , async (msg) => {

    // Kalo pesannya private atau dari user bukan grup
    if(msg.chat.type == 'private'){
        // apakah ada perintah atau cuma text biasa atau gak ada text
        const command = msg.text !== undefined ? msg.text.split(' ')[0] : ''
        // Ngambil id chat
        const { id } = msg.chat
        if(command == '/start'){
            // Pesan Penyambutan :)
            await bot.sendMessage(id , "Selamat Datang di Anonim Chat bot\n bot yang digunakan untuk chatting secara anonim buatan anak KBBD XD")
        }else if(command == '/find'){
            // Fungsi untuk mencari partner
            const isActiveSess = helper.isActiveSession(id , bot)
            // Apakah user sudah punya sesi chatting ?
            if(!isActiveSess) {
                await bot.sendMessage(id , "Kegagalan Server!")
            }

            // Apakah user udah ada di antrian ?
            const isQueue = await queue.find({user_id: id})
            if(!isQueue.length){
                // Kalo gak ada masukin ke antrian
                await queue.insert({user_id: id , timestamp: parseInt(moment().format('X'))})
            }
            // Kirim pesan kalo lagi nyari partner
            bot.sendMessage(id , '<i>Mencari Partner Chat ...</i>' , {parse_mode: 'html'})
            // apakah ada user lain yang dalam antrian ?
            var queueList = await queue.find({user_id: {$not: {$eq: id}}})
            // Selama gak ada user dalam antrian , cari terus boss
            while(queueList.length < 1){
                queueList = await queue.find({user_id: {$not: {$eq: id}}})
            }

            // Nah dah ketemu nih , ambil user id dari partner
            const partnerId = queueList[0].user_id
            // Ini ngamdil data antrian kamu
            const you = await queue.findOne({user_id: id})
            // Ini ngamdil data antrian partner kamu
            const partner = await queue.findOne({user_id: partnerId})

            // Kalo data antrian kamu belum di apus (atau belum di perintah /stop)
            if(you !== null){
                // apakah kamu duluan yang nyari partner atau partnermu
                if(you.timestamp < partner.timestamp){
                    // kalo kamu duluan kamu yang mulai sesi , partner mu cuma numpang
                    await active_sessions.insert({user1: id,user2:partnerId})
                }
                // Hapus data kamu sama partnermu dalam antrian
                for(let i = 0 ;i < 2;++i){
                    const data = await queue.find({user_id: (i > 0 ? partnerId : id)})
                    await queue.remove({id: data.id})
                }

                // Kirim pesan ke kamu kalo udah nemu partner
                await bot.sendMessage(id , "Kamu Menemukan Partner chat\nSegera Kirim Pesan")
            }
        }else if(command == '/stop'){
            // fungsi untuk berhenti mencari partner

            // Ngecek apa kamu ada sesi chatting
            const searchActiveSess = await helper.isActiveSession(id , bot)
            if(searchActiveSess){
                // kalo ada hapus sesi nya
                await bot.sendMessage(id , "Kamu telah berhenti chatting dengan partnermu \n ketik /find untuk mulai mencari partner baru")
            }else if(!searchActiveSess){
                // Kalo gak ada hapus data kamu dalam antrian
                const queueData = await queue.findOne({user_id : id})
                await queue.remove({id: queueData.id})
                await bot.sendMessage(id , "Kamu telah berhenti mencari partner \n ketik /find untuk mulai mencari partner")
            }
        }else{
            // Nah ini buat saling balas-balasan sama partner kamu

            // Cek dulu , kamu ada partner apa enggak
            const isActiveSess = await active_sessions.findOne({$or: [{user1: id} , {user2: id}]})

            if(isActiveSess !== null){
                // Nah kalo ada ambil data sesi chatting nya
                const session = await active_sessions.findOne({$or: [{user1: id} , {user2: id}]})
                const {user1 , user2} = session
                // Ini buat ngamil user id partner kamu
                const target = user1 == id ? user2 : user1

                // Nah ini nih lumayan ribet , pokonya is seleksi lah,
                if(msg.photo !== undefined){
                    // ini kalo kamu kirim poto , nanti di kirim ke partner kamu
                    await bot.sendPhoto(target , msg.photo[2].file_id , {caption: msg.caption !== undefined ? msg.caption : null})  // nah yang caption itu kalo kamu kirim photo pake text , bakal di kirim juga ke partner mu
                }else if(msg.text !== undefined){
                    // ini kalo kamu kirim text , nanti di kirim ke partner kamu
                    await bot.sendMessage(target , msg.text)
                }else if(msg.voice !== undefined){
                    // ini kalo kamu kirim voice note , nanti di kirim ke partner kamu
                    await bot.sendVoice(target , msg.voice.file_id)
                }else if(msg.video !== undefined){
                    // ini kalo kamu kirim video , nanti di kirim ke partner kamu
                    await bot.sendVideo(target , msg.video.file_id)
                }else if(msg.document !== undefined){
                    // ini kalo kamu kirim dokumen atau file , nanti di kirim ke partner kamu
                    await bot.sendDocument(target, msg.document.file_id)
                }else if(msg.audio !== undefined){
                    // ini kalo kamu kirim audio , nanti di kirim ke partner kamu
                    await bot.sendAudio(target , msg.audio.file_id)
                }
            }else{
                // Ini kalo kamu gak punya partner chatting
                await bot.sendMessage(id , "Kamu belum punya partner chatting \nketik /find untuk mencari partner chatting")
            }
        }
    }else{
        // Nah ini buat orang yang masukin bot ke group , padahal bot cuma untuk private chat !
        await bot.sendMessage(msg.chat.id , "Bot ini hanya berlaku untuk chat private , bukan group cok !")
    }
})