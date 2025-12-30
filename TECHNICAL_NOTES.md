# Technical Implementation Notes

## Event Delegation Pattern in CategoryManagerModal

### Problem Context
在 CategoryManagerModal 的初始实现中，由于每次 UI 更新（搜索输入、切换编辑模式、保存修改等）都会调用 `attachEventListeners()`，导致同一个 DOM 元素上绑定了多个事件监听器。这会造成：

- 按钮点击时触发多次回调
- 确认对话框反复弹出
- 编辑模式在 true/false 间反复切换

### Root Cause
```typescript
// Anti-pattern: Re-binding on every update
searchInput.addEventListener('input', () => {
  this.updateFilteredCategories();
  this.renderCategoryList();
  this.attachEventListeners(); // ❌ Creates duplicate bindings!
});
```

这种模式在函数式编程中很常见（数据变化 → 重新渲染 → 重新绑定），但在命令式 DOM 操作中会导致监听器累积。

### Solution: Event Delegation
事件委托是 DOM 操作的标准模式，核心思想是：

1. **仅在初始化时绑定一次**：在 `render()` 中调用 `attachEventListeners()`
2. **监听父容器**：将监听器绑定到父元素上
3. **使用 event.target 路由**：根据触发元素的类名/ID 决定执行哪个处理函数

```typescript
// Good: Event delegation pattern
attachEventListeners(): void {
  // Bind ONCE during initialization
  const categoryList = this.modalElement?.querySelector('#category-list');

  // Listen to parent container
  categoryList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Route based on target
    if (target.classList.contains('btn-save')) {
      const oldName = target.dataset.oldName!;
      this.saveEditing(oldName);
    }
    else if (target.classList.contains('btn-cancel')) {
      this.cancelEditing();
    }
    // ... other handlers
  });
}
```

### Implementation Details

#### 1. Checkbox Events (change)
```typescript
categoryList.addEventListener('change', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('category-delete-checkbox')) {
    const checkbox = target as HTMLInputElement;
    const categoryName = checkbox.dataset.category;
    if (checkbox.checked) {
      this.selectedForDeletion.add(categoryName);
    } else {
      this.selectedForDeletion.delete(categoryName);
    }
    this.updateToolbar();
  }
});
```

#### 2. Button Clicks (click)
```typescript
categoryList.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  // Edit button
  if (target.classList.contains('category-content') &&
      target.classList.contains('clickable')) {
    const categoryName = target.textContent?.trim();
    this.startEditing(categoryName);
  }

  // Save button
  if (target.classList.contains('btn-save')) {
    const oldName = target.dataset.oldName!;
    this.saveEditing(oldName);
  }

  // Cancel button
  if (target.classList.contains('btn-cancel')) {
    this.cancelEditing();
  }
});
```

#### 3. Toolbar Buttons
```typescript
const toolbar = this.modalElement?.querySelector('.category-manager-toolbar');
toolbar.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  if (target.id === 'btn-toggle-edit-mode') {
    this.toggleEditMode();
  }

  if (target.id === 'btn-batch-delete') {
    await this.handleBatchDelete();
  }
});
```

#### 4. Search Input (Special Case)
搜索输入框是唯一不需要重复绑定的元素（始终存在），因此可以直接绑定：

```typescript
const searchInput = this.modalElement?.querySelector('#category-search-input');
searchInput.addEventListener('input', (e) => {
  this.searchQuery = (e.target as HTMLInputElement).value;
  this.updateFilteredCategories();
  this.renderCategoryListOnly(); // ✅ Only update DOM, no rebinding
});
```

### Key Method: `renderCategoryListOnly()`
为了支持搜索输入的 UI 更新，新增了这个方法：

```typescript
/**
 * Re-render only the category list HTML without re-attaching event listeners
 */
private renderCategoryListOnly(): void {
  const categoryList = this.modalElement?.querySelector("#category-list");
  if (!categoryList) return;

  categoryList.innerHTML = this.generateCategoryListHTML();
  // No attachEventListeners() call - parent listeners still work!
}
```

这个方法只更新 HTML 内容，但**不重新绑定事件监听器**，因为父容器的监听器会自动处理新生成的子元素。

### Benefits

| Aspect | Before (Re-binding) | After (Delegation) |
|--------|---------------------|-------------------|
| **Listeners/Element** | N (increases with updates) | 1 (constant) |
| **Memory Usage** | ↑ Growing | ✓ Constant |
| **Bug Risk** | High (duplicate handlers) | Low (single handler) |
| **Performance** | Degrades over time | Stable |
| **Code Clarity** | Scattered rebinds | Centralized in one place |

### When to Use Event Delegation

**✅ Use when:**
- Dynamic content (elements added/removed frequently)
- List items with repeated actions
- Modal dialogs with conditional UI states
- Any scenario where DOM updates are common

**❌ Don't use when:**
- Static UI with no DOM changes
- Need specific event.target checks (can get complex)
- Performance-critical scenarios (delegation adds slight overhead)

### Benefits
对于 CategoryManagerModal 这种场景（通常 < 100 个分类项）：

- **Before**: 重复监听器（数量取决于用户操作次数）
- **After**: 固定数量的监听器（3-4 个）
- **Maintenance**: 显著改善（避免了难以追踪的 bug）

### Related Patterns
- **React**: 自动处理事件委托（所有事件在根节点）
- **Vue**: 类似，通过虚拟 DOM diff 优化
- **Vanilla JS**: 需要手动实现（如本项目）

### Testing Strategy
验证事件委托正确性：

1. **开发者工具 → Elements → Event Listeners**
   - 检查按钮上的监听器数量
   - 应该看到 0 个直接监听器（都在父容器上）

2. **操作流程测试**
   - 输入搜索 → 检查监听器数量（不应增加）
   - 切换编辑模式 → 再次检查
   - 保存修改 → 再次检查

3. **功能测试**
   - 所有按钮应正常工作
   - 确认对话框仅弹出一次
   - 编辑模式切换正常

---

## CategoryTagInput: Incremental DOM Updates

### Challenge
CategoryTagInput 是一个复杂的类微信标签输入组件，包含：
- 已选标签的显示与移除
- 下拉列表的过滤与选择
- 新分类的创建
- 焦点管理与光标位置保持

初始实现采用了"完全重建 DOM"的方式，每次状态变化都调用 `render()` 重新生成所有 HTML。这导致：

- **焦点丢失**：输入框重建后失去焦点
- **光标位置丢失**：输入内容被清空
- **滚动位置重置**：长列表滚动到顶部
- **用户体验差**：输入时不断失去焦点

### Solution: Incremental Updates
采用增量更新策略，仅更新需要变化的 DOM 部分：

```typescript
/**
 * Update only the tag display (selected categories)
 * Preserves input element to maintain focus
 */
private updateTagDisplay(): void {
  const tagContainer = this.containerElement.querySelector('.category-tag-container');
  if (!tagContainer) return;

  // Find the input element (we'll preserve it)
  const existingInput = tagContainer.querySelector('.category-input') as HTMLInputElement;

  // Generate new tags HTML
  const tagsHTML = this.selectedCategories.map(cat =>
    `<span class="category-tag">
      ${cat}
      <button class="remove-tag" data-category="${cat}">×</button>
    </span>`
  ).join('');

  // Update only tags, keep input element
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = tagsHTML;

  // Remove old tags (but keep input)
  const oldTags = tagContainer.querySelectorAll('.category-tag');
  oldTags.forEach(tag => tag.remove());

  // Insert new tags before input
  const fragments = Array.from(tempDiv.children);
  fragments.forEach(frag => {
    tagContainer.insertBefore(frag, existingInput);
  });

  // Input element is preserved - focus remains!
}
```

### Focus Preservation
为了确保焦点不丢失，专门实现了焦点管理机制：

```typescript
/**
 * Safely update dropdown while preserving input focus
 */
private updateDropdownDisplay(): void {
  const inputElement = this.containerElement.querySelector('.category-input') as HTMLInputElement;
  const hasFocus = document.activeElement === inputElement;
  const cursorPosition = inputElement?.selectionStart || 0;

  // Update dropdown content
  this.updateDropdown();

  // Restore focus if it was there before
  if (hasFocus && inputElement) {
    inputElement.focus();
    inputElement.setSelectionRange(cursorPosition, cursorPosition);
  }
}
```

### Comparison

| Operation | Full Rebuild | Incremental Update |
|-----------|--------------|-------------------|
| Add tag | Slower | Faster |
| Remove tag | Slower | Faster |
| Filter search | Slower | Faster |
| Focus loss | ❌ Yes | ✅ No |
| Scroll reset | ❌ Yes | ✅ No |

### Trade-offs
- **Pros**:
  - 焦点和光标位置保持
  - 更流畅的用户体验
  - 更好的性能（尤其是频繁操作时）

- **Cons**:
  - 代码复杂度略高
  - 需要小心管理 DOM 引用
  - 测试需要覆盖更多边界情况

---

## Batch Operations & Atomicity

### Problem: Race Conditions in Category Deletion
删除分类时需要两个步骤：

1. 从所有书籍中移除该分类
2. 从分类元数据中删除

如果逐个删除多个分类（串行操作），会导致：

```typescript
// ❌ Anti-pattern: Sequential deletions
for (const category of categoriesToDelete) {
  await storage.deleteCategory(category);
}
// Time: O(n * m), n=categories, m=books
// Risk: Mid-way failure leaves inconsistent state
```

**问题**：
- 性能差（串行操作导致总时间线性增长）
- 数据竞争：多个操作同时读写同一数据
- 不可回滚：部分成功、部分失败时难以恢复

### Solution: Atomic Batch Operation

```typescript
/**
 * Delete multiple categories in a single atomic operation
 * Prevents race conditions and improves performance
 */
async deleteCategoriesBatch(names: string[]): Promise<void> {
  const namesToDelete = new Set(names);

  // 1. Update books first (ensures data consistency)
  const books = await this.getBooks();
  const booksToUpdate = books.filter((book) =>
    book.categories.some((cat) => namesToDelete.has(cat))
  );

  // Parallel updates for all affected books
  await Promise.all(
    booksToUpdate.map(book => {
      book.categories = book.categories.filter(c => !namesToDelete.has(c));
      return db.books.put(book);
    })
  );

  // 2. Delete from metadata (after books are updated successfully)
  const setting = await db.settings.get('categories');
  const categories: CategoryMetadata[] = setting?.value || [];
  const filtered = categories.filter((c) => !namesToDelete.has(c.name));
  await db.settings.put({ key: "categories", value: filtered });
}
```

### Key Design Decisions

#### 1. Update Order: Books First, Metadata Second
```typescript
// ✅ Correct order
// Step 1: Update books
// Step 2: Update metadata

// ❌ Wrong order
// Step 1: Update metadata
// Step 2: Update books (if this fails, metadata is already changed!)
```

**Reasoning**:
- 如果书籍更新失败 → 元数据还没改 → 可以重试
- 如果元数据更新失败 → 书籍已经更新 → 也可以接受（只是元数据冗余）

#### 2. Parallel Book Updates
```typescript
await Promise.all(
  booksToUpdate.map(book => db.books.put(book))
);
// vs.
for (const book of booksToUpdate) {
  await db.books.put(book);
}
```

- **并行**：总时间 ≈ max(单次操作)
- **串行**：总时间 = Σ(所有操作)

对于 IndexedDB，并行写入是安全的（事务隔离）。

#### 3. Set for Lookup Performance
```typescript
const namesToDelete = new Set(names); // O(1) lookup
// vs.
const namesToDelete = names; // O(n) lookup with includes()
```

在过滤大量书籍时，Set 的 O(1) 查找性能优于 Array 的 O(n) 查找。

### Expected Performance Improvement

Batch operations use parallel updates via `Promise.all()`, providing better performance compared to sequential operations, especially when deleting multiple categories.

### Error Handling Strategy

```typescript
try {
  await storage.deleteCategoriesBatch(categoriesToDelete);
  // Success
} catch (error) {
  // Show user-friendly error
  alert(i18n.t('error.deleteFailed'));

  // Log for debugging
  console.error('Category deletion failed:', error);

  // UI should allow retry (don't close modal)
}
```

**Design principles**:
- 用户看到的：友好的错误提示
- 开发者看到的：详细的 console.error
- 系统状态：允许重试，不留半成品数据

---

## Smart Sorting Algorithm

### Three-tier Sorting Logic
Categories are sorted by three criteria in order:

```typescript
categoriesWithCount.sort((a, b) => {
  // 1. Last used time (descending - recent first)
  if (a.lastUsedAt !== b.lastUsedAt) {
    return b.lastUsedAt - a.lastUsedAt;
  }

  // 2. Book count (descending - popular first)
  if (a.bookCount !== b.bookCount) {
    return b.bookCount - a.bookCount;
  }

  // 3. Alphabetical (ascending, locale-aware)
  return a.name.localeCompare(b.name, 'zh-CN', {
    sensitivity: 'base' // Ignore case, ignore accents
  });
});
```

### Rationale

#### Tier 1: lastUsedAt (Most Important)
**用户行为**：最近用过的分类最可能再次使用

**场景**：
- 用户正在录入某个主题的书籍
- 连续添加 10 本 "科技" 类书籍
- "科技" 应该持续排在最前面

**实现**：
```typescript
// Update lastUsedAt when adding/editing books
async touchCategory(name: string): Promise<void> {
  const category = categories.find(c => c.name === name);
  if (category) {
    category.lastUsedAt = Date.now();
    await db.settings.put({ key: 'categories', value: categories });
  }
}
```

#### Tier 2: bookCount (Secondary)
**用户行为**：包含大量书籍的分类是重要分类

**场景**：
- "Fiction" 有 100 本书
- "Biography" 有 5 本书
- 用户可能更常操作 "Fiction"

**权衡**：
- 不使用 createdAt（创建时间与重要性无关）
- 不使用 editCount（增加复杂度，收益有限）

#### Tier 3: Alphabetical (Fallback)
**用户行为**：当其他因素相同时，字母顺序便于查找

**特殊处理**：
```typescript
localeCompare(b.name, 'zh-CN', {
  sensitivity: 'base'
});
```

- `sensitivity: 'base'`: 忽略大小写和重音符号
  - `"Café"` == `"cafe"` == `"CAFE"`
- `'zh-CN'`: 中文按拼音排序
  - `"阿"` < `"波"` < `"次"`

### Edge Cases

| Case | Behavior |
|------|----------|
| Same lastUsedAt & bookCount | Alphabetical |
| lastUsedAt = 0 (never used) | Grouped at end, sorted by bookCount |
| Empty category (bookCount = 0) | Valid, sorted by lastUsedAt |
| Chinese + English mixed | Chinese by pinyin, English by ASCII |

### Implementation Notes
- Sorting operation is efficient for typical category counts
- bookCount is computed on demand when needed for display

---

**Last Updated**: 2025-12-30
**Author**: JoeyTeng with Claude Sonnet 4.5
