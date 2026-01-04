#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Last War Alliance Manager - Debian Installation Script${NC}"
echo "========================================================"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}This script should NOT be run as root${NC}"
   echo "Please run as a regular user with sudo privileges"
   exit 1
fi

# Check if required commands exist
command -v sudo >/dev/null 2>&1 || { echo -e "${RED}sudo is required but not installed${NC}"; exit 1; }

# Variables
APP_NAME="lastwar"
APP_USER="lastwar"
APP_DIR="/opt/lastwar"
DATA_DIR="/var/lib/lastwar"
LOG_DIR="/var/log/lastwar"
DOMAIN=""

# Ask for domain
read -p "Enter your domain name (e.g., alliance.example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Domain name is required${NC}"
    exit 1
fi

# Ask for reverse proxy choice
echo ""
echo "Choose reverse proxy:"
echo "1) Caddy (Recommended - Automatic HTTPS)"
echo "2) Nginx (Manual Let's Encrypt setup)"
read -p "Enter choice [1-2]: " PROXY_CHOICE

echo ""
echo -e "${YELLOW}Starting installation...${NC}"
echo ""

# Update system
echo -e "${GREEN}[1/10] Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y

# Install dependencies
echo -e "${GREEN}[2/10] Installing build dependencies...${NC}"
sudo apt install -y gcc build-essential curl wget git ufw fail2ban sqlite3

# Install Go
echo -e "${GREEN}[3/10] Installing Go...${NC}"
if ! command -v go &> /dev/null; then
    GO_VERSION="1.21.6"
    wget https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz
    sudo rm -rf /usr/local/go
    sudo tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz
    rm go${GO_VERSION}.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee -a /etc/profile
    export PATH=$PATH:/usr/local/go/bin
    go version
else
    echo "Go already installed: $(go version)"
fi

# Create application user
echo -e "${GREEN}[4/10] Creating application user...${NC}"
if ! id "$APP_USER" &>/dev/null; then
    sudo useradd -r -s /bin/false -d $APP_DIR $APP_USER
    echo "User $APP_USER created"
else
    echo "User $APP_USER already exists"
fi

# Create directories
echo -e "${GREEN}[5/10] Creating application directories...${NC}"
sudo mkdir -p $APP_DIR
sudo mkdir -p $DATA_DIR
sudo mkdir -p $LOG_DIR
sudo chown -R $APP_USER:$APP_USER $APP_DIR
sudo chown -R $APP_USER:$APP_USER $DATA_DIR
sudo chown -R $APP_USER:$APP_USER $LOG_DIR

# Build application
echo -e "${GREEN}[6/10] Building application...${NC}"
cd "$(dirname "$0")"
go build -o alliance-manager main.go
sudo cp alliance-manager $APP_DIR/
sudo cp -r static $APP_DIR/
sudo chown -R $APP_USER:$APP_USER $APP_DIR

# Generate session key
echo -e "${GREEN}[7/10] Generating secure session key...${NC}"
SESSION_KEY=$(openssl rand -hex 32)

# Create environment file
sudo tee $APP_DIR/.env > /dev/null <<EOF
DATABASE_PATH=$DATA_DIR/alliance.db
SESSION_KEY=$SESSION_KEY
PRODUCTION=true
HTTPS=true
PORT=8080
EOF
sudo chown $APP_USER:$APP_USER $APP_DIR/.env
sudo chmod 600 $APP_DIR/.env

# Install systemd service
echo -e "${GREEN}[8/10] Installing systemd service...${NC}"
sudo cp lastwar.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME

# Configure firewall
echo -e "${GREEN}[9/10] Configuring firewall...${NC}"
sudo ufw --force enable
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw status

# Install and configure reverse proxy
echo -e "${GREEN}[10/10] Installing reverse proxy...${NC}"

if [ "$PROXY_CHOICE" = "1" ]; then
    # Install Caddy
    echo "Installing Caddy..."
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install -y caddy
    
    # Configure Caddy
    sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
$DOMAIN {
    reverse_proxy localhost:8080
    encode gzip
    
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        -Server
    }
    
    log {
        output file /var/log/caddy/lastwar-access.log {
            roll_size 100mb
            roll_keep 10
        }
    }
}
EOF
    
    sudo systemctl enable caddy
    sudo systemctl restart caddy
    
    echo ""
    echo -e "${GREEN}Caddy installed and configured!${NC}"
    echo -e "SSL certificate will be obtained automatically from Let's Encrypt"
    
elif [ "$PROXY_CHOICE" = "2" ]; then
    # Install Nginx
    echo "Installing Nginx..."
    sudo apt install -y nginx certbot python3-certbot-nginx
    
    # Configure Nginx
    sudo tee /etc/nginx/sites-available/lastwar > /dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    
    sudo ln -sf /etc/nginx/sites-available/lastwar /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl enable nginx
    sudo systemctl restart nginx
    
    echo ""
    echo -e "${GREEN}Nginx installed!${NC}"
    echo -e "${YELLOW}IMPORTANT: Run the following command to get SSL certificate:${NC}"
    echo -e "  sudo certbot --nginx -d $DOMAIN"
    echo ""
fi

# Configure fail2ban
echo "Configuring fail2ban..."
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

# Setup backup cron
echo "Setting up daily backups..."
sudo tee /usr/local/bin/backup-lastwar.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/lastwar"
DB_PATH="/var/lib/lastwar/alliance.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/alliance_$DATE.db'"
find $BACKUP_DIR -name "alliance_*.db" -mtime +7 -delete

echo "Backup completed: alliance_$DATE.db"
EOF

sudo chmod +x /usr/local/bin/backup-lastwar.sh
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-lastwar.sh >> /var/log/lastwar/backup.log 2>&1") | sudo crontab -

# Start application
echo ""
echo -e "${GREEN}Starting application...${NC}"
sudo systemctl start $APP_NAME
sleep 2
sudo systemctl status $APP_NAME --no-pager

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Application: ${YELLOW}https://$DOMAIN${NC}"
echo -e "Default login: ${YELLOW}admin / admin123${NC}"
echo ""
echo -e "${RED}IMPORTANT NEXT STEPS:${NC}"
echo "1. Change the default admin password immediately"
echo "2. Make sure your DNS A record points to this server"
if [ "$PROXY_CHOICE" = "2" ]; then
    echo "3. Run: sudo certbot --nginx -d $DOMAIN"
fi
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  sudo systemctl status lastwar    - Check service status"
echo "  sudo journalctl -u lastwar -f    - View logs"
echo "  sudo systemctl restart lastwar   - Restart service"
echo ""
echo -e "${GREEN}Environment file: $APP_DIR/.env${NC}"
echo -e "${GREEN}Database: $DATA_DIR/alliance.db${NC}"
echo -e "${GREEN}Backups: /var/backups/lastwar/${NC}"
echo ""
