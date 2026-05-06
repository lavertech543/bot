const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');

// Queen images for antilink responses
const ANTILINK_IMAGES = [
    'https://image2url.com/r2/default/images/1771207782841-2a8b5fb7-515c-4b9e-956a-00b5e2b5c3af.jpg'
];

const getRandomImage = () => ANTILINK_IMAGES[Math.floor(Math.random() * ANTILINK_IMAGES.length)];

function speak(type, message) {
    const responses = {
        success: `✦ ${message} | protects this domain.`,
        error: `✗ ${message} | Do not test my patience.`,
        warning: `⚠  | Mind your place, subject. I said No link.`,
        info: `◈ ${message}`
    };
    return responses[type] || message;
}

/**
 * Check if a user is admin in the group using Baileys groupMetadata
 * @param {Object} sock - Baileys socket connection
 * @param {String} chatId - Group JID
 * @param {String} userId - User JID to check
 * @returns {Promise<Boolean>}
 */
async function isUserAdmin(sock, chatId, userId) {
    try {
        // Only works in groups
        if (!chatId.endsWith('@g.us')) return false;
        
        const metadata = await sock.groupMetadata(chatId);
        if (!metadata || !metadata.participants) return false;
        
        const participant = metadata.participants.find(p => p.id === userId);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Get all admin JIDs in the group
 * @param {Object} sock - Baileys socket connection
 * @param {String} chatId - Group JID
 * @returns {Promise<Array>} - Array of admin JIDs
 */
async function getGroupAdmins(sock, chatId) {
    try {
        if (!chatId.endsWith('@g.us')) return [];
        
        const metadata = await sock.groupMetadata(chatId);
        if (!metadata || !metadata.participants) return [];
        
        return metadata.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id);
    } catch (error) {
        console.error('Error fetching group admins:', error);
        return [];
    }
}

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        // Validate message
        if (!message || !message.key) {
            console.error('Antilink error: Invalid message object');
            return;
        }

        // STRICT: Verify admin status using groupMetadata (not just cached value)
        const isAdmin = await isUserAdmin(sock, chatId, senderId);
        
        if (!isAdmin) {
            await sock.sendMessage(chatId, {
                image: { url: getRandomImage() },
                caption: speak('error', 'For Group Admins Only!'),
                contextInfo: {
                    externalAdReply: {
                        title: "⛔ Access Denied",
                        body: "Admin privileges required",
                        thumbnailUrl: getRandomImage(),
                        sourceUrl: "https://wa.me/237659262653"
                    }
                }
            }, { quoted: message });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = speak('info', `ANTILINK SETUP\n\n${prefix}antilink on\n${prefix}antilink set delete | kick | warn\n${prefix}antilink off`);
            await sock.sendMessage(chatId, {
                image: { url: getRandomImage() },
                caption: usage,
                contextInfo: {
                    externalAdReply: {
                        title: "🛡️ Antilink Setup",
                        body: "Configure link protection",
                        thumbnailUrl: getRandomImage(),
                        sourceUrl: "https://wa.me/237659262653"
                    }
                }
            }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, {
                        image: { url: getRandomImage() },
                        caption: speak('warning', 'Antilink is already active in this realm.'),
                        contextInfo: {
                            externalAdReply: {
                                title: "🛡️ Already Active",
                                body: "Protection is enabled",
                                thumbnailUrl: getRandomImage()
                            }
                        }
                    }, { quoted: message });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: result ? speak('success', 'Antilink has been activated. No unauthorized links shall pass.') : speak('error', 'Failed to activate Antilink.'),
                    contextInfo: {
                        externalAdReply: {
                            title: result ? "✅ Protection Active" : "❌ Failed",
                            body: result ? "Antilink enabled" : "Activation failed",
                            thumbnailUrl: getRandomImage()
                        }
                    }
                }, { quoted: message });
                break;

            case 'off':
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: speak('info', 'Antilink has been deactivated. Links are now permitted.'),
                    contextInfo: {
                        externalAdReply: {
                            title: "⚪ Protection Disabled",
                            body: "Antilink turned off",
                            thumbnailUrl: getRandomImage()
                        }
                    }
                }, { quoted: message });
                break;

            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        image: { url: getRandomImage() },
                        caption: speak('warning', `Specify an action: ${prefix}antilink set delete | kick | warn`),
                        contextInfo: {
                            externalAdReply: {
                                title: "⚠️ Invalid Syntax",
                                body: "Action required",
                                thumbnailUrl: getRandomImage()
                            }
                        }
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        image: { url: getRandomImage() },
                        caption: speak('error', 'Invalid action. Choose: delete, kick, or warn.'),
                        contextInfo: {
                            externalAdReply: {
                                title: "❌ Invalid Action",
                                body: "Choose valid option",
                                thumbnailUrl: getRandomImage()
                            }
                        }
                    }, { quoted: message });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction);
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: setResult ? speak('success', `Antilink punishment set to: ${setAction}`) : speak('error', 'Failed to configure Antilink.'),
                    contextInfo: {
                        externalAdReply: {
                            title: setResult ? "✅ Configured" : "❌ Failed",
                            body: `Action: ${setAction}`,
                            thumbnailUrl: getRandomImage()
                        }
                    }
                }, { quoted: message });
                break;

            case 'get':
                const status = await getAntilink(chatId, 'on');
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: speak('info', `Antilink Configuration:\nStatus: ${status?.enabled ? '🟢 ON' : '🔴 OFF'}\nAction: ${status?.action || 'Not set'}`),
                    contextInfo: {
                        externalAdReply: {
                            title: "🛡️ Current Config",
                            body: "Antilink settings",
                            thumbnailUrl: getRandomImage()
                        }
                    }
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: speak('warning', `Use ${prefix}antilink for usage instructions.`),
                    contextInfo: {
                        externalAdReply: {
                            title: "ℹ️ Help",
                            body: "Invalid command",
                            thumbnailUrl: getRandomImage()
                        }
                    }
                }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        try {
            if (message && message.key) {
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: speak('error', 'Error processing antilink command. The shadows are restless.'),
                    contextInfo: {
                        externalAdReply: {
                            title: "⚠️ Error",
                            body: "Command failed",
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

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    try {
        // Validate inputs
        if (!message || !message.key || !userMessage) return;

        const antilinkConfig = await getAntilink(chatId, 'on');
        if (!antilinkConfig || !antilinkConfig.enabled) return;

        // CRITICAL: Skip if sender is a group admin (whitelist)
        const isAdmin = await isUserAdmin(sock, chatId, senderId);
        if (isAdmin) {
            // Admin can send links freely - no logging to avoid spam
            return;
        }

        const linkPatterns = {
            whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i,
            whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/i,
            telegram: /t\.me\/[A-Za-z0-9_]+/i,
            allLinks: /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i,
        };

        let shouldDelete = false;
        let detectedType = '';

        if (linkPatterns.whatsappGroup.test(userMessage)) {
            shouldDelete = true;
            detectedType = 'WhatsApp Group';
        } else if (linkPatterns.whatsappChannel.test(userMessage)) {
            shouldDelete = true;
            detectedType = 'WhatsApp Channel';
        } else if (linkPatterns.telegram.test(userMessage)) {
            shouldDelete = true;
            detectedType = 'Telegram';
        } else if (linkPatterns.allLinks.test(userMessage)) {
            shouldDelete = true;
            detectedType = 'External Link';
        }

        if (shouldDelete) {
            // Delete the message
            try {
                await sock.sendMessage(chatId, {
                    delete: message.key
                });
            } catch (error) {
                console.error('Failed to delete message:', error);
            }

            // Warn the user with image
            try {
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: speak('warning', `⚠️ @${senderId.split('@')[0]}, posting ${detectedType} links is forbidden in this realm.`),
                    mentions: [senderId],
                    contextInfo: {
                        externalAdReply: {
                            title: "🚫 Link Detected",
                            body: "Unauthorized link removed",
                            thumbnailUrl: getRandomImage()
                        }
                    }
                });
            } catch (e) {
                console.error('Failed to send warning:', e);
            }

            // Execute punishment if configured
            if (antilinkConfig.action === 'kick') {
                setTimeout(async () => {
                    try {
                        // Double-check admin status before kick (safety)
                        const stillAdmin = await isUserAdmin(sock, chatId, senderId);
                        if (!stillAdmin) {
                            await sock.groupParticipantsUpdate(chatId, [senderId], "remove");
                        }
                    } catch (e) {
                        console.error('Failed to kick user:', e);
                    }
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Error in link detection:', error);
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
    isUserAdmin,        // Exported for reuse
    getGroupAdmins      // Exported for reuse
};
