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
  recommendation?: string;
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
    isbndbApiKey?: string;
    llmApiEndpoint?: string;
    llmApiKey?: string;
    llmModel?: string;
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
  status?: ReadingStatus | "all";
}

export type SortField = "addedAt" | "title" | "author" | "publishDate";
export type SortOrder = "asc" | "desc";

export interface ExternalLinks {
  amazonUS: string;
  amazonUK: string;
  amazonEU: string;
  amazonJP: string;
  amazonCN: string;
  douban: string;
  dangdang: string;
  jd: string;
  wechatRead: string;
  zlibrary: string;
  annasArchive: string;
}
