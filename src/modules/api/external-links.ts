import type { ExternalLinks } from '../../types';

/**
 * Generate external search links for a book
 */
export function generateExternalLinks(isbn?: string, title?: string): ExternalLinks {
  const query = isbn || (title ? encodeURIComponent(title) : '');

  return {
    amazonUS: `https://www.amazon.com/s?k=${query}`,
    amazonUK: `https://www.amazon.co.uk/s?k=${query}`,
    amazonEU: `https://www.amazon.fr/s?k=${query}`,
    amazonJP: `https://www.amazon.co.jp/s?k=${query}`,
    amazonCN: `https://www.amazon.cn/s?k=${query}`,
    douban: `https://search.douban.com/book/subject_search?search_text=${query}`,
    dangdang: `https://search.dangdang.com/?key=${query}`,
    jd: `https://search.jd.com/Search?keyword=${query}&enc=utf-8`,
    wechatRead: `https://weread.qq.com/web/search/global?keyword=${query}`,
    zlibrary: `https://z-lib.gs/s/?q=${query}`,
    annasArchive: `https://annas-archive.org/search?q=${query}`,
  };
}
