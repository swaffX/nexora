const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder().setName('dice').setDescription('Zar atar (1-6).'),
    async execute(interaction) {
        const roll = Math.floor(Math.random() * 6) + 1;
        await interaction.reply({ content: `🎲 Zar attın: **${roll}**` });
    }
};
