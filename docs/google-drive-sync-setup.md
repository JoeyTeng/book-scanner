# Google Drive Sync Setup

## 目标

本指南说明如何配置 Google Drive 同步备份功能，包括获取 `VITE_GOOGLE_DRIVE_CLIENT_ID`、本地与生产环境配置，以及使用与影响说明。

## 前置条件

- 拥有 Google Cloud 项目管理权限
- 应用以 HTTPS 访问（本地开发可使用 `http://localhost:5173`）
- 已启用本项目的备份/恢复功能

## 获取 VITE_GOOGLE_DRIVE_CLIENT_ID

1. 打开 Google Cloud Console，选择或创建项目。
2. 在 APIs & Services 中启用 **Google Drive API**。
3. 配置 **OAuth consent screen**：
   - User type 选择 External 或 Internal
   - 填写应用名称、支持邮箱、开发者联系方式
   - External 模式下，添加测试用户账号（未发布前仅测试用户可用）
4. 在 Scopes 中添加 Drive 的最小权限：
   - `https://www.googleapis.com/auth/drive.appdata`
5. 创建 OAuth 2.0 Client ID：
   - Application type 选择 **Web application**
   - 添加 Authorized JavaScript origins：
     - `http://localhost:5173`
     - 你的生产域名，例如 `https://your-domain.com`
6. 复制生成的 Client ID。

## 配置方式

本项目使用 Vite 环境变量。新增或修改 `.env.local`：

```env
VITE_GOOGLE_DRIVE_CLIENT_ID=YOUR_CLIENT_ID_HERE
```

生产环境请确保构建时也注入该变量，例如在 CI 或部署平台的环境变量中设置。

## 验证流程

1. 打开应用，进入 **Backup / Restore**。
2. 点击 **Connect Google Drive** 完成授权。
3. 点击 **Sync Full Backup to Drive**。
4. 点击 **Restore Latest from Drive** 验证恢复流程。

## 行为与影响

- **存储位置**：使用 Google Drive 的 `appDataFolder`（对用户不可见）。
- **备份内容**：仅同步 Full Backup（包含所有元数据与图片缓存）。
- **覆盖策略**：按固定文件名覆盖最新备份，不保留历史版本。
- **令牌管理**：access token 仅存在内存中，刷新页面或过期后需重新授权。
- **账号切换**：若切换账号且旧 `fileId` 不存在，会自动创建新备份文件。
- **隐私与安全**：备份内容未加密，数据将上传至 Google Drive。
- **配额与网络**：受 Google Drive 配额与网络状况影响。

## 排障

- **提示缺少 Client ID**：检查 `VITE_GOOGLE_DRIVE_CLIENT_ID` 是否注入到构建中。
- **授权失败**：确认 OAuth consent screen 已配置、测试用户已添加、浏览器未阻止弹窗。
- **找不到备份**：请先执行一次同步，或确认授权账号一致。
- **权限错误/401**：确认 Drive API 已启用、Origin 配置正确、Scope 包含 `drive.appdata`。

## 撤销授权

在 Google Account → Security → Third-party access 中移除此应用授权即可。
