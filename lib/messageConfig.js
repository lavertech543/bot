// lib/messageConfig.js

const newsletterImages = [
  "https://image2url.com/r2/default/images/1771207782841-2a8b5fb7-515c-4b9e-956a-00b5e2b5c3af.jpg",
  "https://image2url.com/r2/default/images/1771163990900-fbd08407-933a-431f-97da-a92e1492e835.jpg",
  "https://images.iimg.live/images/majestic-picture-4524.webp",
  "https://images.iimg.live/images/brilliant-vision-1347.webp",
  "https://images.iimg.live/images/vibrant-snap-6317.webp",
  "https://images.iimg.live/images/awesome-vision-3637.webp",
  "https://images.iimg.live/images/wonderful-creation-1886.webp",
  "https://images.iimg.live/images/glorious-photo-6853.webp",
  "https://images.iimg.live/images/cool-memory-2726.webp",
  "https://images.iimg.live/images/excellent-photography-5234.webp",
  "https://images.iimg.live/images/glorious-view-3094.webp",
  "https://images.iimg.live/images/vibrant-gallery-4281.webp",
  "https://images.iimg.live/images/spectacular-picture-4156.webp",
  "https://images.iimg.live/images/supreme-gallery-2850.webp"
];
function getRandomNewsletterImage() {
  return newsletterImages[Math.floor(Math.random() * newsletterImages.length)];
}

const channelInfo = {
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: "120363421176303484@newsletter",
    newsletterName: "༺✿ ǫᴜᴇᴇɴ ᴀɪ ✿༻",
    serverMessageId: Math.floor(Math.random() * 10000)
  },
  externalAdReply: {
    title: "༺✿ ǫᴜᴇᴇɴ ᴀɪ ✿༻",
    body: "༺ I aM The BeSt Queen ༻",
    mediaType: 1,
    renderLargerThumbnail: true,
    thumbnailUrl: getRandomNewsletterImage(),
    sourceUrl: "https://whatsapp.com/channel/0029VbBYMyZIyPtOEnuT0S04"
  }
};

function newsletterContext(imageUrl) {
  const chosenImage = imageUrl || getRandomNewsletterImage();
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363421176303484@newsletter",
      newsletterName: "༺✿ ǫᴜᴇᴇɴ ᴀɪ ✿༻",
      serverMessageId: Math.floor(Math.random() * 10000)
    },
    externalAdReply: {
      title: "༺✿ ǫᴜᴇᴇɴ ᴀɪ ✿༻",
      body: "༺ I aM The BeSt Queen ༻",
      mediaType: 1,
      renderLargerThumbnail: true,
      thumbnailUrl: chosenImage,
      sourceUrl: "https://whatsapp.com/channel/0029VbBYMyZIyPtOEnuT0S04"
    }
  };
}

module.exports = {
  channelInfo,
  newsletterContext,
  getRandomNewsletterImage
};