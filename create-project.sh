#!/bin/bash
# ============================================================
#  CREATE NEW SUPABASE PROJECT ON VPS
#  Usage: ./create-project.sh <project_name> <domain>
#  Example: ./create-project.sh client2 client2.mavtop.in
# ============================================================

set -e

PROJECT_NAME=$1
DOMAIN=$2

if [ -z "$PROJECT_NAME" ] || [ -z "$DOMAIN" ]; then
    echo "Usage: ./create-project.sh <project_name> <domain>"
    echo "Example: ./create-project.sh app2 app2.mavtop.in"
    exit 1
fi

PROJECT_DIR="/opt/supabase-${PROJECT_NAME}"

if [ -d "$PROJECT_DIR" ]; then
    echo "[!] Project ${PROJECT_NAME} already exists at ${PROJECT_DIR}!"
    exit 1
fi

echo "🚀 Creating new Supabase project: ${PROJECT_NAME} (${DOMAIN})..."

git clone --depth 1 https://github.com/supabase/supabase "$PROJECT_DIR"
cd "$PROJECT_DIR/docker"
cp .env.example .env

OFFSET=$(( ( RANDOM % 800 ) + 100 ))
PORT_KONG=$(( 8000 + OFFSET ))
PORT_STUDIO=$(( 3000 + OFFSET ))
PORT_DB=$(( 5432 + OFFSET ))

JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
DASHBOARD_PASSWORD=$(openssl rand -hex 12)

ANON_H=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
ANON_P=$(echo -n '{"role":"anon","iss":"supabase","iat":1714521600,"exp":1872288000}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
ANON_S=$(printf '%s' "${ANON_H}.${ANON_P}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 -w0 | tr '+/' '-_' | tr -d '=')
ANON_KEY="${ANON_H}.${ANON_P}.${ANON_S}"

SVC_H=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
SVC_P=$(echo -n '{"role":"service_role","iss":"supabase","iat":1714521600,"exp":1872288000}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
SVC_S=$(printf '%s' "${SVC_H}.${SVC_P}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 -w0 | tr '+/' '-_' | tr -d '=')
SERVICE_ROLE_KEY="${SVC_H}.${SVC_P}.${SVC_S}"

cat > .env << ENVEOF
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
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
STORAGE_BACKEND=file
GLOBAL_S3_BUCKET=supabase
IMGPROXY_ENABLE_WEBP_DETECTION=true
REPLICATION_MODE=RLS
REPLICATION_POLL_INTERVAL=100
SECURE_CHANNELS=true
SLOT_NAME=supabase_realtime_rls
TEMPORARY_SLOT=true
STUDIO_DEFAULT_ORGANIZATION=${PROJECT_NAME}
STUDIO_DEFAULT_PROJECT=${PROJECT_NAME}
STUDIO_PORT=${PORT_STUDIO}
KONG_HTTP_PORT=${PORT_KONG}
KONG_HTTPS_PORT=$(( PORT_KONG + 443 ))
ENVEOF

sed -i "s/\"5432:5432\"/\"${PORT_DB}:5432\"/g" docker-compose.yml 2>/dev/null || true

docker compose up -d

cat > /etc/nginx/sites-available/${PROJECT_NAME} << NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 100M;

    location /studio {
        proxy_pass http://localhost:${PORT_STUDIO};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://localhost:${PORT_KONG};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/${PROJECT_NAME} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@mavtop.in --redirect 2>/dev/null || true

CREDS_FILE="/root/credentials-${PROJECT_NAME}.txt"
cat > $CREDS_FILE << CREDS
==============================================
  SUPABASE PROJECT: ${PROJECT_NAME}
  Domain: ${DOMAIN}
==============================================
STUDIO: https://${DOMAIN}/studio
  Username: admin
  Password: ${DASHBOARD_PASSWORD}

API URL: https://${DOMAIN}
ANON_KEY: ${ANON_KEY}
SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@103.109.181.40:${PORT_DB}/postgres
==============================================
CREDS

echo ""
echo "🎉 PROJECT ${PROJECT_NAME} CREATED SUCCESSFULLY!"
echo "📊 Studio Dashboard: https://${DOMAIN}/studio"
echo "📄 Credentials saved at: $CREDS_FILE"
echo ""
cat $CREDS_FILE
