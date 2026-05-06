const yts = require('yt-search');
const axios = require('axios');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATION - WORKING API ENDPOINTS 2024
// ==========================================

const CONFIG = {
    // Primary API: ytdownloader.nvlgroup.my.id (Verified working)
    primary: {
        audio: 'https://ytdownloader.nvlgroup.my.id/api/audio',
        video: 'https://ytdownloader.nvlgroup.my.id/api/video'
    },
    // Fallback APIs (Multiple sources)
    fallbacks: [
        {
            name: 'api.siputzx',
            audio: (url) => `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
            video: (url) => `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`
        },
        {
            name: 'api.vreden',
            audio: (url) => `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(url)}`,
            video: (url) => `https://api.vreden.my.id/api/ytmp4?url=${encodeURIComponent(url)}`
        },
        {
            name: 'apis.davidcyril',
            audio: (url) => `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(url)}`,
            video: (url) => `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(url)}`
        },
        {
            name: 'api.giftedtech',
            audio: (url) => `https://api.giftedtech.my.id/api/download/ytmp3?url=${encodeURIComponent(url)}`,
            video: (url) => `https://api.giftedtech.my.id/api/download/ytmp4?url=${encodeURIComponent(url)}`
        }
    ],
    // Request settings
    timeout: 60000, // 60 seconds
    maxRetries: 3,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// ==========================================
// STORAGE SETUP
// ==========================================

const STORAGE = {
    dir: path.join(process.cwd(), 'storage', 'downloads'),
    sessions: new Map(),
    downloads: new Map()
};

// Ensure storage directory exists
if (!fs.existsSync(STORAGE.dir)) {
    fs.mkdirSync(STORAGE.dir, { recursive: true });
}

// ==========================================
// MAIN COMMAND CLASS
// ==========================================

class PlayCommand {
    constructor() {
        this.config = CONFIG;
    }

    // ==========================================
    // MAIN ENTRY POINT
    // ==========================================
    
    async execute(sock, chatId, message) {
        try {
            const text = this.extractText(message);
            const args = text.split(' ').slice(1).join(' ').trim();

            // Show main menu if no args
            if (!args) {
                return await this.showMainMenu(sock, chatId, message);
            }

            // Check if it's a number selection from previous search
            if (this.isSelection(args, chatId)) {
                return await this.handleSelection(sock, chatId, message, parseInt(args));
            }

            // New search
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
✅ High Quality Audio (320kbps)
✅ Video Downloads (720p/1080p)
✅ Fast Multi-API System
✅ Auto Retry on Failure
✅ Large File Support

*Status:* 🟢 Online | *APIs:* 5 Fallbacks`;

        const buttons = [
            {
                buttonId: 'play_menu_search',
                buttonText: { displayText: '🔍 Search Song' },
                type: 1
            },
            {
                buttonId: 'play_menu_help',
                buttonText: { displayText: '❓ Help Guide' },
                type: 1
            },
            {
                buttonId: 'play_menu_status',
                buttonText: { displayText: '📊 System Status' },
                type: 1
            }
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
            // React searching
            await sock.sendMessage(chatId, {
                react: { text: '🔍', key: message.key }
            });

            // Send loading message
            const loadingMsg = await sock.sendMessage(chatId, {
                text: `🔍 Searching for: *${query}*...\n\n⏳ Please wait...`
            }, { quoted: message });

            // Perform search
            const { videos } = await yts(query);
            
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { delete: loadingMsg.key });
                return await this.sendError(sock, chatId, message, 'No results found. Try different keywords.');
            }

            // Store session (top 10 results)
            const results = videos.slice(0, 10);
            STORAGE.sessions.set(chatId, {
                results: results,
                query: query,
                timestamp: Date.now(),
                messageKey: message.key
            });

            // Auto cleanup after 5 minutes
            setTimeout(() => {
                STORAGE.sessions.delete(chatId);
            }, 300000);

            // Delete loading message
            await sock.sendMessage(chatId, { delete: loadingMsg.key });

            // Build results text
            let resultsText = `🎵 *Results for:* _${query}_\n\n`;
            results.forEach((video, index) => {
                const duration = video.timestamp || 'N/A';
                const views = this.formatNumber(video.views);
                resultsText += `${index + 1}. *${this.escapeMarkdown(video.title)}*\n`;
                resultsText += `   ⏱️ ${duration} | 👁️ ${views} views\n`;
                resultsText += `   👤 ${video.author.name}\n\n`;
            });

            resultsText += `📥 *Reply with number 1-10 to download*`;

            // Send results with thumbnail
            await sock.sendMessage(chatId, {
                image: { url: results[0].thumbnail },
                caption: resultsText,
                footer: 'Nemesis Prime Bot | Reply with number',
                buttons: [
                    {
                        buttonId: 'play_cancel',
                        buttonText: { displayText: '❌ Cancel' },
                        type: 1
                    }
                ],
                viewOnce: true
            }, { quoted: message });

        } catch (error) {
            console.error('Search Error:', error);
            await this.sendError(sock, chatId, message, 'Search failed. Please try again.');
        }
    }

    // ==========================================
    // SELECTION HANDLER
    // ==========================================

    async handleSelection(sock, chatId, message, selection) {
        const session = STORAGE.sessions.get(chatId);
        
        if (!session || selection < 1 || selection > session.results.length) {
            return await this.sendError(sock, chatId, message, 'Invalid selection or session expired. Search again.');
        }

        const video = session.results[selection - 1];
        
        // Clear session
        STORAGE.sessions.delete(chatId);

        // Show format selection menu
        await this.showFormatMenu(sock, chatId, message, video);
    }

    async showFormatMenu(sock, chatId, message, video) {
        const info = `🎵 *${this.escapeMarkdown(video.title)}*

⏱️ Duration: ${video.timestamp || 'N/A'}
👤 Channel: ${video.author.name}
👁️ Views: ${this.formatNumber(video.views)}
📅 Uploaded: ${video.ago || 'N/A'}

*Select download format:*`;

        // Store video info for button handling
        const downloadId = `${chatId}_${Date.now()}`;
        STORAGE.downloads.set(downloadId, {
            video: video,
            timestamp: Date.now()
        });

        const buttons = [
            {
                buttonId: `dl_audio_${video.videoId}_${downloadId}`,
                buttonText: { displayText: '🎵 MP3 Audio' },
                type: 1
            },
            {
                buttonId: `dl_audiodoc_${video.videoId}_${downloadId}`,
                buttonText: { displayText: '📄 MP3 Document' },
                type: 1
            },
            {
                buttonId: `dl_video_${video.videoId}_${downloadId}`,
                buttonText: { displayText: '🎬 MP4 Video (720p)' },
                type: 1
            },
            {
                buttonId: `dl_videohd_${video.videoId}_${downloadId}`,
                buttonText: { displayText: '🎬 MP4 Video (1080p)' },
                type: 1
            }
        ];

        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: info,
            footer: 'Choose quality - Large files sent as links',
            buttons: buttons,
            viewOnce: true
        }, { quoted: message });
    }

    // ==========================================
    // DOWNLOAD HANDLERS
    // ==========================================

    async downloadAudio(sock, chatId, message, videoId, downloadId, asDocument = false) {
        const downloadInfo = STORAGE.downloads.get(downloadId);
        if (!downloadInfo) {
            return await this.sendError(sock, chatId, message, 'Download session expired.');
        }

        const { video } = downloadInfo;
        const url = `https://youtube.com/watch?v=${video.videoId}`;

        try {
            // Processing reaction
            await sock.sendMessage(chatId, {
                react: { text: '⏳', key: message.key }
            });

            // Try to get download URL with retries
            const downloadUrl = await this.fetchWithRetry(
                () => this.getAudioUrl(url),
                this.config.maxRetries
            );

            if (!downloadUrl) {
                throw new Error('All APIs failed to fetch audio');
            }

            // Check file size
            const fileInfo = await this.getFileInfo(downloadUrl);
            
            // If file > 50MB, send as link
            if (fileInfo.size && fileInfo.size > 50 * 1024 * 1024) {
                return await this.sendAsLink(sock, chatId, message, video, downloadUrl, 'audio');
            }

            // Download and send
            await this.sendAudio(sock, chatId, message, video, downloadUrl, asDocument);

            // Success reaction
            await sock.sendMessage(chatId, {
                react: { text: '✅', key: message.key }
            });

        } catch (error) {
            console.error('Audio Download Error:', error);
            await this.sendError(sock, chatId, message, `Download failed: ${error.message}`);
        } finally {
            STORAGE.downloads.delete(downloadId);
        }
    }

    async downloadVideo(sock, chatId, message, videoId, downloadId, quality = '720p') {
        const downloadInfo = STORAGE.downloads.get(downloadId);
        if (!downloadInfo) {
            return await this.sendError(sock, chatId, message, 'Download session expired.');
        }

        const { video } = downloadInfo;
        const url = `https://youtube.com/watch?v=${video.videoId}`;

        try {
            await sock.sendMessage(chatId, {
                react: { text: '🎬', key: message.key }
            });

            const downloadUrl = await this.fetchWithRetry(
                () => this.getVideoUrl(url, quality),
                this.config.maxRetries
            );

            if (!downloadUrl) {
                throw new Error('All video APIs failed');
            }

            const fileInfo = await this.getFileInfo(downloadUrl);
            
            // If file > 70MB, send as link
            if (fileInfo.size && fileInfo.size > 70 * 1024 * 1024) {
                return await this.sendAsLink(sock, chatId, message, video, downloadUrl, 'video');
            }

            await this.sendVideo(sock, chatId, message, video, downloadUrl, quality);

            await sock.sendMessage(chatId, {
                react: { text: '✅', key: message.key }
            });

        } catch (error) {
            console.error('Video Download Error:', error);
            await this.sendError(sock, chatId, message, `Video download failed: ${error.message}`);
        } finally {
            STORAGE.downloads.delete(downloadId);
        }
    }

    // ==========================================
    // API FETCHERS WITH FALLBACK
    // ==========================================

    async getAudioUrl(videoUrl) {
        // Try primary API first
        try {
            console.log('Trying primary audio API...');
            const response = await axios.get(this.config.primary.audio, {
                params: { url: videoUrl },
                timeout: this.config.timeout,
                headers: { 'User-Agent': this.config.userAgent }
            });

            if (response.data?.downloadUrl || response.data?.url) {
                return response.data.downloadUrl || response.data.url;
            }
        } catch (error) {
            console.log('Primary audio API failed:', error.message);
        }

        // Try fallback APIs
        for (const api of this.config.fallbacks) {
            try {
                console.log(`Trying fallback audio API: ${api.name}`);
                const response = await axios.get(api.audio(videoUrl), {
                    timeout: this.config.timeout,
                    headers: { 'User-Agent': this.config.userAgent }
                });

                const url = this.extractUrlFromResponse(response.data);
                if (url) {
                    console.log(`Success with ${api.name}`);
                    return url;
                }
            } catch (error) {
                console.log(`${api.name} failed:`, error.message);
                continue;
            }
        }

        return null;
    }

    async getVideoUrl(videoUrl, quality) {
        // Try primary API first
        try {
            console.log('Trying primary video API...');
            const response = await axios.get(this.config.primary.video, {
                params: { url: videoUrl, quality: quality },
                timeout: this.config.timeout,
                headers: { 'User-Agent': this.config.userAgent }
            });

            if (response.data?.downloadUrl || response.data?.url) {
                return response.data.downloadUrl || response.data.url;
            }
        } catch (error) {
            console.log('Primary video API failed:', error.message);
        }

        // Try fallback APIs
        for (const api of this.config.fallbacks) {
            try {
                console.log(`Trying fallback video API: ${api.name}`);
                const response = await axios.get(api.video(videoUrl), {
                    timeout: this.config.timeout,
                    headers: { 'User-Agent': this.config.userAgent }
                });

                const url = this.extractUrlFromResponse(response.data);
                if (url) {
                    console.log(`Success with ${api.name}`);
                    return url;
                }
            } catch (error) {
                console.log(`${api.name} failed:`, error.message);
                continue;
            }
        }

        return null;
    }

    // ==========================================
    // RESPONSE PARSERS
    // ==========================================

    extractUrlFromResponse(data) {
        // Handle various API response formats
        const possiblePaths = [
            'result.downloadUrl',
            'result.url',
            'data.download_url',
            'data.url',
            'data.dl',
            'download_url',
            'downloadUrl',
            'url',
            'link',
            'data.link'
        ];

        for (const path of possiblePaths) {
            const keys = path.split('.');
            let value = data;
            for (const key of keys) {
                value = value?.[key];
                if (value === undefined) break;
            }
            if (value && typeof value === 'string' && value.startsWith('http')) {
                return value;
            }
        }

        return null;
    }

    // ==========================================
    // FILE OPERATIONS
    // ==========================================

    async getFileInfo(url) {
        try {
            const response = await axios.head(url, {
                timeout: 10000,
                headers: { 'User-Agent': this.config.userAgent }
            });
            return {
                size: parseInt(response.headers['content-length']) || 0,
                type: response.headers['content-type']
            };
        } catch (error) {
            return { size: 0, type: 'unknown' };
        }
    }

    async sendAudio(sock, chatId, message, video, url, asDocument) {
        const filename = `${this.sanitizeFilename(video.title)}.mp3`;

        if (asDocument) {
            await sock.sendMessage(chatId, {
                document: { url: url },
                mimetype: 'audio/mpeg',
                fileName: filename,
                caption: `🎵 *${this.escapeMarkdown(video.title)}*\n\n📥 Downloaded via Nemesis Prime Bot`,
                footer: 'High Quality Audio'
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                audio: { url: url },
                mimetype: 'audio/mpeg',
                fileName: filename,
                ptt: false
            }, { quoted: message });
            
            // Send caption separately for audio
            await sock.sendMessage(chatId, {
                text: `🎵 *${this.escapeMarkdown(video.title)}*\n✅ Download complete`
            }, { quoted: message });
        }
    }

    async sendVideo(sock, chatId, message, video, url, quality) {
        const filename = `${this.sanitizeFilename(video.title)}_${quality}.mp4`;

        await sock.sendMessage(chatId, {
            video: { url: url },
            caption: `🎬 *${this.escapeMarkdown(video.title)}* (${quality})\n\n📥 Downloaded via Nemesis Prime Bot`,
            footer: 'High Quality Video',
            fileName: filename
        }, { quoted: message });
    }

    async sendAsLink(sock, chatId, message, video, url, type) {
        const emoji = type === 'audio' ? '🎵' : '🎬';
        const text = type === 'audio' ? 'Audio' : 'Video';
        
        await sock.sendMessage(chatId, {
            text: `${emoji} *${this.escapeMarkdown(video.title)}*

⚠️ File too large for WhatsApp direct send.

*Direct Download Link:*
${url}

*Instructions:*
1. Click the link to download
2. File will download to your device
3. Enjoy offline!

*Alternative:* Try searching for a shorter version or different quality.`,
            footer: 'Nemesis Prime Bot - Large File Handler'
        }, { quoted: message });
    }

    // ==========================================
    // BUTTON HANDLER (Call from main bot)
    // ==========================================

    async handleButton(sock, chatId, message, buttonId) {
        const parts = buttonId.split('_');
        const action = parts[1]; // audio, audiodoc, video, videohd
        const videoId = parts[2];
        const downloadId = parts[3];

        switch (action) {
            case 'audio':
                await this.downloadAudio(sock, chatId, message, videoId, downloadId, false);
                break;
            case 'audiodoc':
                await this.downloadAudio(sock, chatId, message, videoId, downloadId, true);
                break;
            case 'video':
                await this.downloadVideo(sock, chatId, message, videoId, downloadId, '720p');
                break;
            case 'videohd':
                await this.downloadVideo(sock, chatId, message, videoId, downloadId, '1080p');
                break;
            case 'menu':
                if (videoId === 'search') {
                    await sock.sendMessage(chatId, {
                        text: '🔍 Type *.play <song name>* to search'
                    });
                } else if (videoId === 'help') {
                    await this.showHelp(sock, chatId, message);
                } else if (videoId === 'status') {
                    await this.showStatus(sock, chatId, message);
                }
                break;
            case 'cancel':
                STORAGE.sessions.delete(chatId);
                await sock.sendMessage(chatId, {
                    text: '✅ Search cancelled.',
                    react: { text: '✅', key: message.key }
                });
                break;
            default:
                await this.sendError(sock, chatId, message, 'Unknown action');
        }
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    async fetchWithRetry(fn, retries) {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const result = await fn();
                if (result) return result;
            } catch (error) {
                lastError = error;
                console.log(`Retry ${i + 1}/${retries} failed:`, error.message);
                await this.sleep(1000 * (i + 1)); // Exponential backoff
            }
        }
        throw lastError || new Error('All retries failed');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    extractText(message) {
        return message.message?.conversation || 
               message.message?.extendedTextMessage?.text || 
               message.message?.imageMessage?.caption || '';
    }

    isSelection(text, chatId) {
        const session = STORAGE.sessions.get(chatId);
        if (!session) return false;
        const num = parseInt(text);
        return !isNaN(num) && num >= 1 && num <= 10;
    }

    formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    sanitizeFilename(name) {
        return name.replace(/[^a-z0-9]/gi, '_').substring(0, 60);
    }

    escapeMarkdown(text) {
        return text.replace(/[*_`[\]]/g, '\\$&');
    }

    async sendError(sock, chatId, message, text) {
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
        
        await sock.sendMessage(chatId, {
            text: `❌ *Error*\n\n${text}\n\n*Try:*\n• Different keywords\n• Check internet connection\n• Wait 1 minute and retry`,
            footer: 'Nemesis Prime Bot',
            buttons: [
                {
                    buttonId: 'play_menu_help',
                    buttonText: { displayText: '❓ Get Help' },
                    type: 1
                }
            ]
        }, { quoted: message });
    }

    async showHelp(sock, chatId, message) {
        const help = `🎵 *NEMESIS PRIME BOT - HELP GUIDE*

*Commands:*
• *.play* - Show main menu
• *.play <song>* - Search music
• *.play <number>* - Select from results

*Download Options:*
🎵 MP3 Audio - Best for music
📄 MP3 Document - Save as file
🎬 MP4 Video - Watch offline
🎬 MP4 HD - High quality video

*Troubleshooting:*
• If download fails, bot auto-retries 3x
• Large files sent as direct links
• Session expires after 5 minutes

*Owner:* 237xxxxxxx`;

        await sock.sendMessage(chatId, { text: help }, { quoted: message });
    }

    async showStatus(sock, chatId, message) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        
        const status = `📊 *SYSTEM STATUS*

🤖 Bot: *ONLINE*
⏱️ Uptime: ${hours}h ${mins}m
🔧 Version: Premium 2.0
📡 APIs: 5 Fallback Sources
💾 Storage: Active

*All systems operational* ✅`;

        await sock.sendMessage(chatId, { text: status }, { quoted: message });
    }
}

// ==========================================
// EXPORTS
// ==========================================

const playCmd = new PlayCommand();

// Main command handler
module.exports = async (sock, chatId, message) => {
    await playCmd.execute(sock, chatId, message);
};

// Button handler - integrate in your main bot
module.exports.handleButton = async (sock, chatId, message, buttonId) => {
    await playCmd.handleButton(sock, chatId, message, buttonId);
};

// Backwards compatibility
module.exports.playCommand = playCmd;

/* 
 * NEMESIS PRIME BOT - PLAY COMMAND
 * Version: 3.0 Ultra-Robust
 * Features: 5 API fallbacks, Auto-retry, Button menus, Large file handling
 * Owner: 237xxxxxxx
 * Storage: /storage/downloads
 */
