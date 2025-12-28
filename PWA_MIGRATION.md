# PWA 改造完成 ✅

Book Scanner 已成功改造为 Progressive Web App (PWA)，支持离线访问、应用安装和大容量数据存储。

## 核心功能

### 1. IndexedDB 存储

替代 localStorage，提供：

- 存储容量从 10MB 提升到 50MB+ (视浏览器而定)
- 支持存储二进制数据 (封面图片缓存)
- 自动从 localStorage 迁移旧数据
- 更好的性能和可靠性

### 2. 离线支持

通过 Service Worker 实现：

- 缓存静态资源和封面图片
- 离线模式下应用仍可访问
- 自动更新缓存

### 3. 应用安装

支持"添加到主屏幕"：

- 独立窗口模式运行
- 自定义应用图标和主题色
- 友好的安装提示界面
- iOS 和 Android 全平台支持

## 使用指南

### 本地开发

```bash
npm run dev
```

在 Chrome DevTools > Application > Service Workers 可查看 Service Worker 状态。

### PWA 安装

**桌面浏览器 (Chrome/Edge):**

- 地址栏右侧点击"安装"图标
- 或页面底部显示的安装横幅

**iOS Safari:**

- 点击分享按钮 → "添加到主屏幕"

**Android Chrome:**

- 自动显示安装横幅
- 或通过菜单 → "安装应用"

### 离线使用

安装后，即使断网也可以：

- 查看已保存的书籍
- 使用所有本地功能
- 查看已缓存的封面图片

联网后自动同步新数据。

## 部署

### GitHub Pages

```bash
npm run build
npm run deploy
```

### 其他平台 (Vercel, Netlify 等)

确保：

- HTTPS 环境 (通常自动提供)
- `dist` 目录包含所有文件
- Service Worker 和 manifest 在根目录可访问

## 已知限制

1. **iOS Safari**:
   - IndexedDB 限制约 50MB
   - 需手动"添加到主屏幕"

2. **缓存**:
   - 系统存储压力大时可能被清理
   - 建议定期导出备份

3. **后台运行**:
   - PWA 不能在后台长期运行
   - 推送通知需要用户授权

## 未来计划

- 图片压缩功能 (iOS 50MB 限制优化)
- LRU 缓存策略
- Google Drive 云端同步
- 多设备数据同步

## 参考资料

- [PWA 文档](https://web.dev/progressive-web-apps/)
- [Dexie.js 文档](https://dexie.org/)

---

**版本:** v2.0 (PWA) | **完成时间:** 2025-12-28 | **Breaking Changes:** 无
