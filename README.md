# Last War: Survival - Alliance Manager

A comprehensive Go web application for managing your alliance in the online game Last War: Survival. Track members, manage train schedules, award achievements, and generate communication messages.

## Features

### Core Management
- **Authentication System**: Secure login/logout with session management and password management
- **Role-Based Permissions**: Different access levels for Admin, R5, R4, and lower ranks
- **User-Member Linking**: Users are linked to alliance members with role inheritance
- **Member Management**: Add, edit, delete alliance members, and create user accounts
- **Rank System**: Pre-configured with 5 ranks (R5, R4, R3, R2, R1)

### Train Schedule System
- **Weekly Schedule Management**: Organize and track train conductors and backups
- **Auto-Schedule**: Automatically assign conductors for the week based on performance rankings
- **Performance Tracking**: Track conductor scores and show-up history
- **Weekly Message Generator**: Create formatted messages for alliance chat with schedules
- **Daily Message Generator**: Generate daily reminders for conductors and backups with specific times (15:00 ST/17:00 UK for conductor, 16:30 ST/18:30 UK for backup)

### Awards & Recommendations
- **Weekly Awards**: Track 1st, 2nd, and 3rd place winners across multiple categories
- **Recommendations**: Member recommendation system to boost rankings
- **Performance Rankings**: Real-time leaderboard with detailed score breakdown

### Ranking & Auto-Schedule System
- **Configurable Point System**: Customize points for awards, recommendations, and penalties
- **Smart Conductor Selection**: Automatically selects top 7 performers as conductors
- **Fair Distribution**: Penalties for recent conductors and above-average usage
- **Rank Boosts**: Special bonuses for R4/R5 members and first-time conductors
- **Backup System**: Smart backup assignment from R4/R5 members not in conductor pool

### Communication Tools
- **Customizable Templates**: Configure weekly and daily message templates
- **Train-Themed Messaging**: Fun, themed messages using train lingo ("ALL ABOARD", "Conductor", "Backup Engineer")
- **Placeholder System**: Dynamic message generation with member names, ranks, dates, and times
- **Copy-to-Clipboard**: Easy copying of generated messages for in-game chat

### Power Tracking with Image Recognition
- **Screenshot OCR**: Upload power rankings screenshots for automatic data extraction
- **Intelligent Image Preprocessing**: AI-powered region detection and enhancement
  - Automatically detects and crops data regions (removes headers, tabs, buttons)
  - Enhances contrast and applies adaptive thresholding for better text recognition
  - Filters out UI elements to focus only on player data
- **Smart Parsing**: Advanced pattern matching for names and power values
- **Fuzzy Member Matching**: Automatically matches OCR text to database members
- **Manual Entry**: Alternative text-based input for manual data entry
- **Power History Tracking**: Track member power progression over time

See [IMAGE_RECOGNITION.md](IMAGE_RECOGNITION.md) for detailed technical documentation on the image analysis system.

### Additional Features
- **Profile Management**: Users can change passwords and view account information
- **Settings Page**: R5/Admin-only configuration for ranking system and message templates
- **Responsive UI**: Clean, modern interface that works on desktop and mobile
- **Real-time Filtering**: Filter rankings and schedules by name and rank
- **SQLite Database**: Lightweight, file-based storage for easy deployment

## Prerequisites

### Development
- **Go 1.21 or higher** - Download from https://golang.org/dl/
- **GCC compiler** (for CGO compilation - required for Tesseract OCR):
  - Windows: Install MinGW-w64 or TDM-GCC
  - Linux: `sudo apt-get install build-essential`
  - macOS: Install Xcode Command Line Tools
- **Tesseract OCR** (for image recognition features):
  - Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
  - Linux: `sudo apt-get install tesseract-ocr tesseract-ocr-all libtesseract-dev libleptonica-dev`
  - macOS: `brew install tesseract`

**Note**: CGO must be enabled for OCR features (`go env CGO_ENABLED` should return `1`). On Windows without MinGW/TDM-GCC, the application can compile but OCR features won't work. Deploy to Linux for full functionality.

### Production (Debian/Ubuntu Server)
See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive production deployment guide with:
- Automated installation script
- Let's Encrypt SSL setup (Caddy or Nginx)
- Security hardening
- Systemd service configuration
- Firewall and fail2ban setup
- Automated backups

## Installation

### Development Setup

1. Navigate to the project directory
2. Download dependencies:
```bash
go mod download
```

### Production Deployment

**Quick Install (Debian/Ubuntu):**
```bash
chmod +x install.sh
./install.sh
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed manual setup instructions.

## Running the Application

### Development Mode

Build and run the server:
```bash
go run main.go
```

Or build an executable:
```bash
go build -o alliance-manager
./alliance-manager
```

The application will be available at `http://localhost:8080`

### Production Mode

```bash
# Set environment variables
export SESSION_KEY=$(openssl rand -hex 32)
export DATABASE_PATH=/var/lib/lastwar/alliance.db
export PRODUCTION=true
export HTTPS=true

# Build and run
go build -o alliance-manager main.go
./alliance-manager
```

Or use the systemd service (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## Environment Variables

- `DATABASE_PATH` - Path to SQLite database file (default: `./alliance.db`)
- `SESSION_KEY` - 64-character hex string for session encryption (auto-generated if not set)
- `PRODUCTION` - Set to `true` for production mode (enables secure cookies)
- `HTTPS` - Set to `true` when using HTTPS (enables secure cookie flag)
- `PORT` - Server port (default: `8080`)

## Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change the default password immediately after first login!

## Project Structure

```
LastWar/
├── main.go             # Go server and API routes
├── go.mod              # Go module dependencies
├── Dockerfile          # Docker container configuration
├── alliance.db         # SQLite database (created automatically)
├── install.sh          # Automated Debian installation script
├── lastwar.service     # Systemd service configuration
├── Caddyfile           # Caddy reverse proxy configuration
├── .env.example        # Environment variables example
├── DEPLOYMENT.md       # Production deployment guide
├── static/             # Frontend files
│   ├── index.html      # Member management page
│   ├── login.html      # Login page
│   ├── profile.html    # User profile & password management
│   ├── train.html      # Train schedule management
│   ├── awards.html     # Awards tracking
│   ├── recommendations.html  # Recommendation system
│   ├── rankings.html   # Performance rankings
│   ├── settings.html   # Configuration (R5/Admin only)
│   ├── styles.css      # Styling
│   ├── app.js          # Member management JS
│   ├── profile.js      # Profile page JS
│   ├── train.js        # Train schedule JS
│   ├── awards.js       # Awards tracking JS
│   ├── recommendations.js   # Recommendations JS
│   ├── rankings.js     # Rankings display JS
│   └── settings.js     # Settings configuration JS
└── README.md           # This file
```

## Ranks

- **R5** - Highest rank - Can manage all members
- **R4** - Second highest rank - Can manage all members
- **R3** - Mid-level rank - View only
- **R2** - Lower rank - View only
- **R1** - Lowest rank - View only

## Permissions

- **Admin**: Full access to all features, R5/Admin-only settings (not linked to a member)
- **R5 Members**: Can manage members, create user accounts, update settings, manage all schedules
- **R4 Members**: Can manage members and schedules (cannot update settings or create users)
- **R3/R2/R1 Members**: Can view all information but cannot modify

### R5/Admin-Only Features
- Create user accounts for members
- Update ranking system configuration
- Modify message templates
- Change all system settings

## Technologies Used

- **Backend**: Go, Gorilla Mux
- **Database**: SQLite3 with go-sqlite3 driver
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Styling**: Modern gradient design with responsive layout

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/check-auth` - Check authentication status
- `POST /api/change-password` - Change user password

### Member Management (Protected)
- `GET /api/members` - Get all members
- `POST /api/members` - Create a new member (R4/R5 only)
- `PUT /api/members/{id}` - Update a member (R4/R5 only)
- `DELETE /api/members/{id}` - Delete a member (R4/R5 only)
- `POST /api/members/{id}/create-user` - Create user account for member (R5/Admin only)

### Train Schedule (Protected)
- `GET /api/train-schedules` - Get all schedules
- `POST /api/train-schedules` - Create schedule entry
- `PUT /api/train-schedules/{id}` - Update schedule
- `DELETE /api/train-schedules/{id}` - Delete schedule
- `POST /api/train-schedules/auto-schedule` - Auto-assign week's conductors
- `GET /api/train-schedules/weekly-message` - Generate weekly message
- `GET /api/train-schedules/daily-message` - Generate daily conductor message

### Awards (Protected)
- `GET /api/awards` - Get all awards
- `POST /api/awards` - Save awards for a week

### Recommendations (Protected)
- `GET /api/recommendations` - Get all recommendations
- `POST /api/recommendations` - Add recommendation
- `DELETE /api/recommendations/{id}` - Remove recommendation

### Rankings (Protected)
- `GET /api/rankings` - Get member performance rankings

### Settings (R5/Admin Only)
- `GET /api/settings` - Get current settings
- `PUT /api/settings` - Update settings

## Notes

- The database file `alliance.db` will be created automatically on first run
- Make sure port 8080 is available (or set PORT environment variable)
- All data is stored locally in the SQLite database
- Default admin user is created automatically on first run
- Session cookies are used for authentication
- Passwords are hashed using bcrypt for security
- User creation generates secure random 10-character alphanumeric passwords
- Auto-schedule uses a sophisticated ranking algorithm to ensure fair distribution
- Message templates are fully customizable in the Settings page
- Daily messages include specific times: 15:00 ST (17:00 UK) for conductor, 16:30 ST (18:30 UK) for backup
- The application can be containerized using the provided Dockerfile
- Set DATABASE_PATH environment variable for custom database location (useful for Docker volumes)

## How Auto-Schedule Works

The auto-schedule system calculates scores for each member based on:

1. **Award Points**: Points from last week's 1st/2nd/3rd place awards
2. **Recommendation Points**: Points per active recommendation
3. **R4/R5 Rank Boost**: Bonus points for R4 and R5 members
4. **First-Time Conductor Boost**: Extra points for members who've never been conductor
5. **Recent Conductor Penalty**: Reduced points if they were conductor recently
6. **Above Average Penalty**: Penalty for members who've been conductor more than average

The top 7 members are selected as conductors for the week. Backups are selected from R4/R5 members who are not conductors, with each backup used only once per week.

## Message Templates

### Weekly Message Placeholders
- `{WEEK}` - Week start date
- `{SCHEDULES}` - Daily conductor/backup list
- `{NEXT_3}` - Next 3 top-ranked candidates

### Daily Message Placeholders
- `{DATE}` - Formatted date (e.g., Monday, Jan 2, 2006)
- `{CONDUCTOR_NAME}` - Name of the conductor
- `{CONDUCTOR_RANK}` - Rank of the conductor
- `{BACKUP_NAME}` - Name of the backup
- `{BACKUP_RANK}` - Rank of the backup

## Security

- Passwords are hashed with bcrypt before storage
- Session-based authentication with secure cookies
- Role-based access control for all sensitive operations
- SQL injection prevention through parameterized queries
- R5/Admin-only restrictions on critical settings
