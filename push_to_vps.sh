#!/bin/bash
# ============================================================
#  PUSH SUPABASE INSTALLER TO VPS & RUN IT
#  VPS IP   : 103.109.181.40
#  VPS User : root
#  Domain   : data.mavtop.in
#  Run this : on YOUR Mac
# ============================================================

VPS_IP="103.109.181.40"
VPS_USER="root"
INSTALL_SCRIPT="$(dirname "$0")/vps_install_supabase.sh"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 -o ServerAliveInterval=60 -o ServerAliveCountMax=10"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   SUPABASE VPS INSTALLER - MAVTOP            ║"
echo "  ║   Target: ${VPS_IP}                   ║"
echo "  ║   Domain: data.mavtop.in                    ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Check install script exists ──────────────────────────
if [ ! -f "$INSTALL_SCRIPT" ]; then
    echo -e "${RED}[✗] Cannot find vps_install_supabase.sh${NC}"
    echo "    Make sure both files are in the same directory!"
    exit 1
fi

# ── Install sshpass if not available ─────────────────────
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}[!] Installing sshpass via Homebrew...${NC}"
    brew install hudochenkov/sshpass/sshpass
fi

# ── Clear old host key to prevent hanging ────────────────
echo -e "${YELLOW}[~] Clearing old SSH host key (prevents hang)...${NC}"
ssh-keygen -R ${VPS_IP} 2>/dev/null || true

# ── Ask for password securely ─────────────────────────────
echo ""
echo -e "${YELLOW}Enter your VPS root password (typing is hidden):${NC}"
read -s VPS_PASSWORD
echo ""

if [ -z "$VPS_PASSWORD" ]; then
    echo -e "${RED}[✗] Password cannot be empty${NC}"
    exit 1
fi

# Export for sshpass to use
export SSHPASS="$VPS_PASSWORD"

# ── Test SSH connection ───────────────────────────────────
echo -e "${BLUE}[→] Testing SSH connection to ${VPS_IP}...${NC}"

TEST=$(sshpass -e ssh $SSH_OPTS ${VPS_USER}@${VPS_IP} "echo OK" 2>&1)

if [[ "$TEST" != "OK" ]]; then
    echo -e "${RED}[✗] SSH connection failed!${NC}"
    echo "    Error: $TEST"
    echo ""
    echo "  Possible fixes:"
    echo "  1. Wrong password — try again"
    echo "  2. Check VPS firewall allows port 22"
    echo "  3. Try direct: ssh root@103.109.181.40"
    unset SSHPASS
    exit 1
fi

echo -e "${GREEN}[✓] SSH connection successful!${NC}"

# ── Upload install script ────────────────────────────────
echo -e "${BLUE}[→] Uploading install script to VPS...${NC}"

sshpass -e scp $SSH_OPTS \
    "$INSTALL_SCRIPT" \
    ${VPS_USER}@${VPS_IP}:/root/vps_install_supabase.sh

echo -e "${GREEN}[✓] Script uploaded to /root/vps_install_supabase.sh${NC}"

# ── Run installer on VPS ─────────────────────────────────
echo -e "${BLUE}[→] Running installer on VPS...${NC}"
echo -e "${YELLOW}    This takes 5-10 minutes. You'll see live output:${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sshpass -e ssh $SSH_OPTS \
    -t ${VPS_USER}@${VPS_IP} \
    "chmod +x /root/vps_install_supabase.sh && bash /root/vps_install_supabase.sh"

RESULT=$?
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Clean up password from environment ───────────────────
unset SSHPASS

if [ $RESULT -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ INSTALLATION COMPLETE!                   ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""

    # Re-ask password to fetch credentials (SSHPASS was unset)
    export SSHPASS="$VPS_PASSWORD"

    echo -e "${YELLOW}[→] Downloading credentials from VPS...${NC}"
    sshpass -e scp $SSH_OPTS \
        ${VPS_USER}@${VPS_IP}:/root/supabase-credentials.txt \
        "$(dirname "$0")/supabase-credentials.txt" 2>/dev/null

    unset SSHPASS

    if [ -f "$(dirname "$0")/supabase-credentials.txt" ]; then
        echo -e "${GREEN}[✓] Credentials saved to: supabase-credentials.txt${NC}"
        echo ""
        cat "$(dirname "$0")/supabase-credentials.txt"
    fi
else
    echo -e "${RED}[✗] Installation had errors. Check the output above.${NC}"
    echo ""
    echo "  SSH in manually to check:"
    echo "  ssh root@${VPS_IP}"
    echo "  cd /opt/supabase/docker && docker compose ps"
fi
