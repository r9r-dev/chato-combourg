#!/bin/bash
#
# Installation du Chato Worker comme service macOS
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.chato.worker.plist"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
VENV_DIR="$SCRIPT_DIR/venv"

echo "=== Installation Chato Worker ==="
echo ""

# Create venv if needed (use homebrew python3.12)
if [ ! -d "$VENV_DIR" ]; then
    echo "Creation du virtualenv..."
    /opt/homebrew/bin/python3.12 -m venv "$VENV_DIR"
fi

# Install dependencies
echo "Installation des dependances..."
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$SCRIPT_DIR/requirements.txt"

# Copy LaunchAgent
echo "Installation du LaunchAgent..."
cp "$PLIST_SRC" "$PLIST_DST"

# Unload if already loaded
launchctl unload "$PLIST_DST" 2>/dev/null || true

# Load the agent
echo "Demarrage du service..."
launchctl load "$PLIST_DST"

echo ""
echo "=== Installation terminee ==="
echo ""
echo "Le worker demarre automatiquement au login."
echo "Une icone 'W' apparait dans la barre de menu."
echo ""
echo "Commandes utiles:"
echo "  Arreter:    launchctl unload ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Demarrer:   launchctl load ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Desinstall: rm ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Logs:       tail -f ~/Library/Logs/chato-worker.log"
echo ""
