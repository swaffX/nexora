# NEXORA - Multi-Bot Discord System

🛡️ **5-Bot Discord Management System** for Nexora community, featuring advanced moderation, anti-raid, leveling, and competitive gaming features.

## 🌟 Features

### Main Bot
- ⚔️ **5v5 Scrim System** - Automated match setup with voice channel management
- 🎮 **Registration & Verification** - User onboarding with role assignment
- 📊 **Leveling System** - XP from messages and voice activity
- 📈 **Server Statistics & Leaderboards** - Auto-updating stats for XP, messages, and voice time
- 🔨 **Moderation Tools** - Ban, kick, mute, purge, warn commands
- 👋 **Welcome System** - Customizable welcome messages

### Guard Bots (1, 2, 3)
- 🛡️ **Guard Bot 1** - Anti-Raid Protection
- 🚫 **Guard Bot 2** - Anti-Spam Protection  
- ⚠️ **Guard Bot 3** - Anti-Nuke Protection

### Backup Bot
- 💾 **Backup Bot** - Automatic server backup and recovery

## 🏗️ Project Structure

```
nexora/
├── main-bot/          # Main management bot
├── guard-bot-1/       # Anti-Raid protection
├── guard-bot-2/       # Anti-Spam protection
├── guard-bot-3/       # Anti-Nuke protection
├── backup-bot/        # Backup system
├── shared/            # Shared utilities, models, and configs
└── ecosystem.config.js # PM2 configuration for all bots
```

## 📦 Installation

### Prerequisites
- Node.js v18+ 
- MongoDB
- Discord Bot Tokens (5 bots)

### Setup

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/nexora.git
cd nexora
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**

Create `.env` files for each bot:

**Root `.env`:**
```env
MONGODB_URI=mongodb://localhost:27017/nexora
GUILD_ID=YOUR_GUILD_ID
```

**`main-bot/.env`:**
```env
TOKEN=YOUR_MAIN_BOT_TOKEN
CLIENT_ID=YOUR_MAIN_BOT_CLIENT_ID
```

**`guard-bot-1/.env`:**
```env
TOKEN=YOUR_GUARD_BOT_1_TOKEN
CLIENT_ID=YOUR_GUARD_BOT_1_CLIENT_ID
```

**`guard-bot-2/.env`:**
```env
TOKEN=YOUR_GUARD_BOT_2_TOKEN
CLIENT_ID=YOUR_GUARD_BOT_2_CLIENT_ID
```

**`guard-bot-3/.env`:**
```env
TOKEN=YOUR_GUARD_BOT_3_TOKEN
CLIENT_ID=YOUR_GUARD_BOT_3_CLIENT_ID
```

**`backup-bot/.env`:**
```env
TOKEN=YOUR_BACKUP_BOT_TOKEN
CLIENT_ID=YOUR_BACKUP_BOT_CLIENT_ID
```

4. **Deploy Slash Commands:**
```bash
node force-clean-all.js
```

5. **Start all bots with PM2:**
```bash
npm start
```

## 🚀 VPS Deployment Guide

### On Your VPS:

1. **Install Node.js and MongoDB:**
```bash
# Install Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
sudo apt-get install -y mongodb

# Install PM2 globally
sudo npm install -g pm2
```

2. **Clone and Setup:**
```bash
git clone https://github.com/YOUR_USERNAME/nexora.git
cd nexora
npm install
```

3. **Configure `.env` files** (same as above)

4. **Deploy commands and start:**
```bash
node force-clean-all.js
npm start
```

5. **Setup PM2 to auto-restart on server reboot:**
```bash
pm2 startup
pm2 save
```

## 📊 Bot Management Commands

```bash
npm start         # Start all bots
npm stop          # Stop all bots  
npm restart       # Restart all bots
npm run logs      # View logs (or: npx pm2 logs)
npm run dashboard # PM2 dashboard
```

## 🎮 Main Commands

### Match System
- `/setup-match` - Deploy match creation panel in a channel

### Moderation
- `/ban` - Ban a user
- `/kick` - Kick a user
- `/mute` - Mute a user temporarily
- `/purge` - Bulk delete messages
- `/warn` - Warn a user

### Registration
- `/setup-verify` - Setup registration system
- `/unregister` - Unregister a user

### Leveling
- `/level` - Check your level
- `/leaderboard` - View server leaderboard

### Welcome
- `/setwelcome` - Configure welcome messages

## 🔧 Configuration

All bots auto-join voice channel ID: `1463921161925558485`
Match lobby voice channel ID: `1463922466467483801`

## 🛠️ Technologies Used

- **Discord.js** v14
- **Mongoose** (MongoDB ODM)
- **PM2** (Process Manager)
- **@discordjs/voice** (Voice Channel Support)

## 📝 License

Private Project - All Rights Reserved

## 👨‍💻 Author

**Swaff** - [Twitch](https://www.twitch.tv/swaffxedits)

---

Made with ❤️ for Nexora Community
