(async () => {
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        jidNormalizedUser,
        fetchLatestBaileysVersion,
        Browsers,
        proto,
        makeInMemoryStore,
        DisconnectReason,
        downloadContentFromMessage, 
        delay,
        generateWAMessage,
        getAggregateVotesInPollMessage,
        areJidsSameUser
    } = require("baileys");
    const pino = require('pino');
    const { Boom } = require('@hapi/boom');
    const chalk = require('chalk');
    const readline = require("node:readline");
    const simple = require('./lib/simple.js');
    const fs = require("node:fs");
    const Queque = require("./lib/queque.js");
    const messageQueue = new Queque();
    const Database = require("./lib/database.js");
    const append = require("./lib/append");
    const serialize = require("./lib/serialize.js");
    const config = require("./settings.js");
    const Func = require("./lib/function.js");

    const data = fs.readFileSync(process.cwd() + '/system/case.js', 'utf8');
    const casePattern = /case\s+"([^"]+)"/g;
    const matches = data.match(casePattern).map(match => match.replace(/case\s+"([^"]+)"/, '$1'));

    const appenTextMessage = async (m, sock, text, chatUpdate) => {
        let messages = await generateWAMessage(
            m.key.remoteJid,
            {
                text: text,
                mentions: m.mentionedJid
            },
            {
                quoted: m.quoted,
            },
        );
        messages.key.fromMe = areJidsSameUser(m.sender, sock.user.id);
        messages.key.id = m.key.id;
        messages.pushName = m.pushName;
        if (m.isGroup) messages.participant = m.sender;
        let msg = {
            ...chatUpdate,
            messages: [proto.WebMessageInfo.fromObject(messages)],
            type: "append",
        };
        return sock.ev.emit("messages.upsert", msg);
    }

    const question = (text) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise((resolve) => {
            rl.question(text, resolve)
        })
    };

    //========[ Loader Execute ]=========
    global.db = new Database(config.database + ".json")
    await db.init(); 

    global.pg = new (await require(process.cwd() + "/lib/plugins"))(process.cwd() + "/system/plugins");
    await pg.watch();
    
    global.scraper = new (await require(process.cwd() + "/scrapers"))(process.cwd() + "/scrapers/src");
    await scraper.watch();
    
    setInterval(async () => {
        await db.save(); 
        await pg.load();
        await scraper.load();
    }, 2000);
    
    const store = makeInMemoryStore({ 
        logger: pino().child({ 
            level: 'silent',
            stream: 'store' 
        })
    })
    
    console.log(chalk.blue.bold("- Hi Welcome to NekoBot !"))
    console.log(chalk.white.bold("| Terimakasih telah menggunakan Script ini !"))
    console.log(chalk.white.bold("| Github saya [Follow] : " + chalk.cyan.bold("https://github.com/AxellNetwork")))
    console.log(chalk.white.bold("â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“â€“"))
    
    async function system() {
        const { 
            state,
            saveCreds 
        } = await useMultiFileAuthState(config.sessions);
        const sock = simple({
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            auth: state,
            version: [2, 3000, 1017531287],
            browser: Browsers.ubuntu("Edge"),
            getMessage: async key => {
                const jid = jidNormalizedUser(key.remoteJid);
                const msg = await store.loadMessage(jid, key.id);
                return msg?.message || '';
            },
            shouldSyncHistoryMessage: msg => {
                console.log(`\x1b[32mMemuat Chat [${msg.progress}%]\x1b[39m`);
                return !!msg.syncType;
            },
        }, store);
        store.bind(sock.ev);
        
        if (!sock.authState.creds.registered) {
            console.log(chalk.white.bold("- Silahkan masukan nomor WhatsApp anda, contoh +628xxxx"));
            const phoneNumber = await question(chalk.green.bold(`â€“ Nomor anda : `));
            const code = await sock.requestPairingCode(phoneNumber);
            setTimeout(() => {
                console.log(chalk.white.bold("- Kode Paring anda : " + code))
            }, 3000);
        }

        //=====[ Connect to WhatsApp ]=======//
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                console.log(chalk.green.bold(lastDisconnect.error));
                if (lastDisconnect.error == 'Error: Stream Errored (unknown)') {
                    process.exit(0);
                } else if (reason === DisconnectReason.badSession) {
                    console.log(chalk.red.bold(`Bad Session File, Please Delete Session and Scan Again`));
                    process.exit(0);
                } else if (reason === DisconnectReason.connectionClosed) {
                    console.log(chalk.yellow.bold('Connection closed, reconnecting. . .'));
                    process.exit(0);
                } else if (reason === DisconnectReason.connectionLost) {
                    console.log(chalk.yellow.bold('Connection lost, trying to reconnect'));
                    process.exit(0);
                } else if (reason === DisconnectReason.connectionReplaced) {
                    console.log(chalk.green.bold('Connection Replaced, Another New Session Opened, Please Close Current Session First'));
                    sock.logout();
                } else if (reason === DisconnectReason.loggedOut) {
                    console.log(chalk.green.bold(`Device Logged Out, Please Scan Again And Run.`));
                    sock.logout();
                } else if (reason === DisconnectReason.restartRequired) {
                    console.log(chalk.green.bold('Restart Required, Restarting. . .'));
                    system();
                } else if (reason === DisconnectReason.timedOut) {
                    console.log(chalk.green.bold('Connection TimedOut, Reconnecting. . .'));
                    system();
                }
            } else if (connection === "connecting") {
                console.log(chalk.green.bold('Connecting, Please Be Patient. . .'));
            } else if (connection === "open") {
                console.log(chalk.green.bold('Bot Successfully Connected. . . .'));
            }
        });
        sock.ev.on('creds.update', saveCreds);

        //=====[ After Connect to WhatsApp ]========//
        sock.ev.on('contacts.update', update => {
            for (let contact of update) {
                let id = jidNormalizedUser(contact.id);
                if (store && store.contacts) store.contacts[id] = { ...(store.contacts?.[id] || {}), ...(contact || {}) };
            }
        });

        sock.ev.on('messages.upsert', async (cht) => {
            if (cht.messages.length === 0) return;
            const chatUpdate = cht.messages[0];
            if (!chatUpdate.message) return;
            messageQueue.add(chatUpdate);
            console.log(messageQueue);
            if (!messageQueue.processing) {
                messageQueue.processQueue(async (message) => {
                    await require("./system/handler.js")(message, sock, store);
                });
            }
        });

        sock.downloadMediaMessage = async (message) => {
            let mime = (message.msg || message).mimetype || '';
            let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
            const stream = await downloadContentFromMessage(message, messageType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            return buffer;
        };

        return sock;
    }

    system();
})();