const isAdmin = require('../lib/isAdmin');

const KICK_IMAGES = {
    success: 'https://image2url.com/r2/default/images/1771163990900-fbd08407-933a-431f-97da-a92e1492e835.jpg',
    error: 'https://image2url.com/r2/default/images/1771163990900-fbd08407-933a-431f-97da-a92e1492e835.jpg',
    bot: 'https://image2url.com/r2/default/images/1771163990900-fbd08407-933a-431f-97da-a92e1492e835.jpg',
    admin: 'https://images.iimg.live/images/vibrant-gallery-4281.webp',
    kick: 'https://image2url.com/r2/default/images/1771163990900-fbd08407-933a-431f-97da-a92e1492e835.jpg'
};

function speak(type, message) {
    const responses = {
        success: `✦ ${message} | The Shadow Realm cleanses itself.`,
        error: `✗ ${message} | My power is limited.`,
        warning: `⚠ ${message} | Tread carefully, subject.`,
        info: `◈ ${message} | This Queen commands.`
    };
    return responses[type] || message;
}

async function kickCommand(sock, chatId, senderId, mentionedJids, message) {
    try {
        // Validate message object - FIXES fromMe ERROR
        if (!message || !message.key) {
            console.error('Kick error: Invalid message object');
            return;
        }

        // Get admin status
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        const isDev = senderId.replace(/[^0-9]/g, '') === '237659262653';
        const isOwner = message.key.fromMe || isDev;

        // Check bot admin
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                image: { url: KICK_IMAGES.error },
                caption: speak('error', 'I require admin privileges to banish subjects.'),
                contextInfo: {
                    externalAdReply: {
                        title: "⛔ Bot Not Admin",
                        body: "Promote me to use kick",
                        thumbnailUrl: KICK_IMAGES.error
                    }
                }
            }, { quoted: message });
            return;
        }

        // Check sender privileges (owner bypasses admin check)
        if (!isOwner && !isSenderAdmin) {
            await sock.sendMessage(chatId, {
                image: { url: KICK_IMAGES.admin },
                caption: speak('warning', 'Only the Shadow Council may banish subjects.'),
                contextInfo: {
                    externalAdReply: {
                        title: "⛔ Access Denied",
                        body: "Admin privileges required",
                        thumbnailUrl: KICK_IMAGES.admin
                    }
                }
            }, { quoted: message });
            return;
        }

        // Find users to kick
        let usersToKick = [];
        
        // Method 1: Mentioned users
        if (mentionedJids && mentionedJids.length > 0) {
            usersToKick = mentionedJids;
        }
        // Method 2: Replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            usersToKick = [message.message.extendedTextMessage.contextInfo.participant];
        }
        
        // No user found
        if (usersToKick.length === 0) {
            await sock.sendMessage(chatId, {
                image: { url: KICK_IMAGES.error },
                caption: speak('warning', 'Mention a subject or reply to their message to banish them.'),
                contextInfo: {
                    externalAdReply: {
                        title: "❌ No Target",
                        body: "Specify who to kick",
                        thumbnailUrl: KICK_IMAGES.error
                    }
                }
            }, { quoted: message });
            return;
        }

        // Get group metadata for checks
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];
        const botId = sock.user.id;
        const botNumber = botId.split(':')[0];

        // Filter valid targets
        const validTargets = [];
        const protectedUsers = [];
        
        for (const userId of usersToKick) {
            const userNumber = userId.split('@')[0];
            
            // Check if trying to kick bot
            if (userNumber === botNumber || userId === botId) {
                protectedUsers.push({ id: userId, reason: 'bot' });
                continue;
            }
            
            // Check if trying to kick owner (you)
            if (userNumber === '237659262653') {
                protectedUsers.push({ id: userId, reason: 'owner' });
                continue;
            }
            
            // Check if target is admin (only owner can kick admins)
            const targetParticipant = participants.find(p => {
                const pNum = p.id.split('@')[0];
                return pNum === userNumber;
            });
            
            if (targetParticipant?.admin && !isOwner) {
                protectedUsers.push({ id: userId, reason: 'admin' });
                continue;
            }
            
            validTargets.push(userId);
        }

        // Report protected users
        if (protectedUsers.length > 0) {
            const reasons = protectedUsers.map(u => {
                if (u.reason === 'bot') return '• Myself (I cannot self-destruct)';
                if (u.reason === 'owner') return '• The Shadow Monarch (unthinkable)';
                if (u.reason === 'admin') return '• A fellow council member (owner only)';
                return '• Protected entity';
            }).join('\n');
            
            await sock.sendMessage(chatId, {
                image: { url: KICK_IMAGES.bot },
                caption: speak('warning', `Some subjects are protected:\\n${reasons}`),
                contextInfo: {
                    externalAdReply: {
                        title: "🛡️ Protected",
                        body: "Cannot kick protected users",
                        thumbnailUrl: KICK_IMAGES.bot
                    }
                }
            }, { quoted: message });
        }

        // Execute kick for valid targets
        if (validTargets.length === 0) return;

        try {
            await sock.groupParticipantsUpdate(chatId, validTargets, "remove");
            
            const kickedNames = validTargets.map(jid => `@${jid.split('@')[0]}`);
            const kickText = validTargets.length === 1 
                ? speak('success', `${kickedNames[0]} has been banished from the Shadow Realm.`)
                : speak('success', `${kickedNames.length} subjects have been banished:\\n${kickedNames.join('\\n')}`);

            await sock.sendMessage(chatId, {
                image: { url: KICK_IMAGES.kick },
                caption: kickText,
                mentions: validTargets,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363421176303484@newsletter',
                        newsletterName: '༺『Q』『U』『E』『E』『N』 ❀『A』『i』༻',
                        serverMessageId: -1
                    },
                    externalAdReply: {
                        title: "👑 Subject Banished",
                        body: `${validTargets.length} removed from group`,
                        thumbnailUrl: KICK_IMAGES.success,
                        mediaType: 1,
                        renderLargerThumbnail: true,
                        sourceUrl: "https://wa.me/237659262653"
                    }
                }
            }, { quoted: message });

        } catch (error) {
            console.error('Kick execution error:', error);
            await sock.sendMessage(chatId, {
                image: { url: KICK_IMAGES.error },
                caption: speak('error', 'The banishment ritual failed. The shadows resisted.'),
                contextInfo: {
                    externalAdReply: {
                        title: "❌ Kick Failed",
                        body: "Error removing user",
                        thumbnailUrl: KICK_IMAGES.error
                    }
                }
            }, { quoted: message });
        }

    } catch (error) {
        console.error('Kick command error:', error);
        try {
            if (message && message.key) {
                await sock.sendMessage(chatId, {
                    image: { url: KICK_IMAGES.error },
                    caption: speak('error', 'An unexpected shadow consumed the command.'),
                    contextInfo: {
                        externalAdReply: {
                            title: "⚠️ Error",
                            body: "Command failed",
                            thumbnailUrl: KICK_IMAGES.error
                        }
                    }
                }, { quoted: message });
            }
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
}

module.exports = kickCommand;
