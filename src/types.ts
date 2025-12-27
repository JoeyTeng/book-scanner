export type ReadingStatus = 'want' | 'reading' | 'read';

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher?: string;
  publishDate?: string;
  cover?: string;
  categories: string[];
  tags: string[];
  status: ReadingStatus;
  notes: string;
  addedAt: number;
  updatedAt: number;
  source: string[];
}

export interface StorageData {
  version: string;
  books: Book[];
  settings: {
    categories: string[];
    googleBooksApiKey?: string;
  };
}

export interface ExportData {
  version: string;
  exportedAt: number;
  books: Book[];
  categories: string[];
}

export interface BookDataSource {
  title?: string;
  author?: string;
  publisher?: string;
  publishDate?: string;
  cover?: string;
  isbn?: string;
  source: string;
}

export interface SearchFilters {
  query: string;
  category?: string;
  status?: ReadingStatus | 'all';
}

export type SortField = 'addedAt' | 'title' | 'author' | 'publishDate';
export type SortOrder = 'asc' | 'desc';

export interface ExternalLinks {
  amazonUS: string;
  amazonUK: string;
  amazonJP: string;
  amazonCN: string;
  zlibrary: string;
  annasArchive: string;
}
