const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
    backupId: { type: String, required: true, unique: true },
    odaId: { type: String, required: true },
    createdBy: { type: String, required: true },
    name: { type: String, default: 'Backup' },

    // Sunucu bilgileri
    guildData: {
        name: { type: String },
        icon: { type: String },
        splash: { type: String },
        banner: { type: String },
        verificationLevel: { type: Number },
        defaultMessageNotifications: { type: Number },
        afkTimeout: { type: Number },
        afkChannelId: { type: String }
    },

    // Roller
    roles: [{
        id: { type: String },
        name: { type: String },
        color: { type: Number },
        hoist: { type: Boolean },
        position: { type: Number },
        permissions: { type: String },
        mentionable: { type: Boolean }
    }],

    // Kanallar
    channels: [{
        id: { type: String },
        name: { type: String },
        type: { type: Number },
        position: { type: Number },
        parentId: { type: String },
        topic: { type: String },
        nsfw: { type: Boolean },
        rateLimitPerUser: { type: Number },
        bitrate: { type: Number },
        userLimit: { type: Number },
        permissionOverwrites: [{
            id: { type: String },
            type: { type: Number },
            allow: { type: String },
            deny: { type: String }
        }]
    }],

    // Bot verileri
    botData: {
        guildsettings: { type: mongoose.Schema.Types.Mixed },
        users: [{ type: mongoose.Schema.Types.Mixed }]
    },

    // Emojiler
    emojis: [{
        name: { type: String },
        url: { type: String }
    }],

    size: { type: Number, default: 0 }  // Byte cinsinden

}, { timestamps: true });

backupSchema.index({ odaId: 1 });
// backupId için index kaldırıldı (unique: true yeterli)

module.exports = mongoose.model('Backup', backupSchema);
