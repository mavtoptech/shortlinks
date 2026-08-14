#!/bin/bash
# ============================================================
#  VPS WIPE + SUPABASE SELF-HOST INSTALLER
#  Server : 103.109.181.40
#  Domain : data.mavtop.in
#  Run as : root
# ============================================================

set -e  # Exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
header() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

DOMAIN="data.mavtop.in"
SUPABASE_DIR="/opt/supabase"
EMAIL="admin@mavtop.in"

# ──────────────────────────────────────────────
# STEP 1: WIPE EXISTING SERVICES
# ──────────────────────────────────────────────
header "STEP 1: Wiping Existing Services"

warn "Stopping all running Docker containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm -f $(docker ps -aq) 2>/dev/null || true
docker system prune -af --volumes 2>/dev/null || true
log "Docker cleaned"

warn "Stopping and removing Nginx..."
systemctl stop nginx 2>/dev/null || true
apt-get remove -y nginx nginx-common nginx-full 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true
rm -rf /etc/nginx 2>/dev/null || true
log "Nginx removed"

warn "Stopping Node/PM2 processes..."
pkill -f "node" 2>/dev/null || true
pkill -f "pm2" 2>/dev/null || true
npm remove -g pm2 2>/dev/null || true
log "Node processes killed"

warn "Cleaning old Supabase directory..."
rm -rf $SUPABASE_DIR 2>/dev/null || true
log "Old Supabase removed"

warn "Freeing ports 80, 443, 8000, 3000..."
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
log "Ports freed"

# ──────────────────────────────────────────────
# STEP 2: SYSTEM UPDATE
# ──────────────────────────────────────────────
header "STEP 2: Updating System"

apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl git wget nano htop \
  ca-certificates gnupg lsb-release \
  ufw openssl net-tools psmisc

log "System updated"

# ──────────────────────────────────────────────
# STEP 3: INSTALL DOCKER
# ──────────────────────────────────────────────
header "STEP 3: Installing Docker"

apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

log "Docker installed: $(docker --version)"
log "Docker Compose: $(docker compose version)"

# ──────────────────────────────────────────────
# STEP 4: INSTALL NGINX & CERTBOT
# ──────────────────────────────────────────────
header "STEP 4: Installing Nginx & Certbot"

apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx

log "Nginx installed"

# ──────────────────────────────────────────────
# STEP 5: FIREWALL SETUP
# ──────────────────────────────────────────────
header "STEP 5: Configuring Firewall"

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "Firewall configured"

# ──────────────────────────────────────────────
# STEP 6: GENERATE SECRETS
# ──────────────────────────────────────────────
header "STEP 6: Generating Secrets"

JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
DASHBOARD_PASSWORD=$(openssl rand -hex 12)

# Generate ANON_KEY
ANON_HEADER_B64=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 -w 0 | tr '+/' '-_' | tr -d '=')
ANON_PAYLOAD_B64=$(echo -n "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":1714521600,\"exp\":1872288000}" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
ANON_SIG=$(printf '%s' "${ANON_HEADER_B64}.${ANON_PAYLOAD_B64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 -w 0 | tr '+/' '-_' | tr -d '=')
ANON_KEY="${ANON_HEADER_B64}.${ANON_PAYLOAD_B64}.${ANON_SIG}"

# Generate SERVICE_ROLE_KEY
SVC_HEADER_B64=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 -w 0 | tr '+/' '-_' | tr -d '=')
SVC_PAYLOAD_B64=$(echo -n "{\"role\":\"service_role\",\"iss\":\"supabase\",\"iat\":1714521600,\"exp\":1872288000}" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
SVC_SIG=$(printf '%s' "${SVC_HEADER_B64}.${SVC_PAYLOAD_B64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 -w 0 | tr '+/' '-_' | tr -d '=')
SERVICE_ROLE_KEY="${SVC_HEADER_B64}.${SVC_PAYLOAD_B64}.${SVC_SIG}"

log "Secrets generated"

# ──────────────────────────────────────────────
# STEP 7: CLONE SUPABASE
# ──────────────────────────────────────────────
header "STEP 7: Cloning Supabase"

git clone --depth 1 https://github.com/supabase/supabase $SUPABASE_DIR
cd $SUPABASE_DIR/docker
cp .env.example .env

log "Supabase cloned to $SUPABASE_DIR"

# ──────────────────────────────────────────────
# STEP 8: CONFIGURE .env
# ──────────────────────────────────────────────
header "STEP 8: Configuring Supabase Environment"

cat > $SUPABASE_DIR/docker/.env << ENVEOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432
DB_DRIVER=postgres
SITE_URL=https://${DOMAIN}
API_EXTERNAL_URL=https://${DOMAIN}
SUPABASE_PUBLIC_URL=https://${DOMAIN}
DISABLE_SIGNUP=false
GOTRUE_SITE_URL=https://${DOMAIN}
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_SECRET=${JWT_SECRET}
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMS_AUTOCONFIRM=true
SMTP_ADMIN_EMAIL=admin@mavtop.in
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SENDER_NAME=Mavtop
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
STORAGE_BACKEND=file
GLOBAL_S3_BUCKET=supabase
IMGPROXY_ENABLE_WEBP_DETECTION=true
REPLICATION_MODE=RLS
REPLICATION_POLL_INTERVAL=100
SECURE_CHANNELS=true
SLOT_NAME=supabase_realtime_rls
TEMPORARY_SLOT=true
STUDIO_DEFAULT_ORGANIZATION=Mavtop
STUDIO_DEFAULT_PROJECT=Mavtop DB
STUDIO_PORT=3000
NEXT_PUBLIC_ENABLE_LOGS=true
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
ENVEOF

log ".env configured"

# ──────────────────────────────────────────────
# STEP 9: START SUPABASE
# ──────────────────────────────────────────────
header "STEP 9: Pulling Docker Images & Starting Supabase"

cd $SUPABASE_DIR/docker
docker compose pull
docker compose up -d

log "Waiting 45s for services to start..."
sleep 45

log "Supabase service status:"
docker compose ps

# ──────────────────────────────────────────────
# STEP 10: NGINX CONFIG
# ──────────────────────────────────────────────
header "STEP 10: Configuring Nginx"

cat > /etc/nginx/sites-available/supabase << 'NGINXEOF'
server {
    listen 80;
    server_name data.mavtop.in;

    client_max_body_size 100M;

    # Supabase Studio dashboard
    location /studio {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # All API traffic → Kong gateway
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (Realtime)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;

        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, apikey, x-client-info";
            return 204;
        }
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/supabase /etc/nginx/sites-enabled/supabase
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
log "Nginx configured for ${DOMAIN}"

# ──────────────────────────────────────────────
# STEP 11: SSL CERTIFICATE
# ──────────────────────────────────────────────
header "STEP 11: SSL Certificate"

echo ""
warn "DNS CHECK: Make sure data.mavtop.in A record → 103.109.181.40 in your domain registrar!"
echo ""
read -p "Is DNS configured and propagated? (yes/skip): " DNS_READY

if [ "$DNS_READY" = "yes" ]; then
    certbot --nginx -d $DOMAIN \
        --non-interactive \
        --agree-tos \
        --email $EMAIL \
        --redirect
    log "✅ SSL installed!"
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | crontab -
    log "SSL auto-renewal cron added"
else
    warn "Skipping SSL. Run this later:"
    echo "  certbot --nginx -d data.mavtop.in --non-interactive --agree-tos --email admin@mavtop.in --redirect"
fi

# ──────────────────────────────────────────────
# STEP 12: SYSTEMD AUTO-RESTART
# ──────────────────────────────────────────────
header "STEP 12: Auto-Restart on Reboot"

cat > /etc/systemd/system/supabase.service << 'SVCEOF'
[Unit]
Description=Supabase Self-Hosted
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/supabase/docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable supabase
log "Supabase will auto-start on reboot"

# ──────────────────────────────────────────────
# STEP 13: DAILY BACKUPS
# ──────────────────────────────────────────────
header "STEP 13: Daily Backup Setup"

mkdir -p /opt/backups

cat > /opt/backup-supabase.sh << 'BKPEOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/backups
mkdir -p $BACKUP_DIR
docker exec supabase-db pg_dumpall -U postgres > $BACKUP_DIR/db_$DATE.sql
gzip $BACKUP_DIR/db_$DATE.sql
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
echo "[$(date)] Backup: db_$DATE.sql.gz"
BKPEOF

chmod +x /opt/backup-supabase.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-supabase.sh >> /var/log/supabase-backup.log 2>&1") | crontab -
log "Daily 2AM backup scheduled"

# ──────────────────────────────────────────────
# DONE — PRINT & SAVE CREDENTIALS
# ──────────────────────────────────────────────
CREDS_FILE="/root/supabase-credentials.txt"

cat > $CREDS_FILE << CREDSEOF
==============================================
  SUPABASE CREDENTIALS — SAVE THIS FILE!
  Domain : data.mavtop.in
  Server : 103.109.181.40
  Date   : $(date)
==============================================

📊 STUDIO DASHBOARD
  URL      : http://data.mavtop.in/studio
  Username : admin
  Password : ${DASHBOARD_PASSWORD}

🔌 SUPABASE API
  URL              : https://data.mavtop.in
  Anon Key         : ${ANON_KEY}
  Service Role Key : ${SERVICE_ROLE_KEY}

🗄️  DATABASE (Direct)
  Host     : 103.109.181.40
  Port     : 5432
  Name     : postgres
  User     : postgres
  Password : ${POSTGRES_PASSWORD}
  Full URL : postgresql://postgres:${POSTGRES_PASSWORD}@103.109.181.40:5432/postgres

🔐 SECRETS
  JWT_SECRET : ${JWT_SECRET}

==============================================
  YOUR NEXT.JS .env.local VARIABLES:
==============================================
NEXT_PUBLIC_SUPABASE_URL=https://data.mavtop.in
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@103.109.181.40:5432/postgres
==============================================
CREDSEOF

chmod 600 $CREDS_FILE

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 SUPABASE INSTALLED SUCCESSFULLY!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  📊 Studio:    ${BLUE}http://data.mavtop.in/studio${NC}"
echo -e "  🔌 API URL:   ${BLUE}http://data.mavtop.in${NC}"
echo -e "  👤 Username:  ${YELLOW}admin${NC}"
echo -e "  🔑 Password:  ${YELLOW}${DASHBOARD_PASSWORD}${NC}"
echo ""
echo -e "  📄 Full credentials: ${YELLOW}${CREDS_FILE}${NC}"
echo ""
echo -e "  ${YELLOW}⚠️  Next Steps:${NC}"
echo -e "  1. Point data.mavtop.in → 103.109.181.40 in DNS"
echo -e "  2. Run: certbot --nginx -d data.mavtop.in (for HTTPS)"
echo -e "  3. Update your Next.js .env with the values above"
echo ""
