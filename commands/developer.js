const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('developer')
        .setDescription('Information about the bot developer'),

    async execute(interaction) {
        const developerEmbed = new EmbedBuilder()
            .setColor('#E51636')
            .setTitle('Bot Developer')
            .setDescription('Meet the developer behind this bot!')
            .addFields(
                { name: '👑 Developer', value: '**VoidSmoked**', inline: true },
                { name: '🚀 Experience', value: 'Helped 2.5k+ servers', inline: true },
                { name: '💻 Specialization', value: 'Bots, Websites, Discord servers', inline: true },
                { 
                    name: '🏆 Achievements', 
                    value: '• Created popular Discord bots\n• Expert in ERLC server development\n• Empowered 2.5k+ communities' 
                },
                { 
                    name: '🔗 Socials', 
                    value: '[GitHub](https://github.com/angelandidkw)\nDiscord: `VoidSmoked`' 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Crafted by VoidSmoked' });

        await interaction.reply({ embeds: [developerEmbed] });
    }
};