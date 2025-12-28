#!/bin/sh
set -e

DEPS_MARKER="/app/deps/.installed"
REQUIREMENTS="/app/requirements.txt"

echo "=== Chato Combourg Startup ==="

# Check if dependencies are already installed
if [ -f "$DEPS_MARKER" ]; then
    echo "Dependencies already installed (cached)"
else
    echo "First run: Installing dependencies..."
    echo "This may take 5-10 minutes. Subsequent starts will be fast."
    echo ""

    # Install dependencies to persistent location
    pip install --no-cache-dir --target=/app/deps -r "$REQUIREMENTS"

    # Mark as installed
    touch "$DEPS_MARKER"
    echo ""
    echo "Dependencies installed successfully!"
fi

# Add deps to Python path
export PYTHONPATH="/app/deps:$PYTHONPATH"

# Download CLIP model if not cached
echo "Checking CLIP model cache..."
python -c "import clip; clip.load('ViT-B/32', device='cpu')" 2>/dev/null || true

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8080
