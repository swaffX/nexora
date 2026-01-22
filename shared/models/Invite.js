const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
    code: { type: String, required: true },
    odaId: { type: String, required: true },
    inviterId: { type: String, required: true },
    uses: { type: Number, default: 0 }
});

inviteSchema.index({ code: 1, odaId: 1 }, { unique: true });

module.exports = mongoose.model('Invite', inviteSchema);
