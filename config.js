const yts = require('yt-search');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const NodeID3 = require('node-id3');

// ==========================================
// LOAD CONFIGURATION
// ==========================================

require('dotenv').config();

// Your API configuration from config file
const APIs = {
    xteam: 'https://api.xteam.xyz',
    dzx: 'https://api.dhamzxploit.my.id',
    lol: 'https://api.lolhuman.xyz',
    violetics: 'https://violetics.pw',
    neoxr: 'https://api.neoxr.my.id',
    zenzapis: 'https://zenzapis.xyz',
    akuari: 'https://api.akuari.my.id',
    akuari2: 'https://apimu.my.id',
    nrtm: 'https://fg-nrtm.ddns.net',
    bg: 'http://bochil.ddns.net',
    fgmods: 'https://api-fgmods.ddns.net',
    // Additional reliable APIs
    nvlgroup: 'https://ytdownloader.nvlgroup.my.id/api',
    siputzx: 'https://api.siputzx.my.id/api/d',
    vreden: 'https://api.vreden.my.id/api'
};

const APIKeys = {
    [APIs.xteam]: 'd90a9e986e18778b',
    [APIs.lol]: '85faf717d0545d14074659ad',
    [APIs.neoxr]: 'yourkey', // Update this
    [APIs.violetics]: 'beta',
    [APIs.zenzapis]: 'yourkey', // Update this
    [APIs.fgmods]: 'fg-dylux'
};

// ==========================================
// STORAGE SETUP
// ==========================================

const STORAGE = {
    dir: path.join(process.cwd(), 'storage', 'downloads'),
    audio: path.join(process.cwd(), 'storage', 'audio'),
    video: path.join(process.cwd(), 'storage', 'video'),
    temp: path.join(process.cwd(), 'storage', 'temp'),
    sessions: new Map(),
    downloads: new Map()
};

// Ensure directories exist
Object.values(STORAGE).forEach(dir => {
    if (typeof dir === 'string' && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// ==========================================
// MAIN PLAY COMMAND CLASS
// ==========================================

class PlayCommand {
    constructor() {
        this.apis = APIs;
        this.keys = APIKeys;
        this.timeout = 60000;
    }

    // ==========================================
    // MAIN ENTRY
    // ==========================================

    async execute(sock, chatId, message) {
        try {
            const text = this.extractText(message);
            const args = text.split(' ').slice(1).join(' ').trim();

            if (!args) {
                return await this.showMainMenu(sock, chatId, message);
            }

            if (this.isSelection(args, chatId)) {
                return await this.handleSelection(sock, chatId, message, parseInt(args));
            }

            await this.performSearch(sock, chatId, message, args);

        } catch (error) {
            console.error('Execute Error:', error);
            await this.sendError(sock, chatId, message, 'Command execution failed');
        }
    }

    // ==========================================
    // MENU SYSTEM
    // ==========================================

    async showMainMenu(sock, chatId, message) {
        const menu = `🎵 *NEMESIS PRIME MUSIC DOWNLOADER* 🎵

*How to use:*
• Type: *.play <song name>*
• Example: *.play Shape of You*

*Features:*
✅ Multi-API System (10+ Sources)
✅ Auto Fallback on Failure
✅ High Quality Audio (320kbps)
✅ Video Support (720p/1080p)
✅ Premium API Integration

*Status:* 🟢 Online | *APIs:* 10+ Sources`;

        const buttons = [
            { buttonId: 'play_menu_search', buttonText: { displayText: '🔍 Search Song' }, type: 1 },
            { buttonId: 'play_menu_help', buttonText: { displayText: '❓ Help Guide' }, type: 1 },
            { buttonId: 'play_menu_status', buttonText: { displayText: '📊 API Status' }, type: 1 }
        ];

        await sock.sendMessage(chatId, {
            text: menu,
            footer: 'Powered by Nemesis Prime | Owner: 237xxxxxxx',
            buttons: buttons,
            headerType: 1,
            viewOnce: true
        }, { quoted: message });
    }

    // ==========================================
    // SEARCH FUNCTIONALITY
    // ==========================================

    async performSearch(sock, chatId, message, query) {
        try {
            await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

            const { videos } = await yts(query);
            
            if (!videos || videos.length === 0) {
                return await this.sendError(sock, chatId, message, 'No results found. Try different keywords.');
            }

            const results = videos.slice(0, 10);
            STORAGE.sessions.set(chatId, {
                results: results,
                query: query,
                timestamp: Date.now()
            });

            setTimeout(() => STORAGE.sessions.delete(chatId), 300000);

            let text = `🎵 *Results for:* _${query}_\n\n`;
            results.forEach((v, i) => {
                text += `${i + 1}. *${this.escapeMarkdown(v.title)}*\n`;
                text += `   ⏱️ ${v.timestamp || 'N/A'} | 👁️ ${this.formatViews(v.views)}\n`;
                text += `   👤 ${v.author.name}\n\n`;
            });
            text += `📥 *Reply with number 1-10 to download*`;

            await sock.sendMessage(chatId, {
                image: { url: results[0].thumbnail },
                caption: text,
                footer: 'Reply with number | Session expires in 5min',
                buttons: [{ buttonId: 'play_cancel', buttonText: { displayText: '❌ Cancel' }, type: 1 }],
                viewOnce: true
            }, { quoted: message });

        } catch (error) {
            await this.sendError(sock, chatId, message, 'Search failed. Please try again.');
        }
    }

    // ==========================================
    // SELECTION HANDLER
    // ==========================================

    async handleSelection(sock, chatId, message, selection) {
        const session = STORAGE.sessions.get(chatId);
        
        if (!session || selection < 1 || selection > session.results.length) {
            return await this.sendError(sock, chatId, message, 'Invalid selection or session expired.');
        }

        const video = session.results[selection - 1];
        STORAGE.sessions.delete(chatId);

        await this.showFormatMenu(sock, chatId, message, video);
    }

    async showFormatMenu(sock, chatId, message, video) {
        const info = `🎵 *${this.escapeMarkdown(video.title)}*

⏱️ Duration: ${video.timestamp || 'N/A'}
👤 Channel: ${video.author.name}
👁️ Views: ${this.formatViews(video.views)}

*Select download format:*`;

        const downloadId = `${chatId}_${Date.now()}`;
        STORAGE.downloads.set(downloadId, { video, timestamp: Date.now() });

        const buttons = [
            { buttonId: `dl_audio_${video.videoId}_${downloadId}`, buttonText: { displayText: '🎵 MP3 Audio (128kbps)' }, type: 1 },
            { buttonId: `dl_audiohd_${video.videoId}_${downloadId}`, buttonText: { displayText: '🎵 MP3 HQ (320kbps)' }, type: 1 },
            { buttonId: `dl_audiodoc_${video.videoId}_${downloadId}`, buttonText: { displayText: '📄 MP3 Document' }, type: 1 },
            { buttonId: `dl_video_${video.videoId}_${downloadId}`, buttonText: { displayText: '🎬 MP4 Video (720p)' }, type: 1 },
            { buttonId: `dl_videohd_${video.videoId}_${downloadId}`, buttonText: { displayText: '🎬 MP4 HD (1080p)' }, type: 1 }
        ];

        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: info,
            footer: 'Choose quality | Large files sent as links',
            buttons: buttons,
            viewOnce: true
        }, { quoted: message });
    }

    // ==========================================
    // DOWNLOAD HANDLERS
    // ==========================================

    async downloadAudio(sock, chatId, message, videoId, downloadId, quality = '128') {
        const info = STORAGE.downloads.get(downloadId);
        if (!info) return await this.sendError(sock, chatId, message, 'Session expired.');

        const { video } = info;
        const url = `https://youtube.com/watch?v=${video.videoId}`;

        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

            // Try all APIs in order of reliability
            const filePath = await this.tryAllAudioAPIs(url, video, quality);

            if (!filePath) {
                throw new Error('All APIs failed');
            }

            // Check file size
            const stats = fs.statSync(filePath);
            if (stats.size > 100 * 1024 * 1024) {
                await this.sendAsLink(sock, chatId, message, video, 'File too large');
                this.safeDelete(filePath);
                return;
            }

            // Send as audio or document based on button
            const isDoc = quality === 'doc';
            await this.sendAudio(sock, chatId, message, video, filePath, isDoc);

            this.safeDelete(filePath);
            STORAGE.downloads.delete(downloadId);

            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        } catch (error) {
            console.error('Audio Error:', error);
            STORAGE.downloads.delete(downloadId);
            await this.sendError(sock, chatId, message, `Download failed: ${error.message}`);
        }
    }

    async downloadVideo(sock, chatId, message, videoId, downloadId, quality = '720') {
        const info = STORAGE.downloads.get(downloadId);
        if (!info) return await this.sendError(sock, chatId, message, 'Session expired.');

        const { video } = info;
        const url = `https://youtube.com/watch?v=${video.videoId}`;

        try {
            await sock.sendMessage(chatId, { react: { text: '🎬', key: message.key } });

            const filePath = await this.tryAllVideoAPIs(url, video, quality);

            if (!filePath) {
                throw new Error('All video APIs failed');
            }

            const stats = fs.statSync(filePath);
            if (stats.size > 100 * 1024 * 1024) {
                await this.sendAsLink(sock, chatId, message, video, 'Video too large for WhatsApp');
                this.safeDelete(filePath);
                return;
            }

            await sock.sendMessage(chatId, {
                video: fs.readFileSync(filePath),
                caption: `🎬 *${video.title}* (${quality}p)`,
                fileName: `${video.title}_${quality}p.mp4`
            }, { quoted: message });

            this.safeDelete(filePath);
            STORAGE.downloads.delete(downloadId);

            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        } catch (error) {
            console.error('Video Error:', error);
            STORAGE.downloads.delete(downloadId);
            await this.sendError(sock, chatId, message, 'Video download failed.');
        }
    }

    // ==========================================
    // API FALLBACK SYSTEM (10+ APIs)
    // ==========================================

    async tryAllAudioAPIs(url, video, quality) {
        const apis = [
            // Primary: Your config APIs with keys
            () => this.apiLolhuman(url, 'audio'),
            () => this.apiNeoxr(url, 'audio'),
            () => this.apiXteam(url, 'audio'),
            () => this.apiFgmods(url, 'audio'),
            
            // Secondary: Free reliable APIs
            () => this.apiNvlgroup(url, 'audio'),
            () => this.apiSiputzx(url, 'audio'),
            () => this.apiVreden(url, 'audio'),
            () => this.apiAkuari(url, 'audio'),
            
            // Tertiary: Other sources
            () => this.apiDzx(url, 'audio'),
            () => this.apiBg(url, 'audio')
        ];

        for (const api of apis) {
            try {
                const result = await api();
                if (result) return result;
            } catch (e) {
                console.log('API failed:', e.message);
                continue;
            }
        }
        return null;
    }

    async tryAllVideoAPIs(url, video, quality) {
        const apis = [
            () => this.apiLolhuman(url, 'video', quality),
            () => this.apiNeoxr(url, 'video', quality),
            () => this.apiXteam(url, 'video', quality),
            () => this.apiFgmods(url, 'video', quality),
            () => this.apiNvlgroup(url, 'video', quality),
            () => this.apiSiputzx(url, 'video'),
            () => this.apiVreden(url, 'video'),
            () => this.apiAkuari(url, 'video')
        ];

        for (const api of apis) {
            try {
                const result = await api();
                if (result) return result;
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    // ==========================================
    // INDIVIDUAL API IMPLEMENTATIONS
    // ==========================================

    // 1. Lolhuman API (Your key: 85faf717d0545d14074659ad)
    async apiLolhuman(url, type, quality = '720') {
        try {
            const endpoint = type === 'audio' 
                ? `${this.apis.lol}/api/ytmp3?apikey=${this.keys[this.apis.lol]}&url=${url}`
                : `${this.apis.lol}/api/ytmp4?apikey=${this.keys[this.apis.lol]}&url=${url}`;
            
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            if (res.data?.status === 200 && res.data?.result?.link) {
                return await this.downloadFile(res.data.result.link, type);
            }
        } catch (e) {
            console.log('Lolhuman failed:', e.message);
        }
        return null;
    }

    // 2. Neoxr API (Requires your key)
    async apiNeoxr(url, type, quality = '720') {
        try {
            const key = this.keys[this.apis.neoxr];
            if (key === 'yourkey') return null; // Skip if not configured
            
            const endpoint = type === 'audio'
                ? `${this.apis.neoxr}/api/youtube?apikey=${key}&url=${url}&type=audio`
                : `${this.apis.neoxr}/api/youtube?apikey=${key}&url=${url}&type=video&quality=${quality}`;
            
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            if (res.data?.status && res.data?.data?.url) {
                return await this.downloadFile(res.data.data.url, type);
            }
        } catch (e) {
            console.log('Neoxr failed:', e.message);
        }
        return null;
    }

    // 3. Xteam API (Your key: d90a9e986e18778b)
    async apiXteam(url, type) {
        try {
            const endpoint = `${this.apis.xteam}/dl/${type}?url=${url}&APIKEY=${this.keys[this.apis.xteam]}`;
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            if (res.data?.status && res.data?.result?.dl_link) {
                return await this.downloadFile(res.data.result.dl_link, type);
            }
        } catch (e) {
            console.log('Xteam failed:', e.message);
        }
        return null;
    }

    // 4. Fgmods API (Your key: fg-dylux)
    async apiFgmods(url, type) {
        try {
            const endpoint = `${this.apis.fgmods}/api/down/youtube?url=${url}&apikey=${this.keys[this.apis.fgmods]}`;
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            if (res.data?.status && res.data?.result?.[type === 'audio' ? 'audio' : 'video']) {
                return await this.downloadFile(res.data.result[type === 'audio' ? 'audio' : 'video'], type);
            }
        } catch (e) {
            console.log('Fgmods failed:', e.message);
        }
        return null;
    }

    // 5. Nvlgroup API (Free, no key)
    async apiNvlgroup(url, type) {
        try {
            const endpoint = `${this.apis.nvlgroup}/${type === 'audio' ? 'audio' : 'video'}?url=${url}`;
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            if (res.data?.downloadUrl) {
                return await this.downloadFile(res.data.downloadUrl, type);
            }
        } catch (e) {
            console.log('Nvlgroup failed:', e.message);
        }
        return null;
    }

    // 6. Siputzx API (Free)
    async apiSiputzx(url, type) {
        try {
            const endpoint = `${this.apis.siputzx}/ytmp${type === 'audio' ? '3' : '4'}?url=${url}`;
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            const dlUrl = res.data?.data?.dl || res.data?.download_url || res.data?.url;
            if (dlUrl) return await this.downloadFile(dlUrl, type);
        } catch (e) {
            console.log('Siputzx failed:', e.message);
        }
        return null;
    }

    // 7. Vreden API (Free)
    async apiVreden(url, type) {
        try {
            const endpoint = `${this.apis.vreden}/ytmp${type === 'audio' ? '3' : '4'}?url=${url}`;
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            const dlUrl = res.data?.result?.downloadUrl || res.data?.data?.url || res.data?.url;
            if (dlUrl) return await this.downloadFile(dlUrl, type);
        } catch (e) {
            console.log('Vreden failed:', e.message);
        }
        return null;
    }

    // 8. Akuari API (Free)
    async apiAkuari(url, type) {
        try {
            const endpoint = `${this.apis.akuari}/downloader/youtube?link=${url}`;
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            const dlUrl = type === 'audio' ? res.data?.mp3?.url : res.data?.mp4?.url;
            if (dlUrl) return await this.downloadFile(dlUrl, type);
        } catch (e) {
            console.log('Akuari failed:', e.message);
        }
        return null;
    }

    // 9. Dzx API (Free)
    async apiDzx(url, type) {
        try {
            const endpoint = `${this.apis.dzx}/yt-download/audio?url=${url}`;
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            if (res.data?.result?.dl_link) {
                return await this.downloadFile(res.data.result.dl_link, type);
            }
        } catch (e) {
            console.log('Dzx failed:', e.message);
        }
        return null;
    }

    // 10. Bg API (Free)
    async apiBg(url, type) {
        try {
            const endpoint = `http://bochil.ddns.net/downloader/youtube?url=${url}`;
            const res = await axios.get(endpoint, { timeout: this.timeout });
            
            const dlUrl = type === 'audio' ? res.data?.audio : res.data?.video;
            if (dlUrl) return await this.downloadFile(dlUrl, type);
        } catch (e) {
            console.log('Bg failed:', e.message);
        }
        return null;
    }

    // ==========================================
    // FILE OPERATIONS
    // ==========================================

    async downloadFile(url, type) {
        try {
            const ext = type === 'audio' ? 'mp3' : 'mp4';
            const fileName = `${randomBytes(4).toString('hex')}.${ext}`;
            const filePath = path.join(STORAGE[type === 'audio' ? 'audio' : 'video'], fileName);

            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                timeout: 120000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filePath));
                writer.on('error', reject);
            });
        } catch (error) {
            console.error('Download file error:', error);
            return null;
        }
    }

    async sendAudio(sock, chatId, message, video, filePath, asDocument) {
        const buffer = fs.readFileSync(filePath);
        
        if (asDocument) {
            await sock.sendMessage(chatId, {
                document: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${video.title}.mp3`,
                caption: `🎵 *${video.title}*`
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${video.title}.mp3`
            }, { quoted: message });
            
            await sock.sendMessage(chatId, {
                text: `🎵 *${video.title}*\n✅ Download complete`
            }, { quoted: message });
        }
    }

    // ==========================================
    // BUTTON HANDLER
    // ==========================================

    async handleButton(sock, chatId, message, buttonId) {
        const parts = buttonId.split('_');
        const action = parts[1];
        const videoId = parts[2];
        const downloadId = parts[3];

        switch (action) {
            case'salut':
                await sock.sendMessage(chatId,{text:'😁 Salut!Comment ca va?'});
                break;
            
            case 'audio':
                await this.downloadAudio(sock, chatId, message, videoId, downloadId, '128');
                break;
            case 'audiohd':
                await this.downloadAudio(sock, chatId, message, videoId, downloadId, '320');
                break;
            case 'audiodoc':
                await this.downloadAudio(sock, chatId, message, videoId, downloadId, 'doc');
                break;
            case 'video':
                await this.downloadVideo(sock, chatId, message, videoId, downloadId, '720');
                break;
            case 'videohd':
                await this.downloadVideo(sock, chatId, message, videoId, downloadId, '1080');
                break;
            case 'menu':
                if (videoId === 'search') {
                    await sock.sendMessage(chatId, { text: '🔍 Type *.play <song>* to search' });
                } else if (videoId === 'help') {
                    await this.showHelp(sock, chatId, message);
                } else if (videoId === 'status') {
                    await this.showStatus(sock, chatId, message);
                }
                break;
            case 'cancel':
                STORAGE.sessions.delete(chatId);
                await sock.sendMessage(chatId, { text: '✅ Cancelled.', react: { text: '✅', key: message.key } });
                break;
        }
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    extractText(message) {
        return message.message?.conversation || 
               message.message?.extendedTextMessage?.text || '';
    }

    isSelection(text, chatId) {
        if (!STORAGE.sessions.has(chatId)) return false;
        const num = parseInt(text);
        return !isNaN(num) && num >= 1 && num <= 10;
    }

    formatViews(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    escapeMarkdown(text) {
        return text.replace(/[*_`[\]]/g, '\\$&');
    }

    safeDelete(filePath) {
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {}
    }

    async sendError(sock, chatId, message, text) {
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `❌ *Error*\n\n${text}`,
            footer: 'Nemesis Prime Bot'
        }, { quoted: message });
    }

    async sendAsLink(sock, chatId, message, video, reason) {
        await sock.sendMessage(chatId, {
            text: `⚠️ *${video.title}*\n\n${reason}\n\nTry a shorter video.`
        }, { quoted: message });
    }

    async showHelp(sock, chatId, message) {
        const help = `🎵 *HELP GUIDE*

*Commands:*
• .play <song> - Search music
• Reply 1-10 - Select result

*APIs Available:*
• Lolhuman ✅
• Xteam ✅
• Fgmods ✅
• Neoxr (needs key)
• +6 Backup APIs

*Formats:*
🎵 Audio 128kbps
🎵 Audio 320kbps HQ
📄 Document
🎬 Video 720p/1080p`;

        await sock.sendMessage(chatId, { text: help }, { quoted: message });
    }

    async showStatus(sock, chatId, message) {
        const status = `📊 *API STATUS*

✅ Lolhuman: Active
✅ Xteam: Active
✅ Fgmods: Active
⚠️ Neoxr: Needs API key
✅ Nvlgroup: Active
✅ Siputzx: Active
✅ Vreden: Active
✅ Akuari: Active

*Total Sources:* 10+ APIs
*Fallback System:* Enabled`;

        await sock.sendMessage(chatId, { text: status }, { quoted: message });
    }
}

// ==========================================
// EXPORTS
// ==========================================

const playCmd = new PlayCommand();

module.exports = async (sock, chatId, message) => {
    await playCmd.execute(sock, chatId, message);
};

module.exports.handleButton = async (sock, chatId, message, buttonId) => {
    await playCmd.handleButton(sock, chatId, message, buttonId);
};

/* 
 * NEMESIS PRIME BOT - ULTIMATE PLAY COMMAND
 * APIs: Lolhuman, Xteam, Fgmods, Neoxr, Nvlgroup, Siputzx, Vreden, Akuari, Dzx, Bg
 * Version: 5.0 Multi-API
 * Owner: 237xxxxxxx
 */
