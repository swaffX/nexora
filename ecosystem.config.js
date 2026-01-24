module.exports = {
    apps: [
        {
            name: "Main_Bot",
            cwd: "./main-bot",
            script: "./src/index.js",
            watch: ["src"],
            ignore_watch: ["node_modules", ".env"],
        },
        {
            name: "Guard_1_AntiRaid",
            cwd: "./guard-bot-1",
            script: "./src/index.js",
            watch: ["src"],
            ignore_watch: ["node_modules", ".env"],
        },
        {
            name: "Guard_2_AntiSpam",
            cwd: "./guard-bot-2",
            script: "./src/index.js",
            watch: ["src"],
            ignore_watch: ["node_modules", ".env"],
        },
        {
            name: "Guard_3_AntiNuke",
            cwd: "./guard-bot-3",
            script: "./src/index.js",
            watch: ["src"],
            ignore_watch: ["node_modules", ".env"],
        },
        {
            name: "Backup_Bot",
            cwd: "./backup-bot",
            script: "./src/index.js",
            watch: ["src"],
            ignore_watch: ["node_modules", ".env"],
        },
        {
            name: "moderation-bot",
            script: "./moderation-bot/src/index.js",
            watch: false,
            ignore_watch: ["node_modules", "logs"],
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "welcome-bot",
            script: "./welcome-bot/src/index.js",
            watch: false,
            ignore_watch: ["node_modules", "logs"],
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "custom-bot",
            script: "./custom-bot/src/index.js",
            watch: false,
            ignore_watch: ["node_modules", "logs"],
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "status-bot",
            script: "./status-bot/src/index.js",
            watch: false,
            ignore_watch: ["node_modules", "logs"],
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "supervisor-bot",
            script: "./supervisor-bot/src/index.js",
            watch: false,
            ignore_watch: ["node_modules", "logs"],
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};
