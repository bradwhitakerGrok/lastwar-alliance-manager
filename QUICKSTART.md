# Quick Production Setup Guide

## One-Command Installation (Debian/Ubuntu)

```bash
chmod +x install.sh
sudo ./install.sh
```

The script will:
- ✅ Install Go and dependencies
- ✅ Create system user and directories
- ✅ Build the application
- ✅ Generate secure session key
- ✅ Configure systemd service
- ✅ Setup firewall (UFW)
- ✅ Install Caddy or Nginx
- ✅ Configure Let's Encrypt SSL
- ✅ Setup fail2ban
- ✅ Configure daily backups

## Manual Quick Start

### 1. Prerequisites
```bash
# Domain pointing to your server IP
# Ports 80 and 443 open in firewall
```

### 2. Generate Session Key
```bash
openssl rand -hex 32
```

### 3. Create Environment File
```bash
cat > .env << EOF
DATABASE_PATH=/var/lib/lastwar/alliance.db
SESSION_KEY=your-generated-key-here
PRODUCTION=true
HTTPS=true
PORT=8080
EOF
```

### 4. Choose Your Reverse Proxy

#### Option A: Caddy (Recommended - Automatic HTTPS)
```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# Configure
echo "your-domain.com {
    reverse_proxy localhost:8080
}" | sudo tee /etc/caddy/Caddyfile

sudo systemctl restart caddy
```

#### Option B: Nginx + Certbot
```bash
# Install
sudo apt install -y nginx certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com
```

### 5. Start Application
```bash
# Build
go build -o alliance-manager main.go

# Run with environment
export $(cat .env | xargs)
./alliance-manager
```

Or use systemd service (see DEPLOYMENT.md).

## Essential Commands

### Service Management
```bash
sudo systemctl status lastwar      # Check status
sudo systemctl start lastwar       # Start service
sudo systemctl stop lastwar        # Stop service
sudo systemctl restart lastwar     # Restart service
sudo journalctl -u lastwar -f      # View logs
```

### SSL Certificate
```bash
# Caddy (automatic renewal)
sudo systemctl status caddy

# Nginx (manual renewal test)
sudo certbot renew --dry-run
```

### Backups
```bash
# Manual backup
sudo /usr/local/bin/backup-lastwar.sh

# List backups
ls -lh /var/backups/lastwar/

# Restore from backup
sudo cp /var/backups/lastwar/alliance_YYYYMMDD_HHMMSS.db /var/lib/lastwar/alliance.db
sudo chown lastwar:lastwar /var/lib/lastwar/alliance.db
sudo systemctl restart lastwar
```

### Security Checks
```bash
# Check firewall
sudo ufw status

# Check fail2ban
sudo fail2ban-client status

# Check banned IPs
sudo fail2ban-client status sshd

# Unban IP
sudo fail2ban-client set sshd unbanip 123.123.123.123

# Check SSL grade
curl https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com
```

### Updates
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update application
cd /opt/lastwar
git pull  # or upload new files
go build -o alliance-manager main.go
sudo systemctl restart lastwar
```

## Troubleshooting

### Service won't start
```bash
# Check logs
sudo journalctl -u lastwar -n 100

# Check if port is available
sudo ss -tlnp | grep 8080

# Check permissions
sudo ls -la /var/lib/lastwar/
```

### SSL certificate issues
```bash
# Caddy: Check logs
sudo journalctl -u caddy -n 50

# Nginx: Test configuration
sudo nginx -t

# Check DNS
dig your-domain.com
```

### Database locked
```bash
# Check for open connections
sudo lsof /var/lib/lastwar/alliance.db

# Restart service
sudo systemctl restart lastwar
```

### High memory usage
```bash
# Check memory
free -h

# Check Go memory
sudo systemctl status lastwar
```

## Security Best Practices

- ✅ Change default admin password immediately
- ✅ Use strong, unique SESSION_KEY
- ✅ Keep system updated (`sudo apt update && sudo apt upgrade`)
- ✅ Monitor logs regularly
- ✅ Test backups periodically
- ✅ Use SSH keys instead of passwords
- ✅ Enable 2FA for SSH (optional but recommended)
- ✅ Monitor fail2ban bans
- ✅ Use non-standard SSH port (optional)
- ✅ Implement rate limiting (already configured)

## Performance Optimization

### For high traffic:
```bash
# Increase system limits
echo "lastwar soft nofile 65535" | sudo tee -a /etc/security/limits.conf
echo "lastwar hard nofile 65535" | sudo tee -a /etc/security/limits.conf

# Enable kernel tweaks
sudo sysctl -w net.core.somaxconn=65535
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=8192
```

### Enable compression in Caddy:
Already configured in provided Caddyfile

### Database optimization:
```bash
# Run VACUUM monthly
echo "0 3 1 * * sqlite3 /var/lib/lastwar/alliance.db 'VACUUM;'" | sudo crontab -
```

## Monitoring (Simple)

### Create monitoring script:
```bash
#!/bin/bash
# /usr/local/bin/check-lastwar.sh

if ! curl -f http://localhost:8080 > /dev/null 2>&1; then
    echo "Service down at $(date)" >> /var/log/lastwar-monitor.log
    systemctl restart lastwar
fi
```

### Add to crontab (every 5 minutes):
```bash
*/5 * * * * /usr/local/bin/check-lastwar.sh
```

## Need Help?

1. Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed guide
2. Review logs: `sudo journalctl -u lastwar -f`
3. Check application status: `sudo systemctl status lastwar`
4. Verify reverse proxy: `sudo systemctl status caddy` or `sudo systemctl status nginx`
5. Test database: `sqlite3 /var/lib/lastwar/alliance.db ".tables"`

## Quick Health Check

Run this to verify everything is working:

```bash
# Check all services
echo "=== Service Status ==="
sudo systemctl is-active lastwar caddy fail2ban

echo -e "\n=== Port Check ==="
sudo ss -tlnp | grep -E '(8080|80|443)'

echo -e "\n=== SSL Certificate ==="
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

echo -e "\n=== Database ==="
sudo sqlite3 /var/lib/lastwar/alliance.db "SELECT COUNT(*) FROM members;"

echo -e "\n=== Recent Logs ==="
sudo journalctl -u lastwar --since "5 minutes ago" --no-pager
```
