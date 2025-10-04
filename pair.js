const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
};

router.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Number is required" });

    num = num.replace(/[^0-9]/g, '');
    const sessionPath = `./sessions/${num}`;

    async function Pair() {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        try {
            let EliteProTech = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            if (!EliteProTech.authState.creds.registered) {
                await delay(1500);
                const code = await EliteProTech.requestPairingCode(num);
                if (!res.headersSent) {
                    res.send({ code });
                }
            }

            EliteProTech.ev.on('creds.update', saveCreds);

            EliteProTech.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    await delay(8000);
                    const session = fs.readFileSync(`${sessionPath}/creds.json`);
                    EliteProTech.groupAcceptInvite("BscdfUpSmJY0OAOWfyPjNs");

                    const ses = await EliteProTech.sendMessage(EliteProTech.user.id, {
                        document: session,
                        mimetype: `application/json`,
                        fileName: `creds.json`
                    });
                    
await EliteProTech.sendMessage(EliteProTech.user.id, {
  text: `✅ *SESSION ID OBTAINED SUCCESSFULLY!*  
📁 Upload SESSION_ID (creds.json) on session folder or add it to your .env file: SESSION_ID=

📢 *Stay Updated — Follow Our Channels:*

➊ *WhatsApp Channel*  
https://whatsapp.com/channel/0029VaXaqHII1rcmdDBBsd3g

➋ *Telegram*  
https://t.me/elitepro_md

➌ *YouTube*  
https://youtube.com/@eliteprotechs

🚫 *Do NOT share your session ID or creds.json with anyone.*

🌐 *Explore more tools on our website:*  
https://eliteprotech.zone.id`,
contextInfo: {
externalAdReply: {
title: 'ELITEPROTECH SESSION-ID GENERATOR',
body: 'Join our official channel for more updates',
thumbnailUrl: 'http://elitepro-url-clouds.onrender.com/18c0e09bc35e16fae8fe7a34647a5c82.jpg',
sourceUrl: 'https://whatsapp.com/channel/0029VaXaqHII1rcmdDBBsd3g',
mediaType: 1,
renderLargerThumbnail: true
    }
  }
}, { quoted: ses });

                    await delay(200);
                    removeFile(sessionPath);
                    EliteProTech.end(); // close connection but keep server alive
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode != 401) {
                    await delay(5000);
                    Pair();
                }
            });

        } catch (err) {
            console.log("Service error:", err);
            removeFile(sessionPath);
            if (!res.headersSent) {
                res.send({ code: "Service Unavailable" });
            }
        }
    }
    Pair();
});

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (
        e.includes("conflict") ||
        e.includes("Socket connection timeout") ||
        e.includes("not-authorized") ||
        e.includes("rate-overlimit") ||
        e.includes("Connection Closed") ||
        e.includes("Timed Out") ||
        e.includes("Value not found")
    ) return;
    console.log('Caught exception:', err);
});

module.exports = router;
