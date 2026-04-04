const appName = process.env.PM2_APP_NAME || 'drivest-backend';

module.exports = {
  apps: [
    {
      name: appName,
      cwd: __dirname,
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        APP_ENV: process.env.APP_ENV || 'prod',
        PM2_APP_NAME: appName,
        PORT: process.env.PORT || 3000,
        APP_VERSION: process.env.APP_VERSION || require('./package.json').version,
        DEPLOY_GIT_SHA: process.env.DEPLOY_GIT_SHA || '',
        DEPLOY_GIT_REF: process.env.DEPLOY_GIT_REF || '',
        DEPLOYED_AT: process.env.DEPLOYED_AT || '',
        DEPLOY_RUN_ID: process.env.DEPLOY_RUN_ID || '',
        DEPLOY_RUN_NUMBER: process.env.DEPLOY_RUN_NUMBER || '',
      },
    },
  ],
};
