const isAdmin = require('../lib/isAdmin');

const TAGALL_IMAGES = [
    'https://image2url.com/r2/default/images/1771163805701-a22c4955-f007-40e7-bf80-cd32e9406e7e.jpg'
];

const getRandomImage = () => TAGALL_IMAGES[Math.floor(Math.random() * TAGALL_IMAGES.length)];

function speak(type, message) {
    const responses = {
        success: `✦ ${message} | Hear my call.`,
        error: `✗ ${message} | The shadows are silent.`,
        info: `◈ ${message} | This Queen summons you.`
    };
    return responses[type] || message;
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

function queenStyle(text) {
    return text.split('').join(' ');
}

// FIXED: Removed admin check - anyone can use tagall
async function tagAllCommand(sock, chatId, senderId, message) {
    try {
        // Validate message object
        if (!message || !message.key) {
            console.error('Tagall error: Invalid message object');
            return;
        }

        // Get group metadata
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(chatId);
        } catch (err) {
            await sock.sendMessage(chatId, {
                text: speak('error', 'Failed to access group metadata.')
            }, { quoted: message });
            return;
        }

        const participants = groupMetadata?.participants || [];

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, {
                image: { url: getRandomImage() },
                caption: speak('error', 'No subjects found in this realm.'),
                contextInfo: {
                    externalAdReply: {
                        title: "❌ Empty Group",
                        body: "No members to tag",
                        thumbnailUrl: getRandomImage()
                    }
                }
            }, { quoted: message });
            return;
        }

        // Get group profile picture with fallback
        let groupProfilePic;
        try {
            groupProfilePic = await sock.profilePictureUrl(chatId);
        } catch {
            groupProfilePic = getRandomImage();
        }

        // Build mentions array and message
        const mentions = participants.map(p => p.id);
        const mentionList = participants.map(p => `@${p.id.split('@')[0]}`).join('\n');

        const messageText = `
╭══ 👑 ${queenStyle('NEMESIS PRIME')} 👑 ═════╮
│            Queen 𝑺𝒖𝒎𝒎𝒐𝒏𝒔

╭────── 𝑹𝑶𝒀𝑨𝑳 𝑫𝑬𝑪𝑹𝑬𝑬 ────╮
📢 ${speak('info', 'Attention, my subjects!')}
╰───────────────────────╯

╭── 𝑲𝑰𝑵𝑮𝑫𝑶𝑴 ────╮
🏰 Group    : ${groupMetadata.subject}
👥 Members  : ${participants.length}
⏱️ Uptime   : ${formatUptime(process.uptime())}
╰─────────────╯

╭─────── 𝑺𝒖𝒎𝒎𝒐𝒏𝒆𝒅 𝑺𝒖𝒃𝒋𝒆𝒄𝒕𝒔 ───────╮
${mentionList}
╰────────────────────────╯

╭──── 𝑹𝑶𝒀𝑨𝑳 𝑶𝑹𝑫𝑬𝑹 ─────╮
Kneel before your Queen
╰──────────────────────╯
`;

        await sock.sendMessage(chatId, {
            image: { url: groupProfilePic },
            caption: messageText,
            mentions: mentions,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363421176303484@newsletter',
                    newsletterName: '༺『Q』『U』『E』『E』『N』 ❀『A』『i』༻',
                    serverMessageId: -1
                },
                externalAdReply: {
                    title: "👑 Queen Summons",
                    body: `${participants.length} subjects called`,
                    thumbnailUrl: groupProfilePic,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    sourceUrl: "https://wa.me/237659262653"
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error('Tagall error:', error);
        try {
            if (message && message.key) {
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: speak('error', 'The summons failed. The shadows are restless.'),
                    contextInfo: {
                        externalAdReply: {
                            title: "⚠️ Summons Failed",
                            body: "Error executing tagall",
                            thumbnailUrl: getRandomImage()
                        }
                    }
                }, { quoted: message });
            }
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
}

module.exports = tagAllCommand;
