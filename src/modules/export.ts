import { exportMetadataBackupJson } from './backup';
import { storage } from './storage';

/**
 * Export metadata backup as JSON
 */
export async function exportAsJSON(): Promise<string> {
  return exportMetadataBackupJson();
}

/**
 * Export data as CSV
 */
export async function exportAsCSV(): Promise<string> {
  const books = await storage.getBooks();

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
    'Updated At',
  ];

  const rows = books.map((book) => [
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
    new Date(book.updatedAt).toISOString(),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  return csvContent;
}

/**
 * Export data as Markdown
 */
export async function exportAsMarkdown(): Promise<string> {
  const books = await storage.getBooks();

  let markdown = '# My Book Collection\n\n';
  markdown += `Exported on: ${new Date().toLocaleString()}\n\n`;
  markdown += `Total books: ${books.length}\n\n`;

  // Group by status
  const groupedByStatus = {
    want: books.filter((b) => b.status === 'want'),
    reading: books.filter((b) => b.status === 'reading'),
    read: books.filter((b) => b.status === 'read'),
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
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.slice().buffer;
}

export function downloadFile(content: string, filename: string, type: string): void {
  downloadBlob(new Blob([content], { type }), filename);
}

export function downloadBytes(content: Uint8Array, filename: string, type: string): void {
  downloadBlob(new Blob([toArrayBuffer(content)], { type }), filename);
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
