const fs = require('fs');
const path = require('path');
const { channelInfo } = require('../lib/messageConfig');

// --- Fichier pour sauvegarder l'état global ---
const welcomeFile = path.join(__dirname, '../data/globalWelcome.json');
let globalWelcome = false;

// Images personnalisées fournies par toi
const customImages = [
  'https://images.iimg.live/images/wonderful-creation-1886.webp',
  'https://images.iimg.live/images/vibrant-gallery-4281.webp',
  'https://images.iimg.live/images/vibrant-gallery-4281.webp'
];

// --- Charger l'état au démarrage ---
function loadWelcomeStatus() {
  if (fs.existsSync(welcomeFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(welcomeFile, 'utf8'));
      globalWelcome = !!data.enabled;
    } catch { globalWelcome = false; }
  }
}

// --- Sauvegarder l'état ---
function saveWelcomeStatus() {
  fs.writeFileSync(welcomeFile, JSON.stringify({ enabled: globalWelcome }, null, 2));
}

// --- Activer / désactiver ---
function setWelcome(status) {
  globalWelcome = !!status;
  saveWelcomeStatus();
}

function isWelcomeOn() {
  return globalWelcome;
}

// --- Génération du menu complet ---
function generateWelcomeMenu(displayName, groupName, groupSize, groupDesc) {
  const now = new Date();
  const dateStr = now.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });

  return `
╔═〔 ❀ *QuEeN Ai WELCOME* ✿ 〕═╗
┃       𝑽𝒆𝒓𝒔𝒊𝒐𝒏 • 3.0.6 ⚙️
╚═━━───────────━━━═╝

╭━〔 📡 *GENERAL INFO* 〕━╮
┃ 👤 User        : @${displayName}
┃ 🏰 Group       : ${groupName}
┃ 👥 Members   : ${groupSize}
┃ 📜 Desc        : ${groupDesc}
╰━━━━━━━━━━━━━━━━━━━╯
© *Black~~King*
`;
}

// --- Newsletter context ---
const newsletterContext = (imageUrl) => ({
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363421176303484@newsletter',
    newsletterName: '༺✿ ǫᴜᴇᴇɴ ᴀɪ ✿༻',
    serverMessageId: Math.floor(Math.random() * 1000)
  },
  externalAdReply: {
    title: "༺✿ ǫᴜᴇᴇɴ ᴀɪ ✿༻",
    body: "I am The best QuEeN",
    thumbnailUrl: imageUrl,
    mediaType: 1,
    renderLargerThumbnail: true,
    sourceUrl: "https://whatsapp.com/channel/0029VbBYMyZIyPtOEnuT0S04"
  }
});

// --- Événement join global ---
async function handleJoinEvent(sock, chatId, participants) {
  if (!isWelcomeOn()) return;

  const groupMetadata = await sock.groupMetadata(chatId);
  const groupName = groupMetadata.subject;
  const groupDesc = groupMetadata.desc || "No description available";
  const groupSize = groupMetadata.participants.length;

  for (const participant of participants) {
    try {
      const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
      let displayName = participantString.split('@')[0];

      // Récupérer le vrai nom si possible
      try {
        const contact = await sock.getBusinessProfile(participantString);
        if (contact?.name) displayName = contact.name;
        else {
          const userParticipant = groupMetadata.participants.find(p => p.id === participantString);
          if (userParticipant?.name) displayName = userParticipant.name;
        }
      } catch {}

      const finalMessage = generateWelcomeMenu(displayName, groupName, groupSize, groupDesc);

      // Choisir une image aléatoire parmi tes images personnalisées
      let menuImage = customImages[Math.floor(Math.random() * customImages.length)];

      // Essayer la photo de profil du groupe comme fallback
      try {
        const pic = await sock.profilePictureUrl(chatId, 'image');
        if (pic) menuImage = pic;
      } catch {}

      // Envoi du message
      await sock.sendMessage(chatId, {
        image: { url: menuImage },
        caption: finalMessage,
        mentions: [participantString],
        contextInfo: newsletterContext(menuImage),
        ...channelInfo
      });

    } catch (err) {
      console.error('Error sending welcome:', err);
      const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
      await sock.sendMessage(chatId, { text: `Welcome @${participantString}!`, mentions: [participantString], ...channelInfo });
    }
  }
}

// --- Commande welcome ---
async function welcomeCommand(sock, chatId, message) {
  const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
  const args = text.trim().split(' ').slice(1);

  if (args[0]?.toLowerCase() === 'on') {
    setWelcome(true);
    await sock.sendMessage(chatId, { text: '✅ GLOBAL WELCOME ENABLED — Active in ALL groups.' });

  } else if (args[0]?.toLowerCase() === 'off') {
    setWelcome(false);
    await sock.sendMessage(chatId, { text: '❌ GLOBAL WELCOME DISABLED — Stopped in ALL groups.' });

  } else if (args[0]?.toLowerCase() === 'test') {
    await handleJoinEvent(sock, chatId, [message.key?.participant]);

  } else {
    await sock.sendMessage(chatId, {
      text: 'Usage:\n/welcome on - enable global welcome\n/welcome off - disable global welcome\n/welcome test - test welcome menu'
    });
  }
}

// --- Initialiser au démarrage ---
loadWelcomeStatus();

module.exports = { handleJoinEvent, welcomeCommand, setWelcome, isWelcomeOn, customImages };