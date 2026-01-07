#!/bin/bash

# Setup script for WSL Runtime AI System

echo "Setting up WSL Runtime AI Orchestration System..."
echo "=================================================="

# Create necessary directories
echo "Creating directory structure..."
mkdir -p ~/.repository/wsl-runtime
mkdir -p ~/_/ai
mkdir -p ~/.repository/wsl-runtime/backups
mkdir -p ~/.repository/wsl-runtime/logs

# Install required packages
echo "Installing required packages..."
sudo apt-get update
sudo apt-get install -y sqlite3 jq curl bc

# Install Ollama if not present
if ! command -v ollama &> /dev/null; then
    echo "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

# Start Ollama service
echo "Starting Ollama..."
ollama serve &
sleep 5

# Pull slim model
echo "Pulling Ollama slim model..."
ollama pull slim

# Make scripts executable
echo "Setting up scripts..."
chmod +x ~/_/ai/ai.sh
chmod +x ~/.repository/wsl-runtime/setup.sh

# Create systemd service for auto-start
echo "Creating system service..."
cat > ~/.config/systemd/user/wsl-ai.service << EOF
[Unit]
Description=WSL Runtime AI System
After=network.target

[Service]
Type=simple
ExecStart=/bin/bash -c "cd ~/.repository/wsl-runtime && python3 -m http.server 8080"
Restart=always
WorkingDirectory=%h/.repository/wsl-runtime

[Install]
WantedBy=default.target
EOF

# Initialize database
echo "Initializing database..."
~/_/ai/ai.sh status

# Create HTML file
echo "Creating HTML interface..."
# The HTML content should be copied to ~/.repository/wsl-runtime/index.html

echo "Setup complete!"
echo ""
echo "To start the system:"
echo "1. Start web server: cd ~/.repository/wsl-runtime && python3 -m http.server 8080"
echo "2. Open browser to: http://localhost:8080"
echo "3. Use AI system: ~/_/ai/ai.sh reason \"Your prompt here\""
echo ""
echo "System will be available at http://localhost:8080"
