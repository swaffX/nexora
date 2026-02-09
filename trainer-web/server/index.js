require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true
    }
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // 3D content için gerekli
}));

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 100 // IP başına 100 istek
});
app.use('/api/', limiter);

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'nexora-trainer-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 gün
    }
}));

// Passport
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// MongoDB Connection (Mevcut Nexora DB'yi kullan)
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB bağlantısı başarılı (Nexora Trainer)'))
.catch(err => {
    console.error('❌ MongoDB bağlantı hatası:', err);
    process.exit(1);
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/scores', require('./routes/scores'));
app.use('/api/settings', require('./routes/settings'));

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Nexora Trainer API',
        timestamp: new Date().toISOString()
    });
});

// Socket.io - Real-time Leaderboard Updates
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.on('join-leaderboard', (mapId) => {
        socket.join(`leaderboard-${mapId}`);
        console.log(`User joined leaderboard: ${mapId}`);
    });
    
    socket.on('leave-leaderboard', (mapId) => {
        socket.leave(`leaderboard-${mapId}`);
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Leaderboard güncelleme fonksiyonu (score submit'ten çağrılacak)
app.set('io', io);

// Error Handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Start Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Nexora Trainer API running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await mongoose.disconnect();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
