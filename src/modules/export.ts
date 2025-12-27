import type { ExportData } from '../types';
import { APP_VERSION } from '../config';
import { storage } from './storage';

/**
 * Export data as JSON
 */
export function exportAsJSON(): string {
  const data = storage.exportData();

  const exportData: ExportData = {
    version: APP_VERSION,
    exportedAt: Date.now(),
    books: data.books,
    categories: data.settings.categories
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export data as CSV
 */
export function exportAsCSV(): string {
  const books = storage.getBooks();

  // CSV Header
  const headers = [
    'Title',
    'Author',
    'ISBN',
    'Publisher',
    'Publish Date',
    'Categories',
    'Tags',
    'Status',
    'Notes',
    'Cover URL',
    'Added At',
    'Updated At'
  ];

  const rows = books.map(book => [
    escapeCSV(book.title),
    escapeCSV(book.author),
    escapeCSV(book.isbn),
    escapeCSV(book.publisher || ''),
    escapeCSV(book.publishDate || ''),
    escapeCSV(book.categories.join('; ')),
    escapeCSV(book.tags.join('; ')),
    escapeCSV(book.status),
    escapeCSV(book.notes),
    escapeCSV(book.cover || ''),
    new Date(book.addedAt).toISOString(),
    new Date(book.updatedAt).toISOString()
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Export data as Markdown
 */
export function exportAsMarkdown(): string {
  const books = storage.getBooks();

  let markdown = '# My Book Collection\n\n';
  markdown += `Exported on: ${new Date().toLocaleString()}\n\n`;
  markdown += `Total books: ${books.length}\n\n`;

  // Group by status
  const groupedByStatus = {
    want: books.filter(b => b.status === 'want'),
    reading: books.filter(b => b.status === 'reading'),
    read: books.filter(b => b.status === 'read')
  };

  for (const [status, statusBooks] of Object.entries(groupedByStatus)) {
    if (statusBooks.length === 0) continue;

    markdown += `## ${capitalizeFirst(status)} (${statusBooks.length})\n\n`;
    markdown += '| Title | Author | ISBN | Publisher | Publish Date |\n';
    markdown += '|-------|--------|------|-----------|-------------|\n';

    for (const book of statusBooks) {
      markdown += `| ${escapeMD(book.title)} | ${escapeMD(book.author)} | ${book.isbn} | ${escapeMD(book.publisher || '')} | ${escapeMD(book.publishDate || '')} |\n`;
    }

    markdown += '\n';
  }

  return markdown;
}

/**
 * Download file with given content
 */
export function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Helper functions

function escapeCSV(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeMD(str: string): string {
  return str.replace(/\|/g, '\\|');
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
