const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('minigame')
        .setDescription('Sıkılınca oynamalık mini oyunlar!')
        .addSubcommand(sub =>
            sub.setName('xox')
                .setDescription('Arkadaşınla XOX (Tic-Tac-Toe) oyna')
                .addUserOption(option => option.setName('rakip').setDescription('Kiminle oynayacaksın?').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('snake')
                .setDescription('Yılan oyunu oyna 🐍'))
        .addSubcommand(sub =>
            sub.setName('minesweeper')
                .setDescription('Mayın tarlası oluştur 💣')
                .addIntegerOption(option => option.setName('zorluk').setDescription('1: Kolay, 2: Orta, 3: Zor').setMinValue(1).setMaxValue(3))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // ==================== XOX (TIC TAC TOE) ====================
        if (subcommand === 'xox') {
            const opponent = interaction.options.getUser('rakip');

            if (opponent.id === interaction.user.id) {
                return interaction.reply({ content: 'Kendinle oynayamazsın! (Yalnızlık zor...)', ephemeral: true });
            }
            if (opponent.bot) {
                return interaction.reply({ content: 'Botlarla oynayamazsın (Çok güçlüler).', ephemeral: true });
            }

            // Oyun Durumu
            let turn = interaction.user.id; // İlk sıra komutu kullananın
            const board = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0: Boş, 1: X (Host), 2: O (Opponent)
            let isGameOver = false;

            // Butonları Oluştur
            const createRows = (state) => {
                const rows = [];
                for (let i = 0; i < 3; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 3; j++) {
                        const index = i * 3 + j;
                        const btn = new ButtonBuilder()
                            .setCustomId(`xox_${index}`)
                            .setStyle(state[index] === 0 ? ButtonStyle.Secondary : (state[index] === 1 ? ButtonStyle.Primary : ButtonStyle.Danger))
                            .setLabel(state[index] === 0 ? ' ' : (state[index] === 1 ? 'X' : 'O'))
                            .setDisabled(state[index] !== 0 || isGameOver);
                        row.addComponents(btn);
                    }
                    rows.push(row);
                }
                return rows;
            };

            const msg = await interaction.reply({
                content: `🔴 **XOX** 🔵\n\n<@${interaction.user.id}> (X) vs <@${opponent.id}> (O)\nSıra: <@${turn}>`,
                components: createRows(board),
                fetchReply: true
            });

            const collector = msg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000 * 5 // 5 dakika
            });

            collector.on('collect', async i => {
                if (i.user.id !== turn) {
                    return i.reply({ content: 'Sıra sende değil!', ephemeral: true });
                }

                const index = parseInt(i.customId.split('_')[1]);
                board[index] = (turn === interaction.user.id) ? 1 : 2;

                // Kazanma Kontrolü
                const checkWin = (p) => {
                    const wins = [
                        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Yatay
                        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Dikey
                        [0, 4, 8], [2, 4, 6]           // Çapraz
                    ];
                    return wins.some(combo => combo.every(idx => board[idx] === p));
                };

                let content = '';

                if (checkWin(1)) {
                    isGameOver = true;
                    content = `🏆 **KAZANAN:** <@${interaction.user.id}> (X)! Tebrikler!`;
                    collector.stop();
                } else if (checkWin(2)) {
                    isGameOver = true;
                    content = `🏆 **KAZANAN:** <@${opponent.id}> (O)! Tebrikler!`;
                    collector.stop();
                } else if (!board.includes(0)) {
                    isGameOver = true;
                    content = `🤝 **BERABERE!** Dostluk kazandı.`;
                    collector.stop();
                } else {
                    // Sıra değiştir
                    turn = (turn === interaction.user.id) ? opponent.id : interaction.user.id;
                    content = `🔴 **XOX** 🔵\n\n<@${interaction.user.id}> (X) vs <@${opponent.id}> (O)\nSıra: <@${turn}>`;
                }

                await i.update({ content, components: createRows(board) });
            });
        }

        // ==================== SNAKE (YILAN) ====================
        else if (subcommand === 'snake') {
            const width = 10;
            const height = 10;
            let snake = [{ x: 5, y: 5 }];
            let food = { x: 2, y: 2 };
            let score = 0;
            let isGameOver = false;
            let direction = 'right'; // up, down, left, right

            // Board Çiz
            const renderBoard = () => {
                let grid = '';
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        if (snake.some(s => s.x === x && s.y === y)) {
                            grid += '🟩'; // Yılan
                        } else if (food.x === x && food.y === y) {
                            grid += '🍎'; // Elma
                        } else {
                            grid += '⬛'; // Boş
                        }
                    }
                    grid += '\n';
                }
                return grid;
            };

            // Kontrol Butonları
            const getControls = () => [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('snake_up').setEmoji('⬆️').setStyle(ButtonStyle.Primary),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('snake_left').setEmoji('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('snake_down').setEmoji('⬇️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('snake_right').setEmoji('➡️').setStyle(ButtonStyle.Primary),
                )
            ];

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🐍 Snake Oyunu')
                .setDescription(renderBoard())
                .setFooter({ text: `Skor: ${score} • Yön tuşlarına basarak hareket et!` });

            const reply = await interaction.reply({ embeds: [embed], components: getControls(), fetchReply: true });

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id,
                time: 120000 // 2 dakika
            });

            collector.on('collect', async i => {
                const move = i.customId.split('_')[1]; // up, down, left, right

                // Ters yöne gitmeyi engelle (Basit kontrol)
                // Ama Discord sıra tabanlı olduğu için sadece "Adım at" mantığı yapabiliriz.
                // Yani butona basınca o yöne 1 birim gider.

                let head = { ...snake[0] };

                if (move === 'up') head.y--;
                if (move === 'down') head.y++;
                if (move === 'left') head.x--;
                if (move === 'right') head.x++;

                // Çarpışma Kontrolü (Duvar)
                if (head.x < 0 || head.x >= width || head.y < 0 || head.y >= height) {
                    isGameOver = true;
                    collector.stop();
                    return i.update({ content: `💥 **Oyun Bitti!** Duvara çarptın.\nSkorun: **${score}**`, components: [] });
                }

                // Çarpışma Kontrolü (Kuyruk)
                if (snake.some(s => s.x === head.x && s.y === head.y)) {
                    isGameOver = true;
                    collector.stop();
                    return i.update({ content: `💥 **Oyun Bitti!** Kuyruğuna çarptın.\nSkorun: **${score}**`, components: [] });
                }

                snake.unshift(head); // Başı ekle

                // Yemek yedi mi?
                if (head.x === food.x && head.y === food.y) {
                    score++;
                    // Yeni yemek (Yılanın üstüne gelmesin)
                    do {
                        food = { x: Math.floor(Math.random() * width), y: Math.floor(Math.random() * height) };
                    } while (snake.some(s => s.x === food.x && s.y === food.y));
                } else {
                    snake.pop(); // Kuyruğu sil (Hareket etmiş olur)
                }

                embed.setDescription(renderBoard()).setFooter({ text: `Skor: ${score}` });
                await i.update({ embeds: [embed] });
            });
        }

        // ==================== MINESWEEPER (MAYIN TARLASI) ====================
        else if (subcommand === 'minesweeper') {
            const difficulty = interaction.options.getInteger('zorluk') || 1;

            let rows = 8;
            let cols = 8;
            let mines = 10;

            if (difficulty === 2) { rows = 10; cols = 10; mines = 20; }
            if (difficulty === 3) { rows = 12; cols = 12; mines = 35; }

            // Grid oluştur
            const grid = Array(rows).fill().map(() => Array(cols).fill(0));

            // Mayınları yerleştir
            let placedMines = 0;
            while (placedMines < mines) {
                const r = Math.floor(Math.random() * rows);
                const c = Math.floor(Math.random() * cols);
                if (grid[r][c] !== '💣') {
                    grid[r][c] = '💣';
                    placedMines++;
                }
            }

            // Sayıları hesapla
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (grid[r][c] === '💣') continue;

                    let count = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const nr = r + dr;
                            const nc = c + dc;
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === '💣') {
                                count++;
                            }
                        }
                    }
                    // Emoji seçimi
                    const numbers = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
                    grid[r][c] = count === 0 ? '🟦' : numbers[count];
                }
            }

            // String'e çevir (Spoiler ile)
            let content = `💣 **Mayın Tarlası** (${mines} Mayın)\n`;
            content += `Zorluk: ${difficulty === 1 ? 'Kolay' : (difficulty === 2 ? 'Orta' : 'Zor')}\n\n`;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    content += `||${grid[r][c]}||`;
                }
                content += '\n';
            }

            await interaction.reply({ content });
        }
    }
};
