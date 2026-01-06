// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { DiffViewer } from '../src/components/diff-viewer';
import type { FieldDiff } from '../src/components/diff-viewer';

function buildContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(container);
  return container;
}

describe('DiffViewer', () => {
  it('escapes HTML in side-by-side mode', () => {
    const container = buildContainer();
    const fields: FieldDiff[] = [
      {
        label: 'Title',
        local: '<img src=x onerror=alert(1)>',
        imported: '<svg onload=alert(1)>',
        hasConflict: true,
      },
    ];

    new DiffViewer(container, { mode: 'side-by-side', fields });

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('escapes HTML in inline mode', () => {
    const container = buildContainer();
    const fields: FieldDiff[] = [
      {
        label: 'Author',
        local: '<b>bad</b>',
        imported: '',
        hasConflict: false,
      },
    ];

    new DiffViewer(container, { mode: 'inline', fields });

    expect(container.querySelector('b')).toBeNull();
  });

  it('toggles mode via UI interaction', () => {
    const container = buildContainer();
    const onModeToggle = vi.fn();
    const fields: FieldDiff[] = [
      {
        label: 'Title',
        local: 'Local',
        imported: 'Imported',
        hasConflict: true,
      },
    ];

    new DiffViewer(container, { mode: 'side-by-side', fields, onModeToggle });

    const inlineButton = container.querySelector(
      '.diff-mode-btn[data-mode="inline"]'
    ) as HTMLButtonElement | null;
    inlineButton?.click();

    expect(onModeToggle).toHaveBeenCalledWith('inline');
    expect(container.querySelector('.diff-viewer')?.getAttribute('data-mode')).toBe('inline');
  });
});
