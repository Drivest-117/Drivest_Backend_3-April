# EC2 Deployment

This backend can be deployed to an EC2 instance with Node.js, PM2, and PostgreSQL client tools installed.

## Required Secrets

- `EC2_HOST`
- `EC2_USER`
- `EC2_PORT`
- `EC2_SSH_KEY`

## Server Prep

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql-client rsync
sudo npm install -g pm2
sudo mkdir -p /var/www/drivest-backend /var/www/drivest-backend-dev
sudo chown -R ubuntu:ubuntu /var/www/drivest-backend /var/www/drivest-backend-dev
```

Create the production environment file on the EC2 instance:

```bash
cd /var/www/drivest-backend
cp .env.example .env
```

Create the development environment file separately:

```bash
cd /var/www/drivest-backend-dev
cp /var/www/drivest-backend/.env.example .env
```

Change at least:

- `PORT=3001`
- `APP_ENV=dev`
- `DATABASE_URL`
- any external service credentials that should not point at production resources

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
SSH_KEY_PATH=~/.ssh/your-key.pem \
npm run deploy:ec2:prod
```

Manual development deploy from a local machine:

```bash
cd drivestBackend
EC2_HOST=your-host \
EC2_USER=ubuntu \
SSH_KEY_PATH=~/.ssh/your-key.pem \
npm run deploy:ec2:dev
```

GitHub Actions deploy:

- Add the required `EC2_HOST`, `EC2_USER`, `EC2_PORT`, and `EC2_SSH_KEY` secrets in GitHub.
- Push to `main` to deploy production automatically.
- Run `Deploy Backend To EC2` manually with `deploy_env=dev` to deploy the development runtime.

## Runtime Checks

```bash
pm2 status
pm2 logs drivest-backend
pm2 logs drivest-backend-dev
curl http://localhost:3000/health
curl http://localhost:3000/docs
curl http://localhost:3001/health
```
