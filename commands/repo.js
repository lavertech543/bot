const { newsletterContext, getRandomNewsletterImage } = require('../lib/messageConfig');

const scriptLink = "https://github.com/queen-ai-bot-md/queen_ai_md";
const channelLink = "https://whatsapp.com/channel/0029VbBYMyZIyPtOEnuT0S04";
const devChannel2 = "https://whatsapp.com/channel/0029VapNnkE60eBaAvllKJ2g";
const groupLink = "https://chat.whatsapp.com/DpADtS77s3LKToWpjDQnz1";
const telegramGroupLink = "https://t.me/bugbotsapp";

async function repoCommand(sock, chatId, message) {
    try {
        const text = `
╭━〔 ~*QUEEN AI SYSTEM*~ 〕━⬣
┃ © Developer: *BLACK~KING*
┃
┣━━〔 📜 SCRIPT v2 〕━⬣
┃ 🔗 ${scriptLink}
┃
┣━━〔 📡 CHANNELS 〕━⬣
┃ 🌟 Main: ${channelLink}
┃ 🚀 Dev 2: ${devChannel2}
┃
┣━━〔 🌍 COMMUNITIES 〕━⬣
┃ 🏠 WhatsApp: ${groupLink}
┃ 📱 Telegram: ${telegramGroupLink}
┃
┣━━〔 🎬 free bot tg v2 〕━⬣
┃ ▶ https://t.me/queen_ai_v2_bot
┃ ▶ https://t.me/queen_ai_v2_n2_bot
┃ ▶ https://t.me/queen_ai_v2_n3_bot
┣━━〔 🎬 free bot tg v3 〕━⬣
┃ ▶ http://t.me/queen_ai_v3_bot
┃ ▶ http://t.me/queen_ai_v3_n2_bot
╰━━〔 ⚜ *NEMESIS TECH* ⚜ 〕━⬣
`;

        const randomImage = getRandomNewsletterImage();
        await sock.sendMessage(chatId, {
            image: { url: randomImage },
            caption: text,
            contextInfo: newsletterContext(randomImage)
        }, { quoted: message });

    } catch (err) {
        console.error("Repo Error:", err);
        await sock.sendMessage(chatId, { text: "❌ Repo menu failed." }, { quoted: message });
    }
}

module.exports = repoCommand;