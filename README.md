# Market-Bot

# Update Termux
pkg update && pkg upgrade

# Install required packages
pkg install nodejs-lts git

# Clone repository
git clone <your-repo-url>
cd ecommerce-discord-bot

# Setup Dashboard
cd dashboard
npm install

# Setup Bot
cd ../bot
npm install

# Environment setup
cp .env.example .env
# Edit .env with your actual values

# Start services (in separate Termux sessions)
# Session 1 - Dashboard
cd dashboard
npm run dev

# Session 2 - Bot
cd bot
npm start

