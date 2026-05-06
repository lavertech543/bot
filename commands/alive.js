const settings = require("../settings");
const { newsletterContext, getRandomNewsletterImage } = require('../lib/messageConfig');

// 🇨🇲 Cameroon Time
function getCameroonTime() {
    return new Date().toLocaleString("en-GB", { timeZone: "Africa/Douala" });
}

function formatTime(seconds) {
    const days = Math.floor(seconds / (24*60*60));
    seconds %= 24*60*60;
    const hours = Math.floor(seconds / (60*60));
    seconds %= 60*60;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${days ? days + 'd ' : ''}${hours ? hours + 'h ' : ''}${minutes ? minutes + 'm ' : ''}${seconds}s`.trim();
}

async function aliveCommand(sock, chatId, message, botStats = {}) {
    try {
        const start = Date.now();

        // Quick "checking..." message
        await sock.sendMessage(chatId, { text: "🟢 Checking bot status..." }, { quoted: message });

        const latency = Math.round((Date.now() - start) / 2);
        const uptime = formatTime(process.uptime());
        const cameroonTime = getCameroonTime();
        const sudoCount = settings.sudoNumbers ? settings.sudoNumbers.length : 0;
        const totalGroups = botStats.totalGroups || "N/A";
        const totalUsers = botStats.totalUsers || "N/A";

        const aliveMessage = `
╔═━━『 *QUEEN AI SYSTEM* 』━━═╗
┃ 🌐 Status    : Online
┃ ⚡ Latency   : ${latency} ms
┃ ⏳ Uptime    : ${uptime}
┃ 🇨🇲 Local Time: ${cameroonTime}
┃ 🏘 Total Groups: ${totalGroups}
┃ 👥 Total Users : ${totalUsers}
┃ 👑 Sudo Users  : ${sudoCount}
┃ ⚙ Version    : v${settings.version}
╚════════════════╝
© *Black~King*
`;

        const randomImage = getRandomNewsletterImage();

        await sock.sendMessage(chatId, {
            image: { url: randomImage },
            caption: aliveMessage,
            contextInfo: newsletterContext(randomImage)
        }, { quoted: message });

        // ⏱ Reaction after 2 seconds
        setTimeout(async () => {
            await sock.sendMessage(chatId, { react: { text: "🟢", key: message.key } });
        }, 2000);

    } catch (error) {
        console.error("Alive command error:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Failed to fetch bot status.",
            contextInfo: newsletterContext()
        }, { quoted: message });
    }
}

module.exports = aliveCommand;