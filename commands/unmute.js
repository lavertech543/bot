const isAdmin = require('../lib/isAdmin');
const fs = require('fs');
const path = require('path');

// Storage setup as requested
const STORAGE_DIR = path.join(__dirname, '..', 'storage');
const MUTE_FILE = path.join(STORAGE_DIR, 'mute_schedules.json');

// Ensure storage exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Load mute schedules
let muteSchedules = {};
if (fs.existsSync(MUTE_FILE)) {
    try {
        muteSchedules = JSON.parse(fs.readFileSync(MUTE_FILE, 'utf8'));
    } catch (e) {
        muteSchedules = {};
    }
}

const saveSchedules = () => {
    fs.writeFileSync(MUTE_FILE, JSON.stringify(muteSchedules, null, 2));
};

async function unmuteCommand(sock, chatId, senderId) {
    try {
        // Use your isAdmin function
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        // Check if sender is admin
        if (!isSenderAdmin) {
            return await sock.sendMessage(chatId, {
                text: '⛔ *Access Denied*\n\nOnly group admins can unmute this group.',
                contextInfo: {
                    externalAdReply: {
                        title: "❌ Permission Required",
                        body: "Admin access needed",
                        thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/1828/1828843.png",
                        sourceUrl: "https://wa.me/237xxxxxxx"
                    }
                }
            });
        }

        // Check if bot is admin
        if (!isBotAdmin) {
            return await sock.sendMessage(chatId, {
                text: '🤖 *Bot Not Admin*\n\nI need to be an admin to unmute this group.',
                contextInfo: {
                    externalAdReply: {
                        title: "⚠️ Bot Privilege Required",
                        body: "Make me an admin first",
                        thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/753/753345.png"
                    }
                }
            });
        }

        // Get group metadata to check current state
        const metadata = await sock.groupMetadata(chatId);
        
        // Check if already unmuted
        if (!metadata.announce) {
            return await sock.sendMessage(chatId, {
                text: 'ℹ️ *Already Unmuted*\n\nThe group is already open. Everyone can send messages.',
                buttons: [
                    {
                        buttonId: 'mute_group',
                        buttonText: { displayText: '🔇 Mute Group' },
                        type: 1
                    }
                ],
                headerType: 1
            });
        }

        // Clear any scheduled auto-unmute
        if (muteSchedules[chatId]) {
            delete muteSchedules[chatId];
            saveSchedules();
        }

        // Perform unmute
        await sock.groupSettingUpdate(chatId, 'not_announcement');

        // Send success message with modern styling
        await sock.sendMessage(chatId, {
            text: `🔊 *Group Unmuted*\n\n✅ The group has been successfully opened.\n\n💬 *All members can now send messages.*\n\n👤 *Action by:* @${senderId.split('@')[0]}`,
            mentions: [senderId],
            buttons: [
                {
                    buttonId: 'mute_1h',
                    buttonText: { displayText: '⏰ Mute 1 Hour' },
                    type: 1
                },
                {
                    buttonId: 'mute_24h',
                    buttonText: { displayText: '📅 Mute 24 Hours' },
                    type: 1
                },
                {
                    buttonId: 'mute_perm',
                    buttonText: { displayText: '🔇 Mute Permanent' },
                    type: 1
                }
            ],
            headerType: 1,
            contextInfo: {
                externalAdReply: {
                    title: "🔊 Group Unmuted",
                    body: "Chat is now open for everyone",
                    thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/727/727269.png",
                    sourceUrl: "https://wa.me/237xxxxxxx"
                }
            }
        });

    } catch (error) {
        console.error('❌ Unmute Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ *Error*\n\nFailed to unmute the group. Please try again later.',
            contextInfo: {
                externalAdReply: {
                    title: "⚠️ Action Failed",
                    body: "An error occurred",
                    thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/753/753345.png"
                }
            }
        });
    }
}

// Matching mute command for completeness
async function muteCommand(sock, chatId, senderId, args = []) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isSenderAdmin) {
            return await sock.sendMessage(chatId, {
                text: '⛔ *Access Denied*\n\nOnly group admins can mute this group.',
                contextInfo: {
                    externalAdReply: {
                        title: "❌ Permission Required",
                        body: "Admin access needed",
                        thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/1828/1828843.png"
                    }
                }
            });
        }

        if (!isBotAdmin) {
            return await sock.sendMessage(chatId, {
                text: '🤖 *Bot Not Admin*\n\nI need to be an admin to mute this group.',
                contextInfo: {
                    externalAdReply: {
                        title: "⚠️ Bot Privilege Required",
                        body: "Make me an admin first",
                        thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/753/753345.png"
                    }
                }
            });
        }

        const metadata = await sock.groupMetadata(chatId);
        
        if (metadata.announce) {
            return await sock.sendMessage(chatId, {
                text: 'ℹ️ *Already Muted*\n\nThe group is already muted. Only admins can send messages.',
                buttons: [
                    {
                        buttonId: 'unmute_group',
                        buttonText: { displayText: '🔊 Unmute Group' },
                        type: 1
                    }
                ],
                headerType: 1
            });
        }

        // Parse duration
        let duration = null;
        let durationText = 'permanently';
        let ms = 0;

        if (args[0]) {
            const match = args[0].match(/^(\d+)([hmd])$/);
            if (match) {
                const val = parseInt(match[1]);
                const unit = match[2];
                const multipliers = { h: 3600000, m: 60000, d: 86400000 };
                ms = val * multipliers[unit];
                const unitNames = { h: 'hour(s)', m: 'minute(s)', d: 'day(s)' };
                durationText = `for ${val} ${unitNames[unit]}`;
                duration = Date.now() + ms;
            }
        }

        await sock.groupSettingUpdate(chatId, 'announcement');

        // Schedule auto-unmute if duration set
        if (duration) {
            muteSchedules[chatId] = {
                unmuteAt: duration,
                mutedBy: senderId
            };
            saveSchedules();

            setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, {
                        text: '⏰ *Auto-Unmute*\n\nScheduled unmute completed. Group is now open.',
                        buttons: [
                            {
                                buttonId: 'mute_group',
                                buttonText: { displayText: '🔇 Mute Again' },
                                type: 1
                            }
                        ],
                        headerType: 1
                    });
                    delete muteSchedules[chatId];
                    saveSchedules();
                } catch (e) {
                    console.error('Auto-unmute failed:', e);
                }
            }, ms);
        }

        const icon = duration ? '⏰' : '🔇';
        await sock.sendMessage(chatId, {
            text: `${icon} *Group Muted ${durationText.toUpperCase()}*\n\n✅ The group has been muted.\n\n🚫 *Only admins can send messages.*\n\n👤 *Action by:* @${senderId.split('@')[0]}`,
            mentions: [senderId],
            buttons: [
                {
                    buttonId: 'unmute_group',
                    buttonText: { displayText: '🔊 Unmute Now' },
                    type: 1
                }
            ],
            headerType: 1,
            contextInfo: {
                externalAdReply: {
                    title: "🔇 Group Muted",
                    body: `Restricted ${durationText}`,
                    thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/727/727240.png",
                    sourceUrl: "https://wa.me/237xxxxxxx"
                }
            }
        });

    } catch (error) {
        console.error('❌ Mute Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ *Error*\n\nFailed to mute the group.',
            contextInfo: {
                externalAdReply: {
                    title: "⚠️ Action Failed",
                    body: "An error occurred",
                    thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/753/753345.png"
                }
            }
        });
    }
}

// Button handler for interactive controls
async function handleMuteButton(sock, chatId, buttonId, senderId) {
    switch(buttonId) {
        case 'unmute_group':
            await unmuteCommand(sock, chatId, senderId);
            break;
        case 'mute_group':
        case 'mute_perm':
            await muteCommand(sock, chatId, senderId);
            break;
        case 'mute_1h':
            await muteCommand(sock, chatId, senderId, ['1h']);
            break;
        case 'mute_24h':
            await muteCommand(sock, chatId, senderId, ['24h']);
            break;
    }
}

module.exports = {
    unmuteCommand,
    muteCommand,
    handleMuteButton
};
