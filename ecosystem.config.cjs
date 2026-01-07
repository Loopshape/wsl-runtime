/**
 * ecosystem.config.cjs
 * 
 * PM2 Configuration for AI Runlevel
 * Purpose: Ensures the runlevel orchestrator starts on boot, manages logs, and restarts on failure.
 * This acts as the "systemd unit" equivalent for the user space.
 */

module.exports = {
  apps: [
    {
      name: 'ai-runlevel',
      script: './ai-runlevel.mjs',
      cwd: '/home/loop/.repository/wsl-systemd',
      interpreter: 'node',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      out_file: './logs/runlevel.out.log',
      error_file: './logs/runlevel.err.log',
      combine_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PATH: process.env.PATH
      }
    },
    {
      name: 'webtracon-server',
      script: './server/server.mjs',
      cwd: '/home/loop/.repository/wsl-systemd',
      interpreter: 'node',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      out_file: './logs/server.out.log',
      error_file: './logs/server.err.log',
      combine_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PATH: process.env.PATH
      }
    }
  ]
};
