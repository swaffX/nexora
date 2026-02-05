const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-rules')
        .setDescription('Kurallar metnini bu kanala gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const gifUrl = 'https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=6985de52&is=69848cd2&hm=bd64540f2cfe9e4d57bfc4c1260e3900cf9ecda72811872f010d236b8e2a16d3&';

        const embed = new EmbedBuilder()
            .setColor(0xFF4655) // Valorant Red / Nexora Theme
            .setTitle('📜 Nexora Topluluk Kuralları')
            .setDescription('Herkes için adil, keyifli ve rekabetçi bir ortam oluşturmak önceliğimizdir. Lütfen aşağıdaki kurallara özen gösterin.')
            .setImage(gifUrl)
            .addFields(
                {
                    name: '🤝 1. Saygı ve Nezaket',
                    value: 'Tüm üyelere karşı saygılı olun. İnsanları rahatsız etmek, kışkırtmak veya kişisel saldırılarda bulunmak yasaktır.'
                },
                {
                    name: '⚔️ 2. 5v5 Maç ve Rekabet Kuralları',
                    value: 'Maçlarımızın kalitesi sportmenliğe bağlıdır.\n• **Toksiklik Kesinlikle Yasaktır:** Rakibe veya takım arkadaşına küfür etmek, aşağılamak, "ez" gibi kışkırtıcı söylemlerde bulunmak ceza sebebidir.\n• **Oyunbozanlık:** Maçı bilerek kaybettirmek (troll) veya AFK kalmak yasaktır.'
                },
                {
                    name: '🛡️ 3. Genel Düzen',
                    value: 'Sunucu içerisinde spam yapmak, reklam paylaşmak veya +18 içerik bulundurmak yasaktır.'
                }
            )
            .setFooter({ text: 'Nexora Yönetimi', iconURL: interaction.guild.iconURL() });

        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: '✅ Kurallar metni başarıyla gönderildi.', flags: MessageFlags.Ephemeral });
    }
};
