const isAdmin = require('../lib/isAdmin');

const PURGE_IMAGES = [
    'https://files.catbox.moe/4hlomq.jpg'
];

const getRandomImage = () => PURGE_IMAGES[Math.floor(Math.random() * PURGE_IMAGES.length)];

function speak(type, message) {
    const responses = {
        success: `✦ ${message} | The Shadow Realm is cleansed.`,
        error: `✗ ${message} | You dare question my authority?`,
        warning: `⚠ ${message} | Tread carefully, subject.`,
        info: `◈ ${message}`
    };
    return responses[type] || message;
}

async function purgeCommand(sock, chatId, message, senderId) {
    try {
        // Validate message object
        if (!message || !message.key) {
            console.error('Purge error: Invalid message object');
            return;
        }

        // Check if sender is Dev (you) or Owner
        const cleanNumber = senderId.replace(/[^0-9]/g, '');
        const isDev = cleanNumber === '237659262653';
        
        // Check admin status
        const adminStatus = await isAdmin(sock, chatId, senderId);
        const isOwner = message.key.fromMe || adminStatus.isSenderAdmin;
        
        if (!isDev && !isOwner) {
            await sock.sendMessage(chatId, {
                image: { url: getRandomImage() },
                caption: speak('error', 'Only the Shadow Monarch or Council may purge this realm.'),
                contextInfo: {
                    externalAdReply: {
                        title: "⛔ Access Denied",
                        body: "Supreme authority required",
                        thumbnailUrl: getRandomImage(),
                        sourceUrl: "https://wa.me/237659262653"
                    }
                }
            }, { quoted: message });
            return;
        }

        // Get group metadata
        let metadata;
        try {
            metadata = await sock.groupMetadata(chatId);
        } catch (err) {
            await sock.sendMessage(chatId, {
                text: speak('error', 'Failed to access group metadata.')
            }, { quoted: message });
            return;
        }

        const participants = metadata.participants || [];
        const botId = sock.user?.id || '';

        // Filter members to remove (non-admin, non-bot)
        const membersToRemove = participants
            .filter(p => !p.admin && p.id !== botId && p.id !== senderId)
            .map(p => p.id);

        if (!membersToRemove.length) {
            await sock.sendMessage(chatId, {
                image: { url: getRandomImage() },
                caption: speak('info', 'No subjects to purge. Only the worthy remain.'),
                contextInfo: {
                    externalAdReply: {
                        title: "ℹ️ Nothing to Purge",
                        body: "Group is already cleansed",
                        thumbnailUrl: getRandomImage()
                    }
                }
            }, { quoted: message });
            return;
        }

        // Send purge initiation message
        await sock.sendMessage(chatId, {
            image: { url: getRandomImage() },
            caption: speak('warning', `Initiating purge of ${membersToRemove.length} unworthy subjects...`),
            contextInfo: {
                externalAdReply: {
                    title: "🗡️ Purge Starting",
                    body: `Removing ${membersToRemove.length} members`,
                    thumbnailUrl: getRandomImage()
                }
            }
        }, { quoted: message });

        // Remove members one by one with delay
        let removedCount = 0;
        const failedRemovals = [];

        for (const memberId of membersToRemove) {
            try {
                await sock.groupParticipantsUpdate(chatId, [memberId], "remove");
                removedCount++;
                await new Promise(r => setTimeout(r, 1000));
            } catch (error) {
                console.error(`Failed to remove ${memberId}:`, error);
                failedRemovals.push(memberId);
            }
        }

        // Send completion message
        const usernames = membersToRemove.map(id => `@${id.split('@')[0]}`);
        const statusMessage = removedCount === membersToRemove.length 
            ? speak('success', `Purge complete. ${removedCount} subjects have been banished from this realm.`)
            : speak('warning', `Purge partial. ${removedCount}/${membersToRemove.length} banished. ${failedRemovals.length} resisted.`);

        await sock.sendMessage(chatId, {
            image: { url: getRandomImage() },
            caption: `${statusMessage}\\n\\n🗡️ Banished:\\n${usernames.slice(0, 10).join('\\n')}${usernames.length > 10 ? `\\n...and ${usernames.length - 10} more` : ''}`,
            mentions: membersToRemove,
            contextInfo: {
                externalAdReply: {
                    title: removedCount === membersToRemove.length ? "✅ Purge Complete" : "⚠️ Partial Purge",
                    body: `${removedCount} members removed`,
                    thumbnailUrl: getRandomImage()
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Error during purge:', error);
        try {
            if (message && message.key) {
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: speak('error', 'The purge has failed. The shadows reject your command.'),
                    contextInfo: {
                        externalAdReply: {
                            title: "⚠️ Purge Failed",
                            body: "Error during execution",
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

module.exports = { purgeCommand };
