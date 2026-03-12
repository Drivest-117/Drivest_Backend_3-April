# EC2 Deployment

This backend can be deployed to an EC2 instance with Node.js, PM2, and PostgreSQL client tools installed.

## Required Secrets

- `EC2_HOST`
- `EC2_USER`
- `EC2_PORT`
- `EC2_APP_DIR`
- `EC2_SSH_KEY`

## Server Prep

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql-client rsync
sudo npm install -g pm2
mkdir -p /var/www/route-master-backend
```

Create the production environment file on the EC2 instance:

```bash
cd /var/www/route-master-backend
cp .env.example .env
```

Set at least:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `REVENUECAT_WEBHOOK_SECRET`
- `PASSWORD_RESET_CODE_TTL_MINUTES`
- `PASSWORD_RESET_EXPOSE_CODE=false`
- `APNS_KEY_ID`
- `APNS_TEAM_ID`
- `APNS_BUNDLE_ID`
- `APNS_PRIVATE_KEY_BASE64`
- `APNS_ENV`

## Deploy Modes

Manual deploy from a local machine:

```bash
cd drivestBackend
EC2_HOST=your-host \
EC2_USER=ubuntu \
EC2_APP_DIR=/var/www/route-master-backend \
SSH_KEY_PATH=~/.ssh/your-key.pem \
npm run deploy:ec2
```

GitHub Actions deploy:

- Add the required `EC2_*` secrets in GitHub.
- Push to `main` or run the `Deploy Backend To EC2` workflow manually.

## Runtime Checks

```bash
pm2 status
pm2 logs route-master-backend
curl http://localhost:3000/health
curl http://localhost:3000/docs
```
