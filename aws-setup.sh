#!/bin/bash
# Run this on your EC2 instance after SSH-ing in
# chmod +x aws-setup.sh && ./aws-setup.sh

set -e
echo "===================================="
echo "  MeetMinutes AWS Setup Script"
echo "===================================="

# 1. Update system
echo "[1/5] Updating system..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install Docker
echo "[2/5] Installing Docker..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER

# 3. Clone repo
echo "[3/5] Cloning repository..."
git clone https://github.com/arpitkasaudhan/meetminutes-transcription-bot.git
cd meetminutes-transcription-bot

# 4. Create .env
echo "[4/5] Creating .env file..."
cat > .env << 'EOF'
GROQ_API_KEY=REPLACE_WITH_YOUR_GROQ_API_KEY
PORT=3000
REDIS_HOST=redis
REDIS_PORT=6379
BACKEND_WS_URL=http://backend:3000
EOF
echo ""
echo ">>> IMPORTANT: Edit .env and add your GROQ_API_KEY"
echo "    Run: nano .env"
echo ""

# 5. Done
echo "[5/5] Setup complete!"
echo ""
echo "Next steps:"
echo "  1. nano .env   (add your GROQ_API_KEY)"
echo "  2. newgrp docker"
echo "  3. docker compose up -d --build"
echo ""
echo "Your app will be live at: http://$(curl -s ifconfig.me)"
