const settings = require("../settings");
const { newsletterContext, getRandomNewsletterImage } = require('../lib/messageConfig');

function formatTime(seconds) {
    const days = Math.floor(seconds / (24*60*60));
    seconds %= 24*60*60;
    const hours = Math.floor(seconds / (60*60));
    seconds %= 60*60;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${days ? days + 'd ' : ''}${hours ? hours + 'h ' : ''}${minutes ? minutes + 'm ' : ''}${seconds}s`.trim();
}

// 🇨🇲 Cameroon Time
function getCameroonTime() {
    return new Date().toLocaleString("en-GB", { timeZone: "Africa/Douala" });
}

async function pingCommand(sock, chatId, message) {
    try {
        const start = Date.now();

        // First quick pong
        await sock.sendMessage(chatId, { text: '🏓 Checking bot speed...' }, { quoted: message });

        const speed = Math.round((Date.now() - start) / 2);
        const uptime = formatTime(process.uptime());
        const cameroonTime = getCameroonTime();
        const sudoCount = settings.sudoNumbers ? settings.sudoNumbers.length : 0;

        const pingMessage = `
╔═〔 *QUEEN AI STATUS* 〕═╗
┃ ⚡ Speed      : ${speed} ms
┃ ⏳ Uptime     : ${uptime}
┃ 🇨🇲 Local Time  : ${cameroonTime}
┃ 👑 Sudo Users  : ${sudoCount}
┃ ⚙ Version     : v${settings.version}
╚═════════════════╝
© *Black~~King*
`;

        const image = getRandomNewsletterImage();

        await sock.sendMessage(chatId, {
            image: { url: image },
            caption: pingMessage,
            contextInfo: newsletterContext(image)
        }, { quoted: message });

        // ⏱ reaction after 2 seconds
        setTimeout(async () => {
            await sock.sendMessage(chatId, { react: { text: "⚡", key: message.key } });
        }, 2000);

    } catch (error) {
        console.error('Ping Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to check bot status.' }, { quoted: message });
    }
}

module.exports = pingCommand;