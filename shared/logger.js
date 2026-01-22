const chalk = require('chalk');
const moment = require('moment');

const getTimestamp = () => moment().format('YYYY-MM-DD HH:mm:ss');

const logger = {
    info: (message, ...args) => {
        console.log(chalk.blue(`[${getTimestamp()}] [INFO]`), message, ...args);
    },

    success: (message, ...args) => {
        console.log(chalk.green(`[${getTimestamp()}] [SUCCESS]`), message, ...args);
    },

    warn: (message, ...args) => {
        console.log(chalk.yellow(`[${getTimestamp()}] [WARN]`), message, ...args);
    },

    error: (message, ...args) => {
        console.log(chalk.red(`[${getTimestamp()}] [ERROR]`), message, ...args);
    },

    debug: (message, ...args) => {
        if (process.env.DEBUG === 'true') {
            console.log(chalk.gray(`[${getTimestamp()}] [DEBUG]`), message, ...args);
        }
    },

    command: (user, command, guild) => {
        console.log(chalk.cyan(`[${getTimestamp()}] [COMMAND]`),
            `${user} used /${command} in ${guild}`);
    },

    guard: (type, message) => {
        console.log(chalk.magenta(`[${getTimestamp()}] [GUARD-${type}]`), message);
    }
};

module.exports = logger;
