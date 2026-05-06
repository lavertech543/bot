const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Queen images for update responses
const UPDATE_IMAGES = {
    start: 'https://cdn-icons-png.flaticon.com/512/2920/2920277.png',     // Refresh/Update
    success: 'https://cdn-icons-png.flaticon.com/512/190/190411.png',    // Check/Success
    error: 'https://cdn-icons-png.flaticon.com/512/753/753345.png',      // Error/Warning
    restart: 'https://cdn-icons-png.flaticon.com/512/4400/4400629.png',  // Restart
    git: 'https://cdn-icons-png.flaticon.com/512/2111/2111432.png',      // Git
    zip: 'https://cdn-icons-png.flaticon.com/512/2926/2926319.png'       // Download
};

// Queen personality wrapper
function speak(type, message) {
    const responses = {
        success: `✦ ${message} | The Shadow Realm evolves.`,
        error: `✗ ${message} | The ancient magic resists.`,
        warning: `⚠ ${message} | Patience, subject.`,
        info: `◈ ${message} | This Queen commands the update.`
    };
    return responses[type] || message;
}

// Get settings safely
function getSettings() {
    try {
        return require('../settings');
    } catch (e) {
        return {
            updateZipUrl: process.env.UPDATE_ZIP_URL || '',
            version: '3.0.0',
            ownerNumber: '',
            botOwner: 'Nemesis Prime'
        };
    }
}

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try {
        await run('git --version');
        return true;
    } catch {
        return false;
    }
}

async function updateViaGit(sock, chatId, message) {
    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await run('git fetch --all --prune');
    const newRev = (await run('git rev-parse origin/main')).trim();
    const alreadyUpToDate = oldRev === newRev;
    
    if (alreadyUpToDate) {
        await sock.sendMessage(chatId, {
            image: { url: UPDATE_IMAGES.success },
            caption: speak('info', 'The Shadow Realm is already at its peak. No updates available.'),
            contextInfo: {
                externalAdReply: {
                    title: "✅ Up to Date",
                    body: `Version: ${newRev.substring(0, 7)}`,
                    thumbnailUrl: UPDATE_IMAGES.success,
                    sourceUrl: "https://wa.me/237659262653"
                }
            }
        }, { quoted: message });
        return { alreadyUpToDate: true };
    }

    const commits = await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
    const files = await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
    
    // Show update progress
    await sock.sendMessage(chatId, {
        image: { url: UPDATE_IMAGES.git },
        caption: speak('info', `Updating from ${oldRev.substring(0, 7)} to ${newRev.substring(0, 7)}...\n\nChanges:\n${commits.split('\n').slice(0, 5).join('\n')}${commits.split('\n').length > 5 ? '\n...' : ''}`),
        contextInfo: {
            externalAdReply: {
                title: "🔄 Updating via Git",
                body: "Shadow Realm evolution in progress",
                thumbnailUrl: UPDATE_IMAGES.git
            }
        }
    }, { quoted: message });

    await run(`git reset --hard ${newRev}`);
    await run('git clean -fd');
    
    // Install dependencies
    await sock.sendMessage(chatId, {
        image: { url: UPDATE_IMAGES.start },
        caption: speak('info', 'Installing dependencies...'),
        contextInfo: {
            externalAdReply: {
                title: "📦 Installing",
                body: "npm install in progress",
                thumbnailUrl: UPDATE_IMAGES.start
            }
        }
    }, { quoted: message });
    
    await run('npm install --no-audit --no-fund');
    
    return { oldRev, newRev, alreadyUpToDate: false, commits, files };
}

function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            if (visited.has(url) || visited.size > 5) {
                return reject(new Error('Too many redirects'));
            }
            visited.add(url);

            const useHttps = url.startsWith('https://');
            const client = useHttps ? require('https') : require('http');
            const req = client.get(url, {
                headers: {
                    'User-Agent': 'Nemesis-Prime-Updater/3.0',
                    'Accept': '*/*'
                }
            }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const location = res.headers.location;
                    if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
                    const nextUrl = new URL(location, url).toString();
                    res.resume();
                    return downloadFile(nextUrl, dest, visited).then(resolve).catch(reject);
                }

                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }

                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', err => {
                    try { file.close(() => {}); } catch {}
                    fs.unlink(dest, () => reject(err));
                });
            });
            req.on('error', err => {
                fs.unlink(dest, () => reject(err));
            });
        } catch (e) {
            reject(e);
        }
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`;
        await run(cmd);
        return;
    }
    try {
        await run('command -v unzip');
        await run(`unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    try {
        await run('command -v 7z');
        await run(`7z x -y '${zipPath}' -o'${outDir}'`);
        return;
    } catch {}
    try {
        await run('busybox unzip -h');
        await run(`busybox unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    throw new Error("No system unzip tool found (unzip/7z/busybox). Git mode is recommended.");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            fs.copyFileSync(s, d);
            if (outList) outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip(sock, chatId, message, zipOverride) {
    const settings = getSettings();
    const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    
    if (!zipUrl) {
        throw new Error('No ZIP URL configured. Set settings.updateZipUrl or UPDATE_ZIP_URL env.');
    }

    await sock.sendMessage(chatId, {
        image: { url: UPDATE_IMAGES.zip },
        caption: speak('info', 'Downloading update package...'),
        contextInfo: {
            externalAdReply: {
                title: "📥 Downloading",
                body: "Fetching latest version",
                thumbnailUrl: UPDATE_IMAGES.zip
            }
        }
    }, { quoted: message });

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');
    
    await downloadFile(zipUrl, zipPath);
    
    await sock.sendMessage(chatId, {
        image: { url: UPDATE_IMAGES.start },
        caption: speak('info', 'Extracting update package...'),
        contextInfo: {
            externalAdReply: {
                title: "📦 Extracting",
                body: "Unpacking files",
                thumbnailUrl: UPDATE_IMAGES.start
            }
        }
    }, { quoted: message });

    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    const [root] = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;

    // Preserve owner settings
    let preservedOwner = null;
    let preservedBotOwner = null;
    try {
        const currentSettings = require('../settings');
        preservedOwner = currentSettings?.ownerNumber ? String(currentSettings.ownerNumber) : null;
        preservedBotOwner = currentSettings?.botOwner ? String(currentSettings.botOwner) : null;
    } catch {}

    const ignore = ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'baileys_store.json', 'storage'];
    const copied = [];
    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);

    // Restore preserved settings
    if (preservedOwner) {
        try {
            const settingsPath = path.join(process.cwd(), 'settings.js');
            if (fs.existsSync(settingsPath)) {
                let text = fs.readFileSync(settingsPath, 'utf8');
                text = text.replace(/ownerNumber:\s*'[^']*'/, `ownerNumber: '${preservedOwner}'`);
                if (preservedBotOwner) {
                    text = text.replace(/botOwner:\s*'[^']*'/, `botOwner: '${preservedBotOwner}'`);
                }
                fs.writeFileSync(settingsPath, text);
            }
        } catch {}
    }

    // Cleanup
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    
    return { copiedFiles: copied };
}

async function restartProcess(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        image: { url: UPDATE_IMAGES.restart },
        caption: speak('success', 'Update complete! The Shadow Realm shall rise anew.'),
        contextInfo: {
            externalAdReply: {
                title: "🔄 Restarting",
                body: "Nemesis Prime rebirth",
                thumbnailUrl: UPDATE_IMAGES.restart,
                sourceUrl: "https://wa.me/237659262653"
            }
        }
    }, { quoted: message });

    setTimeout(async () => {
        try {
            await run('pm2 restart all');
        } catch {
            process.exit(0);
        }
    }, 1500);
}

async function updateCommand(sock, chatId, message, senderIsSudo) {
    // Check privilege - only dev (you) or sudo
    const senderId = message.key.participant || message.key.remoteJid;
    const cleanNumber = senderId.replace(/[^0-9]/g, '');
    const isDev = cleanNumber === '237659262653';
    
    if (!isDev && !senderIsSudo && !message.key.fromMe) {
        await sock.sendMessage(chatId, {
            image: { url: UPDATE_IMAGES.error },
            caption: speak('error', 'Only the Shadow Monarch or trusted sudo may command updates.'),
            contextInfo: {
                externalAdReply: {
                    title: "⛔ Access Denied",
                    body: "Supreme authority required",
                    thumbnailUrl: UPDATE_IMAGES.error
                }
            }
        }, { quoted: message });
        return;
    }

    try {
        // Initial update message
        await sock.sendMessage(chatId, {
            image: { url: UPDATE_IMAGES.start },
            caption: speak('info', 'Initiating Shadow Realm evolution...'),
            contextInfo: {
                externalAdReply: {
                    title: "🔄 Updating",
                    body: "Nemesis Prime upgrade in progress",
                    thumbnailUrl: UPDATE_IMAGES.start,
                    sourceUrl: "https://wa.me/237659262653"
                }
            }
        }, { quoted: message });

        let updateResult;
        
        if (await hasGitRepo()) {
            updateResult = await updateViaGit(sock, chatId, message);
            if (updateResult.alreadyUpToDate) return;
        } else {
            updateResult = await updateViaZip(sock, chatId, message);
        }

        // Success message
        await sock.sendMessage(chatId, {
            image: { url: UPDATE_IMAGES.success },
            caption: speak('success', 'Evolution complete. New power courses through my veins.'),
            context: {
                externalAdReply: {
                    title: "✅ Update Successful",
                    body: "Restarting to apply changes",
                    thumbnailUrl: UPDATE_IMAGES.success
                }
            }
        }, { quoted: message });

        await restartProcess(sock, chatId, message);

    } catch (err) {
        console.error('Update failed:', err);
        await sock.sendMessage(chatId, {
            image: { url: UPDATE_IMAGES.error },
            caption: speak('error', `Update failed:\n${String(err.message || err)}`),
            contextInfo: {
                externalAdReply: {
                    title: "❌ Update Failed",
                    body: "Check logs for details",
                    thumbnailUrl: UPDATE_IMAGES.error
                }
            }
        }, { quoted: message });
    }
}

module.exports = { updateCommand };
