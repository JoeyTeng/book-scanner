# PWA Icons

Please generate PWA icons with the following sizes and place them in this directory:

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

You can use online tools like:

- <https://realfavicongenerator.net/>
- <https://www.pwabuilder.com/imageGenerator>

Or use ImageMagick to generate from a source SVG/PNG:

```bash
# From a 512x512 source image
for size in 72 96 128 144 152 192 384 512; do
  convert source.png -resize ${size}x${size} icon-${size}x${size}.png
done
```

The icon should be a simple, recognizable symbol representing book scanning or library management.
Suggested design: A book with a barcode or a book with a scanner beam.
