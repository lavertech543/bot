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

async function muteCommand(sock, chatId, senderId, args = []) {
    try {
        // Use your isAdmin function from lib
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        // Check sender admin status
        if (!isSenderAdmin) {
            return await sock.sendMessage(chatId, {
                text: '⛔ *Access Denied*\n\nOnly group admins can mute this group.',
                contextInfo: {
                    externalAdReply: {
                        title: "❌ Admin Required",
                        body: "You need admin privileges",
                        thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/1828/1828843.png",
                        sourceUrl: "https://wa.me/237xxxxxxx"
                    }
                }
            });
        }

        // Check bot admin status
        if (!isBotAdmin) {
            return await sock.sendMessage(chatId, {
                text: '🤖 *Bot Not Admin*\n\nPlease make me an admin to use this feature.',
                contextInfo: {
                    externalAdReply: {
                        title: "⚠️ Bot Privilege Missing",
                        body: "Promote me to admin first",
                        thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/753/753345.png"
                    }
                }
            });
        }

        // Get group metadata
        const metadata = await sock.groupMetadata(chatId);
        
        // Check if already muted
        if (metadata.announce) {
            return await sock.sendMessage(chatId, {
                text: 'ℹ️ *Already Muted*\n\nThe group is already restricted to admins only.',
                buttons: [
                    {
                        buttonId: 'unmute_group',
                        buttonText: { displayText: '🔊 Unmute Now' },
                        type: 1
                    }
                ],
                headerType: 1
            });
        }

        // Parse duration from args (e.g., "1h", "30m", "2d")
        let durationMs = 0;
        let durationText = 'permanently';
        let unmuteTime = null;

        if (args && args.length > 0) {
            const timeArg = args[0].toLowerCase();
            const match = timeArg.match(/^(\d+)([hmd])$/);
            
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2];
                
                const multipliers = {
                    'm': 60000,      // minutes
                    'h': 3600000,    // hours
                    'd': 86400000    // days
                };
                
                durationMs = value * multipliers[unit];
                unmuteTime = Date.now() + durationMs;
                
                const unitNames = { 'm': 'minutes', 'h': 'hours', 'd': 'days' };
                durationText = `for ${value} ${unitNames[unit]}`;
            }
        }

        // Perform mute
        await sock.groupSettingUpdate(chatId, 'announcement');

        // Schedule auto-unmute if duration specified
        if (durationMs > 0) {
            // Save to storage for persistence
            muteSchedules[chatId] = {
                unmuteAt: unmuteTime,
                mutedBy: senderId,
                duration: durationText
            };
            saveSchedules();

            // Set timeout for auto-unmute
            setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, {
                        text: '⏰ *Auto-Unmute*\n\nThe mute period has expired. Group is now open!',
                        buttons: [
                            {
                                buttonId: 'mute_group',
                                buttonText: { displayText: '🔇 Mute Again' },
                                type: 1
                            }
                        ],
                        headerType: 1
                    });
                    
                    // Clean up storage
                    delete muteSchedules[chatId];
                    saveSchedules();
                } catch (err) {
                    console.error('❌ Auto-unmute failed:', err);
                }
            }, durationMs);
        }

        // Build success message
        const icon = durationMs > 0 ? '⏰' : '🔇';
        const timeInfo = durationMs > 0 
            ? `⏳ *Auto-unmute:* ${new Date(unmuteTime).toLocaleString()}` 
            : '⚠️ *Permanent until manually unmuted*';

        await sock.sendMessage(chatId, {
            text: `${icon} *GROUP MUTED ${durationText.toUpperCase()}*\n\n` +
                  `✅ The group has been successfully muted.\n\n` +
                  `🚫 *Only admins can send messages.*\n\n` +
                  `👤 *Muted by:* @${senderId.split('@')[0]}\n` +
                  `${timeInfo}`,
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
                    body: `Chat restricted ${durationText}`,
                    thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/727/727240.png",
                    sourceUrl: "https://wa.me/237xxxxxxx"
                }
            }
        });

    } catch (error) {
        console.error('❌ Mute Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ *Error*\n\nFailed to mute the group. Please ensure I have admin privileges.',
            contextInfo: {
                externalAdReply: {
                    title: "⚠️ Action Failed",
                    body: "Could not mute group",
                    thumbnailUrl: "https://cdn-icons-png.flaticon.com/512/753/753345.png"
                }
            }
        });
    }
}

module.exports = muteCommand;
