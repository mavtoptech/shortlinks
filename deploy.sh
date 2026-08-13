#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting Deployment on VPS..."

# 1. Install prerequisites
echo "📦 Installing dependencies (Node.js 20, PostgreSQL, Nginx)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get update
apt-get install -y nodejs postgresql postgresql-contrib nginx

# 2. Setup PostgreSQL
echo "🗄️ Configuring PostgreSQL Database..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" || true
sudo -u postgres psql -c "CREATE DATABASE urlshortener;" || true

# 3. Configure Environment Variables
echo "⚙️ Configuring Environment Variables..."
cd /var/www/url_shortner
# Update the domain to use the real domain
sed -i 's/NEXT_PUBLIC_APP_DOMAIN=.*/NEXT_PUBLIC_APP_DOMAIN="shortlinks.fun"/' .env
sed -i 's/NEXT_PUBLIC_CNAME_TARGET=.*/NEXT_PUBLIC_CNAME_TARGET="shortlinks.fun"/' .env

# 4. Build Application
echo "🏗️ Building Next.js Application..."
npm install
npm install -g pm2
npx prisma generate
npx prisma db push --accept-data-loss
npm run build

# 5. Start Application with PM2
echo "🔄 Starting App with PM2..."
pm2 delete url-shortener || true
pm2 start npm --name "url-shortener" -- start
pm2 save
pm2 startup | grep -v 'sudo' | bash || true

# 6. Configure Nginx Reverse Proxy
echo "🌐 Configuring Nginx Reverse Proxy..."
cat > /etc/nginx/sites-available/urlshortener << 'EOF'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/urlshortener /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

echo "✅ Deployment Complete! Visit http://103.109.181.40 in your browser."
