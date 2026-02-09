module.exports = {
    apps: [
        {
            name: "Nexora_Trainer_API",
            cwd: "./server",
            script: "./index.js",
            watch: false,
            env: {
                NODE_ENV: "production"
            },
            error_file: "./logs/err.log",
            out_file: "./logs/out.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss Z"
        }
    ]
};
