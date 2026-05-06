/**
 * Queen AI - Message Count & Bot Mode Manager
 * Handles message statistics, user activity tracking, and bot mode settings
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(process.cwd(), 'data', 'messageCount.json');

// Default data structure
const defaultData = {
    isPublic: true,
    groups: {},
    users: {},
    stats: {
        totalMessages: 0,
        totalCommands: 0,
        startDate: Date.now()
    }
};

/**
 * Ensure data directory exists
 */
function ensureDirectory() {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Load data from file
 */
function loadData() {
    try {
        ensureDirectory();
        if (fs.existsSync(DATA_PATH)) {
            const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
            return { ...defaultData, ...data };
        }
    } catch (error) {
        console.error('✿ Error loading messageCount:', error.message);
    }
    return { ...defaultData };
}

/**
 * Save data to file
 */
function saveData(data) {
    try {
        ensureDirectory();
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('✿ Error saving messageCount:', error.message);
    }
}

// Global data cache
let dataCache = loadData();

/**
 * Get current bot mode
 * @returns {boolean} true = public, false = private
 */
function getBotMode() {
    return dataCache.isPublic !== false;
}

/**
 * Set bot mode
 * @param {boolean} isPublic - true = public, false = private
 */
function setBotMode(isPublic) {
    dataCache.isPublic = isPublic;
    saveData(dataCache);
}

/**
 * Toggle bot mode
 * @returns {boolean} New mode
 */
function toggleBotMode() {
    dataCache.isPublic = !dataCache.isPublic;
    saveData(dataCache);
    return dataCache.isPublic;
}

/**
 * Increment message count for a user in a group
 * @param {string} chatId - Group or chat JID
 * @param {string} senderId - User JID
 * @param {boolean} isCommand - Whether this was a command
 */
function incrementMessageCount(chatId, senderId, isCommand = false) {
    try {
        const now = Date.now();

        // Initialize group if not exists
        if (!dataCache.groups) dataCache.groups = {};
        if (!dataCache.groups[chatId]) {
            dataCache.groups[chatId] = {
                messages: {},
                totalMessages: 0,
                lastActivity: now
            };
        }

        // Initialize user in group
        if (!dataCache.groups[chatId].messages[senderId]) {
            dataCache.groups[chatId].messages[senderId] = {
                count: 0,
                commands: 0,
                firstSeen: now,
                lastSeen: now
            };
        }

        // Update counts
        dataCache.groups[chatId].messages[senderId].count++;
        dataCache.groups[chatId].messages[senderId].lastSeen = now;
        dataCache.groups[chatId].totalMessages++;
        dataCache.groups[chatId].lastActivity = now;

        // Update command count if applicable
        if (isCommand) {
            dataCache.groups[chatId].messages[senderId].commands++;
            dataCache.stats.totalCommands++;
        }

        // Update global stats
        dataCache.stats.totalMessages++;

        // Save every 10 messages (reduce disk writes)
        if (dataCache.stats.totalMessages % 10 === 0) {
            saveData(dataCache);
        }
    } catch (error) {
        console.error('✿ Error incrementing count:', error.message);
    }
}

/**
 * Get top active members in a group
 * @param {string} chatId - Group JID
 * @param {number} limit - Number of top members to return
 * @returns {Array} Sorted array of top members
 */
function getTopMembers(chatId, limit = 10) {
    try {
        if (!dataCache.groups?.[chatId]?.messages) {
            return [];
        }

        const messages = dataCache.groups[chatId].messages;
        return Object.entries(messages)
            .map(([userId, stats]) => ({
                userId,
                count: stats.count,
                commands: stats.commands,
                lastSeen: stats.lastSeen
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    } catch (error) {
        console.error('✿ Error getting top members:', error.message);
        return [];
    }
}

/**
 * Get user message count in specific group
 * @param {string} chatId - Group JID
 * @param {string} senderId - User JID
 * @returns {number} Message count
 */
function getUserCount(chatId, senderId) {
    return dataCache.groups?.[chatId]?.messages?.[senderId]?.count || 0;
}

/**
 * Get user command count in specific group
 * @param {string} chatId - Group JID
 * @param {string} senderId - User JID
 * @returns {number} Command count
 */
function getUserCommandCount(chatId, senderId) {
    return dataCache.groups?.[chatId]?.messages?.[senderId]?.commands || 0;
}

/**
 * Get global user stats across all groups
 * @param {string} senderId - User JID
 * @returns {Object} User statistics
 */
function getUserStats(senderId) {
    try {
        let totalMessages = 0;
        let totalCommands = 0;
        let groupsParticipated = 0;
        let lastSeen = 0;

        for (const [chatId, groupData] of Object.entries(dataCache.groups || {})) {
            const userData = groupData.messages?.[senderId];
            if (userData) {
                totalMessages += userData.count;
                totalCommands += userData.commands;
                groupsParticipated++;
                if (userData.lastSeen > lastSeen) {
                    lastSeen = userData.lastSeen;
                }
            }
        }

        return {
            totalMessages,
            totalCommands,
            groupsParticipated,
            lastSeen: lastSeen || null,
            averagePerGroup: groupsParticipated > 0 ? Math.round(totalMessages / groupsParticipated) : 0
        };
    } catch (error) {
        console.error('✿ Error getting user stats:', error.message);
        return null;
    }
}

/**
 * Get group statistics
 * @param {string} chatId - Group JID
 * @returns {Object} Group statistics
 */
function getGroupStats(chatId) {
    try {
        const group = dataCache.groups?.[chatId];
        if (!group) return null;

        const userCount = Object.keys(group.messages || {}).length;
        const totalMessages = group.totalMessages || 0;
        const lastActivity = group.lastActivity || 0;

        return {
            userCount,
            totalMessages,
            lastActivity,
            averagePerUser: userCount > 0 ? Math.round(totalMessages / userCount) : 0
        };
    } catch (error) {
        console.error('✿ Error getting group stats:', error.message);
        return null;
    }
}

/**
 * Get global bot statistics
 * @returns {Object} Global statistics
 */
function getGlobalStats() {
    const groupCount = Object.keys(dataCache.groups || {}).length;
    let totalUsers = 0;
    
    for (const group of Object.values(dataCache.groups || {})) {
        totalUsers += Object.keys(group.messages || {}).length;
    }

    return {
        ...dataCache.stats,
        groupCount,
        uniqueUsers: totalUsers,
        uptime: Date.now() - (dataCache.stats.startDate || Date.now())
    };
}

/**
 * Reset counts for a specific group
 * @param {string} chatId - Group JID
 */
function resetGroupCounts(chatId) {
    if (dataCache.groups[chatId]) {
        dataCache.groups[chatId] = {
            messages: {},
            totalMessages: 0,
 lastActivity: Date.now()
        };
        saveData(dataCache);
    }
}

/**
 * Reset all data (owner only)
 */
function resetAllData() {
    dataCache = { ...defaultData, stats: { ...defaultData.stats, startDate: Date.now() } };
    saveData(dataCache);
}

/**
 * Get raw data (for advanced usage)
 * @returns {Object} Raw data object
 */
function getRawData() {
    return dataCache;
}

/**
 * Force save data to disk
 */
function forceSave() {
    saveData(dataCache);
}

// Auto-save every 5 minutes
setInterval(() => {
    saveData(dataCache);
    console.log('✿ Message count data auto-saved');
}, 5 * 60 * 1000);

// Save on process exit
process.on('beforeExit', () => saveData(dataCache));
process.on('SIGINT', () => {
    saveData(dataCache);
    process.exit(0);
});
process.on('SIGTERM', () => {
    saveData(dataCache);
    process.exit(0);
});

module.exports = {
    // Bot mode
    getBotMode,
    setBotMode,
    toggleBotMode,
    
    // Message counting
    incrementMessageCount,
    
    // Stats
    getTopMembers,
    getUserCount,
    getUserCommandCount,
    getUserStats,
    getGroupStats,
    getGlobalStats,
    
    // Reset
    resetGroupCounts,
    resetAllData,
    
    // Utilities
    getRawData,
    forceSave
};
