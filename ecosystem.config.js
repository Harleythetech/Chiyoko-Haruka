module.exports = {
  apps: [
    {
      name: 'Chiyoko-Haruka',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '215M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Process priority set to high
      priority: 'high',
      
      // Logging configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Advanced PM2 features
      merge_logs: true,
      time: true,
      
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      
      // Process monitoring
      pmx: true,
      
      // Kill timeout
      kill_timeout: 5000,
      
      // Listen timeout  
      listen_timeout: 8000,
      
      // Graceful shutdown
      shutdown_with_message: true,
      
      // Windows specific settings
      windowsHide: true,
      
      // Additional process options for Windows
      node_args: '--max-old-space-size=215 --expose-gc',
      
      // Health monitoring
      health_check_grace_period: 3000,
      
      // Auto restart conditions
      ignore_watch: [
        'node_modules',
        'logs',
        'downloads',
        '.git'
      ],
      
      // Resource limits
      max_memory_restart: '215M',
      
      // Cluster settings (disabled since Discord bots shouldn't run in cluster mode)
      exec_mode: 'fork',
      
      // Environment variables (you may need to adjust these)
      env_file: '.env'
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/Harleythetech/Chiyoko-Haruka.git',
      path: '/var/www/chiyoko-haruka',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
