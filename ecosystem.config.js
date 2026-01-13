module.exports = {
    apps: [{
        name: 'agile-poker',
        script: 'server.js',

        // Environment
        env: {
            NODE_ENV: 'production',
            PORT: 3025
        },
        // Process management
        instances: 1,              // WebSocket requires single instance (sticky sessions)
        exec_mode: 'fork',         // Fork mode for WebSocket compatibility

        // Logging
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        error_file: './logs/error.log',
        out_file: './logs/out.log',
        merge_logs: true,

        // Restart behavior
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s',
        restart_delay: 4000,

        // Memory management
        max_memory_restart: '500M',

        // Watch (disable in production)
        watch: false,
        ignore_watch: ['node_modules', 'logs', '.git']
    }]
};
