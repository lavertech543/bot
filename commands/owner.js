// Hardcoded Dev Owner - NEVER CHANGE THIS
const DEV_OWNER = {
    number: '237678631351',
    name: 'LAVERDURE WAKO',
    jid: '237678631351@s.whatsapp.net',
    level: 'dev'
};

// Import settings ONLY for bot metadata (name, etc), NOT for owner check
const settings = require('../settings');

// Check privilege level - HARDCODED DEV CHECK
async function checkPrivilege(senderId) {
    const cleanNumber = senderId.replace(/[^0-9]/g, '');
    
    // DEV CHECK - Hardcoded, cannot be bypassed via settings
    if (cleanNumber === DEV_OWNER.number) {
        return { level: 'dev', data: DEV_OWNER, fullAccess: true };
    }
    
    // OWNER CHECK - From settings (for the person hosting the bot)
    const botOwnerNumber = settings.ownerNumber ? settings.ownerNumber.replace(/[^0-9]/g, '') : '';
    if (cleanNumber === botOwnerNumber) {
        return { 
            level: 'owner', 
            data: {
                number: settings.ownerNumber,
                name: settings.botOwner || 'Bot Owner',
                jid: settings.ownerNumber + '@s.whatsapp.net'
            }, 
            fullAccess: true 
        };
    }
    
    return { level: 'user', data: null, fullAccess: false };
}

// Generate vCard format
function generateVCard(name, number) {
    return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;waid=${number}:${number}\nEND:VCARD`;
}

async function ownerCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const privilege = await checkPrivilege(senderId);
        
        // Prepare contacts
        const contacts = [];
        const descriptions = [];
        
        // 1. DEV OWNER (You) - Always shown first
        contacts.push({
            displayName: DEV_OWNER.name,
            vcard: generateVCard(DEV_OWNER.name, DEV_OWNER.number)
        });
        descriptions.push(`🔥 *DEVELOPER*\n   ${DEV_OWNER.name}\n   📞 ${DEV_OWNER.number}`);
        
        // 2. BOT OWNER (from settings) - Only if different from dev
        const botOwnerNumber = settings.ownerNumber ? settings.ownerNumber.replace(/[^0-9]/g, '') : '';
        if (botOwnerNumber && botOwnerNumber !== DEV_OWNER.number) {
            const ownerName = settings.botOwner || 'Bot Owner';
            contacts.push({
                displayName: ownerName,
                vcard: generateVCard(ownerName, settings.ownerNumber)
            });
            descriptions.push(`⭐ *BOT OWNER*\n   ${ownerName}\n   📞 ${settings.ownerNumber}`);
        }
        
        // Determine response based on who is asking
        let headerText = '';
        let footerText = '';
        let buttons = [];
        
        if (privilege.level === 'dev') {
            headerText = `👑 *WELCOME BACK, CREATOR*\n\nYou have *SUPREME ACCESS* to Nemesis Prime.`;
            footerText = `\n🔥 *Dev Mode Active*\nNo restrictions apply.`;
            buttons = [
                { buttonId: 'dev_panel', buttonText: { displayText: '⚡ DEV PANEL' }, type: 1 },
                { buttonId: 'broadcast', buttonText: { displayText: '📢 BROADCAST' }, type: 1 },
                { buttonId: 'server_stats', buttonText: { displayText: '💻 SERVER' }, type: 1 }
            ];
        } else if (privilege.level === 'owner') {
            headerText = `⭐ *WELCOME, BOT OWNER*\n\nYou have *FULL CONTROL* of this instance.`;
            footerText = `\n⚡ *Owner Mode*\nManage your bot freely.`;
            buttons = [
                { buttonId: 'owner_panel', buttonText: { displayText: '⚙️ OWNER PANEL' }, type: 1 },
                { buttonId: 'sudo_manage', buttonText: { displayText: '👥 MANAGE SUDO' }, type: 1 }
            ];
        } else {
            headerText = `ℹ️ *BOT OWNERSHIP*\n\nContact the appropriate person for support.`;
            footerText = `\n💡 This bot is powered by Nemesis Prime.`;
        }
        
        // Send premium message
        await sock.sendMessage(chatId, {
            text: `${headerText}\n\n${descriptions.join('\n\n')}${footerText}`,
            contacts: {
                displayName: DEV_OWNER.name,
                contacts: contacts.map(c => ({ vcard: c.vcard }))
            },
            buttons: buttons,
            headerType: 1,
            contextInfo: {
                externalAdReply: {
                    title: privilege.level === 'dev' ? "🔥 SUPREME ACCESS" : 
                           privilege.level === 'owner' ? "⭐ OWNER ACCESS" : "Nemesis Prime",
                    body: "Multi-Owner System Active",
                    thumbnailUrl: "https://imgbob.net/jp6XI5FkA70EVvg",
                    sourceUrl: `https://wa.me/${DEV_OWNER.number}`
                }
            }
        }, { quoted: message });
        
    } catch (error) {
        console.error('❌ Owner Command Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ *Error*\n\nFailed to load owner information.',
            contextInfo: {
                externalAdReply: {
                    title: "Error",
                    body: "Command failed",
                    thumbnailUrl: "https://imgbob.net/c9xLvTQJ50Y0CJ6"
                }
            }
        }, { quoted: message });
    }
}

// Middleware for privilege checks - USE THIS IN OTHER COMMANDS
async function requirePrivilege(sock, chatId, message, minLevel = 'owner') {
    const senderId = message.key.participant || message.key.remoteJid;
    const privilege = await checkPrivilege(senderId);
    
    const levels = { 'user': 0, 'sudo': 1, 'owner': 2, 'dev': 3 };
    const required = levels[minLevel] || 2;
    const current = levels[privilege.level] || 0;
    
    if (current >= required) {
        return { granted: true, privilege };
    }
    
    await sock.sendMessage(chatId, {
        text: '⛔ *ACCESS DENIED*\n\nThis command requires elevated privileges.',
        contextInfo: {
            externalAdReply: {
                title: "❌ Permission Error",
                body: "Insufficient access level",
                thumbnailUrl: "https://imgbob.net/c9xLvTQJ50Y0CJ6"
            }
        }
    }, { quoted: message });
    
    return { granted: false, privilege: null };
}

// Quick checks for other commands
const isDev = (senderId) => senderId.replace(/[^0-9]/g, '') === DEV_OWNER.number;
const isOwner = async (senderId) => {
    const p = await checkPrivilege(senderId);
    return p.level === 'owner' || p.level === 'dev';
};
const isPrivileged = async (senderId) => {
    const p = await checkPrivilege(senderId);
    return p.fullAccess;
};

module.exports = {
    ownerCommand,
    checkPrivilege,
    requirePrivilege,
    isDev,
    isOwner,
    isPrivileged,
    DEV_OWNER // Export for emergency checks
};
