export type ReadingStatus = 'want' | 'reading' | 'read';
export type ViewMode = 'grid' | 'list';

export interface CategoryMetadata {
  name: string;
  lastUsedAt: number;
}

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
    categories: CategoryMetadata[];
    googleBooksApiKey?: string;
    isbndbApiKey?: string;
    llmApiEndpoint?: string;
    llmApiKey?: string;
    llmModel?: string;
    llmTextApiEndpoint?: string;
    llmTextApiKey?: string;
    llmTextModel?: string;
  };
}

export interface ExportData {
  version: string;
  exportedAt: number;
  books: Book[];
  categories: CategoryMetadata[];
}

export interface BookList {
  id: string;
  name: string;
  description?: string;
  bookIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface BookListExport {
  bookList: BookList;
  books: Book[];
  exportedAt: number;
  version: string;
}

export interface BookListImportResult {
  success: number;
  skipped: number;
  replaced: number;
  errors: string[];
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
