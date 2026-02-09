const DiscordStrategy = require('passport-discord').Strategy;

module.exports = function(passport) {
    passport.serializeUser((user, done) => {
        done(null, user);
    });

    passport.deserializeUser((obj, done) => {
        done(null, obj);
    });

    passport.use(new DiscordStrategy({
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL,
        scope: ['identify', 'guilds']
    },
    (accessToken, refreshToken, profile, done) => {
        // Kullanıcı bilgilerini session'a kaydet
        const user = {
            id: profile.id,
            username: profile.username,
            discriminator: profile.discriminator,
            avatar: profile.avatar,
            guilds: profile.guilds || []
        };
        return done(null, user);
    }));
};
