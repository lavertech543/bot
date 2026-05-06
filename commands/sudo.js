const settings = require('../settings');
const { addSudo, removeSudo, getSudoList } = require('../lib/index');

// Enhanced mention extraction with multiple fallback methods
function extractMentionedJid(message) {
    // Method 1: Direct mentions in contextInfo
    const contextInfo = message.message?.extendedTextMessage?.contextInfo || 
                       message.message?.imageMessage?.contextInfo ||
                       message.message?.videoMessage?.contextInfo ||
                       {};
    const mentioned = contextInfo.mentionedJid || [];
    if (mentioned.length > 0) return mentioned[0];

    // Method 2: Quoted message sender
    const quotedParticipant = contextInfo.participant;
    if (quotedParticipant) return quotedParticipant;

    // Method 3: Extract from text (number patterns)
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || 
                 message.message?.imageMessage?.caption ||
                 message.message?.videoMessage?.caption ||
                 '';
    
    // Match international numbers (7-15 digits, optional +)
    const match = text.match(/\+?(\d{7,15})/);
    if (match) return match[1] + '@s.whatsapp.net';

    return null;
}

// Format JID for display
function formatJid(jid) {
    if (!jid) return 'Unknown';
    const number = jid.split('@')[0];
    return '+' + number;
}

// Check if user is owner or sudo
async function isPrivileged(sock, message) {
    const senderJid = message.key.participant || message.key.remoteJid;
    const ownerJid = settings.ownerNumber + '@s.whatsapp.net';
    const isOwner = message.key.fromMe || senderJid === ownerJid;
    
    if (isOwner) return { isOwner: true, isSudo: false, senderJid };
    
    const sudoList = await getSudoList();
    const isSudo = sudoList.includes(senderJid);
    
    return { isOwner: false, isSudo, senderJid };
}

async function sudoCommand(sock, chatId, message) {
    try {
        const { isOwner, isSudo, senderJid } = await isPrivileged(sock, message);
        const rawText = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || 
                       message.message?.imageMessage?.caption ||
                       message.message?.videoMessage?.caption ||
                       '';
        
        const args = rawText.trim().split(/\s+/).slice(1);
        const sub = (args[0] || '').toLowerCase();

        // Premium help menu with buttons
        if (!sub || !['add', 'del', 'remove', 'list', 'help'].includes(sub)) {
            const buttons = [];
            
            if (isOwner) {
                buttons.push(
                    { buttonId: 'sudo_add', buttonText: { displayText: '➕ Add Sudo' }, type: 1 },
                    { buttonId: 'sudo_remove', buttonText: { displayText: '➖ Remove Sudo' }, type: 1 }
                );
            }
            buttons.push({ buttonId: 'sudo_list', buttonText: { displayText: '📋 List Sudo' }, type: 1 });

            await sock.sendMessage(chatId, {
                text: `👑 *SUDO MANAGEMENT*\n\n` +
                      `*Usage:*\n` +
                      `• *.sudo add @user* - Add sudo user\n` +
                      `• *.sudo del @user* - Remove sudo user\n` +
                      `• *.sudo list* - Show all sudo users\n\n` +
                      `*Your Status:* ${isOwner ? '👑 Owner' : isSudo ? '⭐ Sudo' : '👤 User'}`,
                buttons: buttons,
                headerType: 1,
                contextInfo: {
                    externalAdReply: {
                        title: "👑 Sudo Control Panel",
                        body: "Manage bot privileges",
                        thumbnailUrl: "https://imgbob.net/jp6XI5FkA70EVvg",
                        sourceUrl: "https://wa.me/237xxxxxxx"
                    }
                }
            }, { quoted: message });
            return;
        }

        // List command - available to all
        if (sub === 'list') {
            const list = await getSudoList();
            
            if (list.length === 0) {
                await sock.sendMessage(chatId, {
                    text: '📭 *No Sudo Users*\n\nThe sudo list is currently empty.',
                    contextInfo: {
                        externalAdReply: {
                            title: "Sudo List",
                            body: "No privileged users",
                            thumbnailUrl: "https://files.catbox.moe/4hlomq.jpg"
                        }
                    }
                }, { quoted: message });
                return;
            }

            const formattedList = list.map((jid, i) => {
                const num = formatJid(jid);
                const isOwn = jid === (settings.ownerNumber + '@s.whatsapp.net') ? ' 👑' : '';
                return `${i + 1}. ${num}${isOwn}`;
            }).join('\n');

            await sock.sendMessage(chatId, {
                text: `📋 *SUDO USERS (${list.length})*\n\n${formattedList}\n\n` +
                      `👑 = Owner\n⭐ = Sudo User`,
                buttons: isOwner ? [
                    { buttonId: 'sudo_remove', buttonText: { displayText: '➖ Remove User' }, type: 1 }
                ] : [],
                headerType: 1,
                contextInfo: {
                    externalAdReply: {
                        title: "Privileged Users",
                        body: `${list.length} sudo user(s)`,
                        thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg",
                        sourceUrl: "https://wa.me/237xxxxxxx"
                    }
                }
            }, { quoted: message });
            return;
        }

        // Owner-only commands
        if (!isOwner) {
            await sock.sendMessage(chatId, {
                text: '⛔ *Access Denied*\n\nOnly the bot owner can add or remove sudo users.\n\n📋 Use *.sudo list* to view current sudo users.',
                contextInfo: {
                    externalAdReply: {
                        title: "❌ Permission Error",
                        body: "Owner access required",
                        thumbnailUrl: "https://images.iimg.live/images/vibrant-gallery-4281.webp",
                        sourceUrl: "https://wa.me/237659262653"
                    }
                }
            }, { quoted: message });
            return;
        }

        // Add command
        if (sub === 'add') {
            const targetJid = extractMentionedJid(message);
            
            if (!targetJid) {
                await sock.sendMessage(chatId, {
                    text: '❌ *No Target Found*\n\nPlease:\n• Mention a user (reply or @user)\n• Reply to a message\n• Provide a phone number',
                    contextInfo: {
                        externalAdReply: {
                            title: "Invalid Input",
                            body: "User identification failed",
                            thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg"
                        }
                    }
                }, { quoted: message });
                return;
            }

            // Prevent duplicate
            const currentList = await getSudoList();
            if (currentList.includes(targetJid)) {
                await sock.sendMessage(chatId, {
                    text: `⚠️ *Already Sudo*\n\n${formatJid(targetJid)} is already a sudo user.`,
                    buttons: [
                        { buttonId: 'sudo_remove', buttonText: { displayText: '➖ Remove Instead' }, type: 1 }
                    ],
                    headerType: 1
                }, { quoted: message });
                return;
            }

            const success = await addSudo(targetJid);
            
            if (success) {
                await sock.sendMessage(chatId, {
                    text: `✅ *Sudo Added*\n\n` +
                          `👤 User: ${formatJid(targetJid)}\n` +
                          `🆔 JID: ${targetJid}\n\n` +
                          `This user now has sudo privileges.`,
                    mentions: [targetJid],
                    buttons: [
                        { buttonId: 'sudo_list', buttonText: { displayText: '📋 View List' }, type: 1 }
                    ],
                    headerType: 1,
                    contextInfo: {
                        externalAdReply: {
                            title: "Privilege Granted",
                            body: "New sudo user added",
                            thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg",
                            sourceUrl: "https://wa.me/237659262653"
                        }
                    }
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ *Failed*\n\nCould not add sudo user. Please try again.',
                    contextInfo: {
                        externalAdReply: {
                            title: "Error",
                            body: "Operation failed",
                            thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg"
                        }
                    }
                }, { quoted: message });
            }
            return;
        }

        // Remove/Delete command
        if (sub === 'del' || sub === 'remove') {
            const targetJid = extractMentionedJid(message);
            
            if (!targetJid) {
                await sock.sendMessage(chatId, {
                    text: '❌ *No Target Found*\n\nPlease:\n• Mention a user (reply or @user)\n• Reply to a message\n• Provide a phone number',
                    contextInfo: {
                        externalAdReply: {
                            title: "Invalid Input",
                            body: "User identification failed",
                            thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg"
                        }
                    }
                }, { quoted: message });
                return;
            }

            const ownerJid = settings.ownerNumber + '@s.whatsapp.net';
            
            // Prevent owner removal
            if (targetJid === ownerJid || targetJid === settings.ownerNumber) {
                await sock.sendMessage(chatId, {
                    text: '⛔ *Cannot Remove Owner*\n\nThe bot owner cannot be removed from sudo list.',
                    contextInfo: {
                        externalAdReply: {
                            title: "Action Blocked",
                            body: "Owner protection active",
                            thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg"
                        }
                    }
                }, { quoted: message });
                return;
            }

            // Check if actually in list
            const currentList = await getSudoList();
            if (!currentList.includes(targetJid)) {
                await sock.sendMessage(chatId, {
                    text: `⚠️ *Not Found*\n\n${formatJid(targetJid)} is not in the sudo list.`,
                    buttons: [
                        { buttonId: 'sudo_add', buttonText: { displayText: '➕ Add Instead' }, type: 1 }
                    ],
                    headerType: 1
                }, { quoted: message });
                return;
            }

            const success = await removeSudo(targetJid);
            
            if (success) {
                await sock.sendMessage(chatId, {
                    text: `✅ *Sudo Removed*\n\n` +
                          `👤 User: ${formatJid(targetJid)}\n` +
                          `🆔 JID: ${targetJid}\n\n` +
                          `This user no longer has sudo privileges.`,
                    mentions: [targetJid],
                    buttons: [
                        { buttonId: 'sudo_list', buttonText: { displayText: '📋 View List' }, type: 1 }
                    ],
                    headerType: 1,
                    contextInfo: {
                        externalAdReply: {
                            title: "Privilege Revoked",
                            body: "Sudo user removed",
                            thumbnailUrl: "https://imgbob.net/CG86Kwonl9gLTqc",
                            sourceUrl: "https://wa.me/237xxxxxxx"
                        }
                    }
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ *Failed*\n\nCould not remove sudo user. Please try again.',
                    contextInfo: {
                        externalAdReply: {
                            title: "Error",
                            body: "Operation failed",
                            thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg"
                        }
                    }
                }, { quoted: message });
            }
            return;
        }

    } catch (error) {
        console.error('❌ Sudo Command Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ *System Error*\n\nAn unexpected error occurred. Please try again later.',
            contextInfo: {
                externalAdReply: {
                    title: "System Error",
                    body: "Command execution failed",
                    thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg"
                }
            }
        }, { quoted: message });
    }
}

// Button handler for interactive controls
async function handleSudoButton(sock, chatId, buttonId, message) {
    const { isOwner } = await isPrivileged(sock, message);
    
    switch(buttonId) {
        case 'sudo_list':
            await sudoCommand(sock, chatId, { ...message, message: { conversation: '.sudo list' } });
            break;
        case 'sudo_add':
            if (isOwner) {
                await sock.sendMessage(chatId, {
                    text: '➕ *Add Sudo*\n\nUse: *.sudo add @user*\nOr reply to a message with: *.sudo add*',
                    contextInfo: {
                        externalAdReply: {
                            title: "Add Sudo User",
                            body: "Mention or reply to user",
                            thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg"
                        }
                    }
                });
            }
            break;
        case 'sudo_remove':
            if (isOwner) {
                await sock.sendMessage(chatId, {
                    text: '➖ *Remove Sudo*\n\nUse: *.sudo del @user*\nOr reply to a message with: *.sudo del*',
                    contextInfo: {
                        externalAdReply: {
                            title: "Remove Sudo User",
                            body: "Mention or reply to user",
                            thumbnailUrl: "https://files.catbox.moe/j06ubl.jpg"
                        }
                    }
                });
            }
            break;
    }
}

module.exports = {
    sudoCommand,
    handleSudoButton,
    isPrivileged
};
