const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

// Custom Emojis
const CFA_EMOJI = '<:ChickFilA:1336562218036101171>';
const LINE_EMOJI = '>';

//
// Helper Functions
//

/**
 * Load configuration from file.
 */
function loadConfig() {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!data.channels) data.channels = {};
    return data;
  } catch (error) {
    console.error('Error loading config:', error);
    return { prefix: '!', channels: {} };
  }
}

/**
 * Save configuration to file.
 */
function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

/**
 * Validate channel ID format (17 to 20 digits).
 */
function isValidChannelId(channelId) {
  return /^\d{17,20}$/.test(channelId);
}

/**
 * Generate embed fields from the config object.
 */
function generateEmbedFields(config) {
  return [
    { 
      name: `${LINE_EMOJI} Current Service Prefix`, 
      value: `${LINE_EMOJI} ${config.prefix || 'Not set'}`, 
      inline: true 
    },
    { 
      name: `${LINE_EMOJI} Dining Room Channel`, 
      value: `${LINE_EMOJI} ${config.channels.kitchen || 'Not set'}`, 
      inline: true 
    },
    { 
      name: `${LINE_EMOJI} Service Log Channel`, 
      value: `${LINE_EMOJI} ${config.channels.log || 'Not set'}`, 
      inline: true 
    },
  ];
}

/**
 * Helper: Wait for a modal submission matching a filter.
 * Resolves with the modal interaction or rejects on timeout.
 */
function awaitModalSubmit(client, filter, time = 60000) {
  return new Promise((resolve, reject) => {
    const handler = (interaction) => {
      if (!interaction.isModalSubmit()) return;
      if (filter(interaction)) {
        client.removeListener('interactionCreate', handler);
        resolve(interaction);
      }
    };
    client.on('interactionCreate', handler);
    setTimeout(() => {
      client.removeListener('interactionCreate', handler);
      reject(new Error('Timeout waiting for modal submission'));
    }, time);
  });
}

//
// Main Command Module
//
module.exports = {
  name: 'config',
  description: `${CFA_EMOJI} Interactive service excellence configuration dashboard`,
  /**
   * Executes the configuration dashboard.
   *
   * For this example the command is assumed to be message-based.
   * (If you use slash commands you’ll need to adjust the interaction responses accordingly.)
   *
   * @param {Message} message The message triggering the command.
   * @param {Array} args Any command arguments.
   */
  async execute(message, args) {
    // Only allow administrators to use this command.
    if (!message.member.permissions.has('Administrator')) {
      return message.reply({ 
        content: `${CFA_EMOJI} Please consult a team leader for service configuration!` 
      });
    }

    // Load the current configuration.
    const config = loadConfig();

    // Create an initial embed for the dashboard.
    const embed = new EmbedBuilder()
      .setTitle(`${CFA_EMOJI} Service Excellence Configuration`)
      .setColor(0xE4002B) // Chick-fil-A Red
      .setDescription(`**Manage your team's service standards**\n\nSelect from below to adjust hospitality parameters`)
      .setFields(...generateEmbedFields(config))
      .setFooter({ 
        text: 'Chick-fil-A Service Bot v1.0', 
        iconURL: 'https://cdn.discordapp.com/icons/1261184110395920456/b367554161c652a79d7fdeb5a954c5a2.png?size=4096'
      });

    // Create a select menu for configuration options.
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('selectConfig')
      .setPlaceholder('Select service parameter')
      .addOptions([
        { 
          label: 'Service Prefix', 
          description: 'Set the command prefix', 
          value: 'prefix', 
          emoji: CFA_EMOJI 
        },
        { 
          label: 'Dining Room', 
          description: 'Set dining operations channel', 
          value: 'kitchen', 
          emoji: '🍴' 
        },
        { 
          label: 'Service Logs', 
          description: 'Set hospitality tracking channel', 
          value: 'log', 
          emoji: '📈' 
        },
      ]);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // Create a cancel button.
    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel')
      .setLabel('Close Panel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚪');

    const buttonRow = new ActionRowBuilder().addComponents(cancelButton);

    // Send the dashboard message.
    const dashboardMessage = await message.channel.send({
      embeds: [embed],
      components: [selectRow, buttonRow],
    });

    //
    // Select Menu Collector
    //
    const selectCollector = dashboardMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
    });

    selectCollector.on('collect', async (interaction) => {
      // Only allow the original user to interact.
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ 
          content: `${CFA_EMOJI} This dashboard is not for you!`, 
          ephemeral: true 
        });
      }

      // Immediately acknowledge the select interaction to avoid timeout.
      // (Since we are showing a modal immediately, Discord will consider the interaction as responded to.)
      try {
        await interaction.deferUpdate();
      } catch (e) {
        console.error('Failed to defer update:', e);
      }

      const selectedSetting = interaction.values[0];

      // Create a modal for the selected configuration.
      const modal = new ModalBuilder()
        .setCustomId(`modal-${selectedSetting}`)
        .setTitle(`Update ${selectedSetting.charAt(0).toUpperCase() + selectedSetting.slice(1)}`);

      const input = new TextInputBuilder()
        .setCustomId(`${selectedSetting}_value`)
        .setLabel(selectedSetting === 'prefix' ? 'New Service Prefix (max 3)' : 'Channel ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter new value...')
        .setRequired(true);

      if (selectedSetting === 'prefix') {
        input.setMaxLength(3);
      }

      const modalRow = new ActionRowBuilder().addComponents(input);
      modal.addComponents(modalRow);

      // Show the modal to the user.
      await interaction.showModal(modal);

      // Wait for the modal submission.
      try {
        const modalInteraction = await awaitModalSubmit(
          message.client,
          (i) =>
            i.user.id === message.author.id &&
            i.customId === `modal-${selectedSetting}`,
          60000
        );

        // Validate and extract the new value.
        const newValue = modalInteraction.fields.getTextInputValue(`${selectedSetting}_value`).trim();

        let isValid = false;
        switch (selectedSetting) {
          case 'prefix':
            isValid = newValue.length > 0 && newValue.length <= 3;
            break;
          case 'kitchen':
          case 'log':
            isValid = isValidChannelId(newValue);
            break;
        }

        if (!isValid) {
          // Reply to the modal interaction with an error message.
          await modalInteraction.reply({ 
            content: `${CFA_EMOJI} 🚫 Invalid input. Please try again.`, 
            ephemeral: true 
          });
          return;
        }

        // Update the configuration based on the selection.
        switch (selectedSetting) {
          case 'prefix':
            config.prefix = newValue;
            break;
          case 'kitchen':
            config.channels.kitchen = newValue;
            break;
          case 'log':
            config.channels.log = newValue;
            break;
        }

        // Save the configuration.
        saveConfig(config);

        // Reply to the modal submission confirming update.
        await modalInteraction.reply({
          content: `${CFA_EMOJI} ✅ ${selectedSetting.charAt(0).toUpperCase() + selectedSetting.slice(1)} updated successfully.`,
          ephemeral: true,
        });

        // Update the dashboard embed with new configuration values.
        embed.setFields(...generateEmbedFields(config));
        await dashboardMessage.edit({ embeds: [embed] });
      } catch (err) {
        console.error('Modal submission error:', err);
        // Because the select interaction was already deferred and we couldn’t get a modal,
        // we can send a follow-up message on the dashboard.
        await message.channel.send({ 
          content: `${CFA_EMOJI} Timed out waiting for modal submission.`, 
          reply: { messageReference: message.id } 
        });
      }
    });

    //
    // Cancel Button Collector
    //
    const buttonCollector = dashboardMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    buttonCollector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ 
          content: `${CFA_EMOJI} This dashboard is not for you!`, 
          ephemeral: true 
        });
      }

      if (interaction.customId === 'cancel') {
        // Acknowledge the button press.
        await interaction.reply({ 
          content: `${CFA_EMOJI} Service panel closed. Have a wonderful day!`, 
          ephemeral: true 
        });
        // Stop both collectors and remove the dashboard components.
        selectCollector.stop();
        buttonCollector.stop();
        await dashboardMessage.edit({ components: [] });
      }
    });

    // When collectors end, clean up the dashboard.
    const cleanupCollectors = async () => {
      // Remove interactive components if the dashboard message still exists.
      try {
        await dashboardMessage.edit({ components: [] });
      } catch (e) {
        // Message may already have been deleted.
      }
    };

    selectCollector.on('end', cleanupCollectors);
    buttonCollector.on('end', cleanupCollectors);
  },
};
