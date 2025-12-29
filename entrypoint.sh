#!/bin/sh
set -e

DEPS_DIR="/app/deps"
DEPS_MARKER="$DEPS_DIR/.installed"
REQUIREMENTS="/app/requirements.txt"
REQUIREMENTS_HASH="$DEPS_DIR/.requirements_hash"

echo "=== Chato Combourg Startup ==="

# Compute hash of requirements.txt
CURRENT_HASH=$(md5sum "$REQUIREMENTS" | cut -d' ' -f1)

# Check if dependencies need to be installed/updated
NEEDS_INSTALL=false
if [ ! -f "$DEPS_MARKER" ]; then
    echo "First run: dependencies not installed"
    NEEDS_INSTALL=true
elif [ ! -f "$REQUIREMENTS_HASH" ]; then
    echo "No requirements hash found, checking dependencies..."
    NEEDS_INSTALL=true
elif [ "$CURRENT_HASH" != "$(cat $REQUIREMENTS_HASH)" ]; then
    echo "requirements.txt changed, updating dependencies..."
    NEEDS_INSTALL=true
else
    echo "Dependencies up to date (cached)"
fi

if [ "$NEEDS_INSTALL" = true ]; then
    echo "Installing dependencies..."
    echo "This may take 5-10 minutes. Subsequent starts will be fast."
    echo ""

    # Install dependencies to persistent location
    pip install --no-cache-dir --target="$DEPS_DIR" -r "$REQUIREMENTS"

    # Save hash and mark as installed
    echo "$CURRENT_HASH" > "$REQUIREMENTS_HASH"
    touch "$DEPS_MARKER"
    echo ""
    echo "Dependencies installed successfully!"
fi

# Add deps to Python path and bin to PATH
export PYTHONPATH="$DEPS_DIR:$PYTHONPATH"
export PATH="$DEPS_DIR/bin:$PATH"

# Download CLIP model if not cached
echo "Checking CLIP model cache..."
python -c "import clip; clip.load('ViT-B/32', device='cpu')" 2>/dev/null || true

echo "Starting server..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
