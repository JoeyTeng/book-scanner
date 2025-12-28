#!/bin/bash

# Generate PWA icons from SVG source using ImageMagick
# Make sure ImageMagick is installed: brew install imagemagick (macOS)

SOURCE="public/icons/source-icon.svg"
OUTPUT_DIR="public/icons"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed."
    echo "Install it with: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)"
    exit 1
fi

# Check if source file exists
if [ ! -f "$SOURCE" ]; then
    echo "Error: Source file $SOURCE not found"
    exit 1
fi

echo "Generating PWA icons from $SOURCE..."

# Array of required sizes
sizes=(72 96 128 144 152 192 384 512)

# Generate each size
for size in "${sizes[@]}"; do
    output_file="$OUTPUT_DIR/icon-${size}x${size}.png"
    echo "Generating ${size}x${size}..."

    convert "$SOURCE" \
        -background none \
        -resize ${size}x${size} \
        -gravity center \
        -extent ${size}x${size} \
        "$output_file"

    if [ $? -eq 0 ]; then
        echo "✓ Created $output_file"
    else
        echo "✗ Failed to create $output_file"
    fi
done

# Also generate a favicon.ico
echo "Generating favicon.ico..."
convert "$SOURCE" \
    -background none \
    -define icon:auto-resize=16,32,48 \
    "favicon.ico"

if [ $? -eq 0 ]; then
    echo "✓ Created favicon.ico"
else
    echo "✗ Failed to create favicon.ico"
fi

echo ""
echo "All icons generated successfully!"
echo "Icons location: $OUTPUT_DIR/"
