import { describe, expect, it } from 'vitest';
import { generateExternalLinks } from '../src/modules/api/external-links';

describe('generateExternalLinks', () => {
  it('prefers ISBN when provided', () => {
    const links = generateExternalLinks('9780306406157', 'Ignored Title');

    expect(links.amazonUS).toContain('9780306406157');
    expect(links.douban).toContain('9780306406157');
    expect(links.amazonUS).not.toContain('Ignored%20Title');
  });

  it('encodes title when ISBN is missing', () => {
    const links = generateExternalLinks(undefined, 'C# & Rust');
    const encoded = 'C%23%20%26%20Rust';

    expect(links.amazonUS).toContain(encoded);
    expect(links.douban).toContain(encoded);
    expect(links.annasArchive).toContain(encoded);
  });
});
