# Book Scanner

A static web application for scanning book barcodes and managing your personal book collection. Built with TypeScript and designed for mobile-first usage.

## Features

✅ **Barcode Scanning**: Scan ISBN barcodes using your device camera
✅ **Multi-Source Data**: Fetch book information from Google Books and Open Library
✅ **Smart Paste**: Automatically parse pasted book information
✅ **External Search Links**: Quick links to Amazon, zlibrary, and Anna's Archive
✅ **Book Management**: Add, edit, delete books with full metadata
✅ **Categorization**: Organize books with categories and tags
✅ **Reading Status**: Track want-to-read, reading, and read books
✅ **Notes**: Add personal notes to any book
✅ **Search & Filter**: Find books by title, author, ISBN, or tags
✅ **Data Export**: Export your collection as JSON, CSV, or Markdown
✅ **Data Import**: Import previously exported JSON data
✅ **Local Storage**: All data stored in your browser (no server required)
✅ **Version Control**: Automatic data migration for future updates

## Supported Barcode Formats

- ISBN-13 (EAN-13)
- ISBN-10
- UPC-A
- UPC-E
- Code 128
- Code 39
- ITF (Interleaved 2 of 5)
- QR Code

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/book-scanner.git
cd book-scanner

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Google Books API Key Setup

To fetch book data from Google Books, you need a free API key:

1. **Go to Google Cloud Console**
   Visit [https://console.cloud.google.com/](https://console.cloud.google.com/)

2. **Create a New Project** (or select an existing one)
   - Click "Select a project" → "New Project"
   - Enter a project name (e.g., "Book Scanner")
   - Click "Create"

3. **Enable Books API**
   - In the left sidebar, go to "APIs & Services" → "Library"
   - Search for "Books API"
   - Click on it and press "Enable"

4. **Create API Key**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API key"
   - Your API key will be generated

5. **Restrict API Key (Recommended)**
   - Click on your newly created API key
   - Under "API restrictions", select "Restrict key"
   - Check only "Books API"
   - Under "Website restrictions", add your GitHub Pages URL:
     - `https://yourusername.github.io/*`
     - Or for local development: `http://localhost:3000/*`
   - Click "Save"

6. **Add API Key to the App**
   - Open the app
   - Click the menu icon (☰) in the top right
   - Select "Set Google Books API Key"
   - Paste your API key and save

**Note**: Without an API key, the app will only use Open Library API, which has limited coverage.

### Deployment to GitHub Pages

This project includes automatic deployment via GitHub Actions:

1. Push your code to the `main` branch
2. GitHub Actions will automatically build and deploy to GitHub Pages
3. Enable GitHub Pages in your repository settings:
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` / `root`

Your app will be available at: `https://yourusername.github.io/book-scanner/`

## Usage

### Scanning a Barcode

1. Click the floating scan button (📷) on mobile, or "Scan Barcode" in the menu
2. Allow camera access when prompted
3. Position the book's barcode in the frame
4. The app will automatically detect and process the barcode
5. Alternatively, enter the ISBN manually

### Adding a Book

1. Scan or enter the ISBN
2. The app will fetch data from Google Books and Open Library
3. Review and select the best information from multiple sources
4. Edit any field manually if needed
5. Add categories, tags, reading status, and notes
6. Click "Add" to save

### Managing Your Collection

- **Search**: Use the search bar to find books by title, author, ISBN, or tags
- **Filter**: Filter by category or reading status
- **Sort**: Sort by date added, title, author, or publish date
- **Edit**: Click "Edit" on any book card
- **Delete**: Click "Delete" on any book card (requires confirmation)

### Exporting Data

1. Click the menu icon (☰)
2. Select export format:
   - **JSON**: Full data with version info (recommended for backup)
   - **CSV**: Spreadsheet format for Excel/Google Sheets
   - **Markdown**: Human-readable format for documentation

### Importing Data

1. Click the menu icon (☰)
2. Select "Import JSON"
3. Choose your previously exported JSON file
4. Data will be merged with existing books (duplicates by ID are skipped)

## Data Storage

All data is stored in your browser's `localStorage`:

- **Storage Location**: Browser's local storage (typically 5-10MB limit)
- **Privacy**: Data never leaves your device
- **Persistence**: Data persists across sessions
- **Backup**: Export regularly to avoid data loss

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Safari**: Full support (iOS 14.3+ for camera)
- **Firefox**: Full support
- **Camera Access**: HTTPS required (except localhost)

## Project Structure

```
book-scanner/
├── src/
│   ├── components/       # UI components
│   ├── modules/          # Core functionality
│   │   └── api/         # API integrations
│   ├── utils/           # Utility functions
│   ├── styles/          # CSS files
│   ├── types.ts         # TypeScript types
│   ├── config.ts        # Configuration
│   ├── app.ts           # Main application
│   └── main.ts          # Entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Technologies

- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server
- **html5-qrcode**: Barcode scanning library
- **Google Books API**: Book metadata
- **Open Library API**: Alternative book data source
- **LocalStorage**: Browser-based data persistence

## Limitations

- **Amazon/zlibrary/Anna's Archive**: Direct API integration not available due to CORS restrictions. External search links are provided instead.
- **OCR**: Not included in v1.0. Use smart paste feature or manual entry for non-barcode books.
- **Storage Limit**: Browser localStorage typically has 5-10MB limit (approximately 10,000-50,000 books depending on cover URLs).

## Troubleshooting

### Camera Not Working

- Ensure you're using HTTPS (required for camera access)
- Check browser permissions: Settings → Privacy → Camera
- Try a different browser
- On iOS: Safari 14.3+ required

### API Key Not Working

- Verify the API key is correct (no extra spaces)
- Check that Books API is enabled in Google Cloud Console
- Verify API restrictions match your domain
- Check browser console for error messages

### Books Not Found

- Try searching with ISBN-13 instead of ISBN-10
- Some older books may not be in digital databases
- Use "Smart Paste" to add information from other sources manually
- Use external search links to find information

### Data Lost

- Always export your data regularly as backup
- Check if you're using the same browser and profile
- LocalStorage is cleared when you clear browser data

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Author

Xuanwo

## Acknowledgments

- [html5-qrcode](https://github.com/mebjas/html5-qrcode) for barcode scanning
- [Google Books API](https://developers.google.com/books) for book data
- [Open Library](https://openlibrary.org/) for additional book data
