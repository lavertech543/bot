const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// Queen images for tag
const TAG_IMAGES = [
    'https://image2url.com/r2/default/images/1771163754571-712042ba-7a6a-44eb-8cdf-6ed83487949d.jpg'
];

const getRandomImage = () => TAG_IMAGES[Math.floor(Math.random() * TAG_IMAGES.length)];

function speak(type, message) {
    const responses = {
        success: `✦ ${message} | My word spreads.`,
        error: `✗ ${message} | The message fades into shadow.`,
        info: `◈ ${message} | Hear my decree.`
    };
    return responses[type] || message;
}

async function downloadMediaMessage(message, mediaType) {
    try {
        const stream = await downloadContentFromMessage(message, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        const tempDir = path.join(__dirname, '../temp/');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `${Date.now()}.${mediaType === 'document' ? 'bin' : mediaType}`);
        fs.writeFileSync(filePath, buffer);
        setTimeout(() => {
            try { fs.unlinkSync(filePath); } catch {}
        }, 300000);
        return filePath;
    } catch (err) {
        console.error('Media download error:', err);
        return null;
    }
}

// MAIN TAG COMMAND - NO ADMIN REQUIRED
async function tagCommand(sock, chatId, senderId, messageText, replyMessage, message) {
    try {
        // Validate message object exists
        if (!message || !message.key) {
            console.error('Tag error: Invalid message object');
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
        
        if (!participants.length) {
            await sock.sendMessage(chatId, {
                image: { url: getRandomImage() },
                caption: speak('error', 'No subjects to receive my message.'),
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

        const mentionedJidList = participants.map(p => p.id);
        let messageContent = {};

        // Handle replied message
        if (replyMessage) {
            // Image reply
            if (replyMessage.imageMessage) {
                const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
                if (filePath) {
                    messageContent = {
                        image: { url: filePath },
                        caption: messageText || replyMessage.imageMessage.caption || speak('info', 'Witness this image.'),
                        mentions: mentionedJidList,
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363421176303484@newsletter',
                                newsletterName: '༺『Q』『U』『E』『E』『N』 ❀『A』『i』༻',
                                serverMessageId: -1
                            },
                            externalAdReply: {
                                title: "👑 Royal Image",
                                body: `Tagged ${participants.length} subjects`,
                                thumbnailUrl: getRandomImage()
                            }
                        }
                    };
                }
            }
            // Video reply
            else if (replyMessage.videoMessage) {
                const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
                if (filePath) {
                    messageContent = {
                        video: { url: filePath },
                        caption: messageText || replyMessage.videoMessage.caption || speak('info', 'Behold this vision.'),
                        mentions: mentionedJidList,
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363421176303484@newsletter',
                                newsletterName: '༺『Q』『U』『E』『E』『N』 ❀『A』『i』༻',
                                serverMessageId: -1
                            },
                            externalAdReply: {
                                title: "👑 Royal Video",
                                body: `Tagged ${participants.length} subjects`,
                                thumbnailUrl: getRandomImage()
                            }
                        }
                    };
                }
            }
            // Audio/Voice reply
            else if (replyMessage.audioMessage) {
                const filePath = await downloadMediaMessage(replyMessage.audioMessage, 'audio');
                if (filePath) {
                    messageContent = {
                        audio: { url: filePath },
                        mimetype: 'audio/mp4',
                        ptt: replyMessage.audioMessage.ptt || false,
                        caption: messageText,
                        mentions: mentionedJidList,
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363421176303484@newsletter',
                                newsletterName: '༺『Q』『U』『E』『E』『N』 ❀『A』『i』༻',
                                serverMessageId: -1
                            }
                        }
                    };
                }
            }
            // Document reply
            else if (replyMessage.documentMessage) {
                const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
                if (filePath) {
                    messageContent = {
                        document: { url: filePath },
                        fileName: replyMessage.documentMessage.fileName || 'document',
                        mimetype: replyMessage.documentMessage.mimetype,
                        caption: messageText || speak('info', 'Receive this document.'),
                        mentions: mentionedJidList,
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363421176303484@newsletter',
                                newsletterName: '༺『Q』『U』『E』『E』『N』 ❀『A』『i』༻',
                                serverMessageId: -1
                            },
                            externalAdReply: {
                                title: "👑 Royal Document",
                                body: `Tagged ${participants.length} subjects`,
                                thumbnailUrl: getRandomImage()
                            }
                        }
                    };
                }
            }
            // Sticker reply
            else if (replyMessage.stickerMessage) {
                const filePath = await downloadMediaMessage(replyMessage.stickerMessage, 'image');
                if (filePath) {
                    messageContent = {
                        sticker: { url: filePath },
                        mentions: mentionedJidList,
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363421176303484@newsletter',
                                newsletterName: '༺『Q』『U』『E』『E』『N』 ❀『A』『i』༻',
                                serverMessageId: -1
                            }
                        }
                    };
                }
            }
            // Text reply
            else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
                const originalText = replyMessage.conversation || replyMessage.extendedTextMessage?.text || '';
                messageContent = {
                    text: `${speak('info', 'Hear these words:')}\n\n${originalText}${messageText ? '\n\n👑 ' + messageText : ''}`,
                    mentions: mentionedJidList,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363421176303484@newsletter',
                            newsletterName: '༺『Q』『U』『E』『E』『N』 ❀『A』『i』༻',
                            serverMessageId: -1
                        },
                        externalAdReply: {
                            title: "👑 Royal Decree",
                            body: `Tagged ${participants.length} subjects`,
 },
                        externalAdReply: {
                            title: "👑 Royal Decree",
                            body: `Tagged ${participants.length} subjects`,
                            thumbnailUrl: getRandomImage()
                        }
                    }
                };
            }
        } 
        // No reply - just text with image
        else {
            messageContent = {
                image: { url: getRandomImage() },
                caption: messageText || speak('info', 'My subjects, gather!'),
                mentions: mentionedJidList,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363421176303484@newsletter',
                        newsletterName: '༺『Q』『U』『E』『E』『N』 ❀『A』『i』༻',
                        serverMessageId: -1
                    },
                    externalAdReply: {
                        title: "👑 Queen Tag",
                        body: `Summoned ${participants.length} subjects`,
                        thumbnailUrl: getRandomImage(),
                        mediaType: 1,
                        renderLargerThumbnail: true,
                        sourceUrl: "https://wa.me/237659262653"
                    }
                }
            };
        }

        // Send message if content exists
        if (Object.keys(messageContent).length > 0) {
            await sock.sendMessage(chatId, messageContent, { quoted: message });
        } else {
            throw new Error('Could not process message content');
        }

    } catch (error) {
        console.error('Tag error:', error);
        // Safe error response
        try {
            if (message && message.key) {
                await sock.sendMessage(chatId, {
                    image: { url: getRandomImage() },
                    caption: speak('error', 'The tag ritual failed. The shadows reject it.'),
                    contextInfo: {
                        externalAdReply: {
                            title: "⚠️ Tag Failed",
                            body: "Error executing command",
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

module.exports = tagCommand;
