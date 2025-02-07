const { EmbedBuilder } = require('discord.js');
const menu = require('../menu.js');

class OrderLogger {
    /**
     * Creates an instance of OrderLogger.
     * @param {string} logChannelId - The Discord channel ID where logs are sent.
     */
    constructor(logChannelId) {
        this.logChannelId = logChannelId;
        this.logCache = new Map(); // Cache for tracking order history
    }

    /**
     * Logs an order update to a designated Discord channel with a Chick‑Fil‑A themed embed.
     * Also saves the log in an internal cache.
     * @param {object} client - The Discord client.
     * @param {object} order - The order object.
     * @param {string} action - The action performed on the order.
     * @param {object} user - The user who performed the action.
     */
    async logOrderUpdate(client, order, action, user) {
        const logChannel = client.channels.cache.get(this.logChannelId);
        if (!logChannel) {
            console.error(`Log channel ${this.logChannelId} not found.`);
            return;
        }
    
        const embed = new EmbedBuilder()
            .setColor(this.getStatusColor(order.status))
            // Retain custom Discord emoji for Chick‑Fil‑A
            .setTitle(`<:ChickFilA:1336562218036101171> | Order ${order.id} - ${action}`)
            .addFields(
                { name: 'Customer', value: order.customer },
                { name: 'Action', value: action },
                { name: 'By', value: `<@${user.id}>` },
                { name: 'Status', value: this.formatStatus(order.status) }
            )
            .setTimestamp();
    
        // Add items list if available.
        if (order.items && order.items.length > 0) {
            const itemsList = order.items.map(item => `${item.quantity}x ${item.name}`).join('\n');
            embed.addFields({ name: 'Items', value: itemsList });
        }
    
        // Handle notes as either an array or a string.
        if (order.notes) {
            let notesText = '';
            if (Array.isArray(order.notes)) {
                notesText = order.notes.join('\n');
            } else if (typeof order.notes === 'string') {
                notesText = order.notes;
            }
            if (notesText.trim()) {
                embed.addFields({ name: 'Special Instructions', value: notesText });
            }
        }
    
        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`Failed to send log for order ${order.id}:`, error);
        }

        // Save the log entry to the cache.
        const logEntry = {
            timestamp: new Date(),
            orderId: order.id,
            action,
            user: user.id,
            status: order.status
        };
        if (!this.logCache.has(order.id)) {
            this.logCache.set(order.id, []);
        }
        this.logCache.get(order.id).push(logEntry);
    }

    /**
     * Returns a hex color based on the order status.
     * @param {string} status - The order status.
     * @returns {string} Hex color code.
     */
    getStatusColor(status) {
        const colors = {
            'pending': '#FFA500',   // Orange for waiting orders
            'claimed': '#FFA500',   // Orange for claimed/in preparation orders
            'completed': '#00FF00', // Green for delivered orders
            'cancelled': '#FF0000'  // Red for cancelled orders
        };
        return colors[status] || '#0099FF';
    }

    /**
     * Formats the order status with themed emojis and capitalization.
     * @param {string} status - The raw order status.
     * @returns {string} Formatted status.
     */
    formatStatus(status) {
        // Retain your custom Discord emojis for status.
        const emojis = {
            'pending': '<:pending:1336561857254785124>',
            'claimed': '<:pending:1336561857254785124>',
            'completed': '<:online:1336561855912480819>',
            'cancelled': '<:ended:1336561854780280853>'
        };
        const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);
        return `${emojis[status] || '❔'} ${formattedStatus}`;
    }

    /**
     * Retrieves the update history of a given order.
     * @param {string} orderId - The order ID.
     * @returns {Array} List of order update logs.
     */
    getOrderHistory(orderId) {
        return this.logCache.get(orderId) || [];
    }
}

const config = require('../data/config.json');

// Initialize the logger with the log channel ID from config
const orderLogger = new OrderLogger(config.channels.log);
module.exports = OrderLogger;
