const express = require('express');
const fs = require('fs');
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
    return true;
}

let router = express.Router();

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
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "fatal" }).child({ level: "fatal" })
                    ),
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

            EliteProTech.ev.on("connection.update", async (update) => {
                console.log("🔔 connection.update:", update);

                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    console.log("📶 Connection is open");
                    console.log("EliteProTech.user object:", EliteProTech.user);

                    // Wait a bit to ensure creds.json is written
                    await delay(3000);
                    await saveCreds();

                    const credsFile = `${sessionPath}/creds.json`;
                    if (!fs.existsSync(credsFile)) {
                        console.error("❌ creds.json file not found:", credsFile);
                        return;
                    }

                    const sessionData = fs.readFileSync(credsFile);
                    let target = EliteProTech.user?.id;
                    console.log("➡️ target JID to send to:", target);

                    if (!target) {
                        console.error("❌ target JID is undefined or falsy, cannot send");
                        return;
                    }

                    try {
                        console.log("📤 Sending creds.json to target...");
                        const sentDoc = await EliteProTech.sendMessage(target, {
                            document: sessionData,
                            mimetype: 'application/json',
                            fileName: 'creds.json'
                        });
                        console.log("✅ Document sent:", sentDoc);
                    } catch (err) {
                        console.error("❌ Error sending creds.json:", err);
                    }

                    try {
                        console.log("📤 Sending confirmation text...");
                        const sentTxt = await EliteProTech.sendMessage(target, {
                            text: "✅ SESSION ID obtained!"
                        });
                        console.log("✅ Text sent:", sentTxt);
                    } catch (err) {
                        console.error("❌ Error sending text:", err);
                    }

                    // Clean up
                    await delay(1000);
                    console.log("🧹 Cleaning up session files...");
                    removeFile(sessionPath);

                    console.log("🔌 Closing connection...");
                    EliteProTech.end();

                } else if (connection === "close") {
                    console.log("🔌 connection closed", lastDisconnect?.error);
                    if (lastDisconnect?.error?.output?.statusCode !== 401) {
                        await delay(5000);
                        Pair();
                    }
                }
            });

        } catch (err) {
            console.error("❌ Error in Pair():", err);
            removeFile(sessionPath);
            if (!res.headersSent) {
                res.send({ code: "Service Unavailable" });
            }
        }
    }

    Pair();
});

process.on('uncaughtException', (err) => {
    const msg = String(err);
    if (
        msg.includes("conflict") ||
        msg.includes("Socket connection timeout") ||
        msg.includes("not-authorized") ||
        msg.includes("rate-overlimit") ||
        msg.includes("Connection Closed") ||
        msg.includes("Timed Out") ||
        msg.includes("Value not found")
    ) {
        return;
    }
    console.error('Uncaught exception:', err);
});

module.exports = router;
