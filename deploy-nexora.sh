#!/bin/bash

echo "🚀 Nexora Trainer V2 Deployment Starting..."
echo ""

# Navigate to project
cd /root/nexora || exit

# Stash local changes
echo "📦 Stashing local changes..."
cd trainer-web/client
git stash
cd ../..

# Pull from GitHub
echo "⬇️ Pulling from GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed!"
    exit 1
fi

# Install client dependencies
echo "📚 Installing client dependencies..."
cd trainer-web/client
npm install

# Build frontend
echo "🏗️ Building frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Install server dependencies
echo "📚 Installing server dependencies..."
cd ../server
npm install

# Restart backend
echo "🔄 Restarting backend..."
pm2 restart Nexora_Trainer_API

# Reload Nginx
echo "🌐 Reloading Nginx..."
sudo systemctl reload nginx

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 PM2 Status:"
pm2 status
echo ""
echo "📝 Recent logs:"
pm2 logs Nexora_Trainer_API --lines 10 --nostream

echo ""
echo "🎉 Nexora Trainer V2 deployed successfully!"
echo "🌐 Visit: https://neuroviabot.xyz"
echo ""
