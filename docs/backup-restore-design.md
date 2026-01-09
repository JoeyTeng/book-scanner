# 备份/恢复设计

## 背景与目标

当前 JSON 导入/导出只覆盖部分数据。新方案需要提供完整备份/恢复，覆盖所有数据库内容，同时保留 CSV 与 Markdown 导出行为不变，并为后续第三方与云端备份扩展预留接口。

## 需求范围

- 提供两类备份/恢复：
  - Metadata Backup / Restore (JSON)：仅元数据
  - Full Backup / Restore (ZIP)：元数据 + 二进制缓存
- 完整覆盖：书籍、书单、设置（含 API 配置等 settings 表全部键值）
- 备份加入时间戳、校验哈希、结构版本号
- 恢复仅支持覆盖（merge 作为 TODO）
- 菜单中数据管理改为单独模态框入口
- CSV / Markdown 导出保持现状

## 方案概览

- 新增备份模块负责：
  - 生成/校验备份数据结构
  - JSON 备份序列化
  - ZIP 打包与解包
- Data Management 模态框承载备份/恢复入口
- 备份格式自描述（format + schemaVersion），不兼容旧 JSON

## 数据结构

```ts
export type BackupPayload = {
  books: Book[];
  bookLists: BookList[];
  settings: Record<string, unknown>;
};

export type BackupAssetMeta = {
  path: string;
  url: string;
  sha256: string;
  bytes: number;
  timestamp: number;
};

export type BackupData = {
  format: 'metadata' | 'full';
  schemaVersion: number;
  appVersion: string;
  createdAt: number;
  checksum: {
    algorithm: 'sha256';
    dataHash: string;
    assetsHash?: string;
  };
  data: BackupPayload;
  assets?: {
    version: number;
    items: BackupAssetMeta[];
  };
};
```

## 备份类型与文件结构

1. Metadata Backup / Restore (JSON)

- 文件：`book-scanner-backup_<timestamp>.json`
- 建议命名：`book-scanner-metadata-backup_<timestamp>.json`
- 内容：`BackupData`（不含 assets）
- 用途：仅元数据备份与恢复

2. Full Backup / Restore (ZIP)

- 文件：`book-scanner-full-backup_<timestamp>.zip`
- 结构：

```text
backup.json
assets/<sha256>.bin
```

`backup.json` 中包含 assets 清单及每项校验值

## 校验策略

- `dataHash` 对 `data` 的稳定序列化做 sha256
- `assetsHash` 对 assets 元数据列表做 sha256
- Full Backup 逐个校验二进制文件的 sha256 与 bytes

## 恢复策略

- 恢复仅支持覆盖（replace）
- Metadata 恢复默认清理 imageCache
- Full 恢复先清理再回填 imageCache
- 合并模式 TODO（后续可复用书单高级合并机制）

## UI/交互

- 菜单中数据管理改为单独入口按钮
- Data Management 模态框包含：
  - Metadata Backup / Restore (JSON)
  - Full Backup / Restore (ZIP)
  - 扩展占位：Zotero / Google Drive / GitHub（未实现）

## 扩展点

- BackupProvider 接口：
  - 本地文件、Zotero、Google Drive、GitHub
- SchemaVersion 预留升级空间
- 备份清单可扩展新的 assets 类型

## Google Drive 同步备份

- 认证方式：Google Identity Services（OAuth2 Token）
- Scope：`https://www.googleapis.com/auth/drive.appdata`
- 存储位置：Google Drive `appDataFolder`（对用户不可见）
- 文件命名：`book-scanner-full-backup-latest.zip`
- 同步流程：
  - 生成 Full Backup ZIP
  - 优先使用已记录的 `fileId` 覆盖上传
  - 若不存在则按文件名查询并覆盖，否则创建新文件后上传
- 恢复流程：
  - 按 `fileId` 或最新文件查询下载
  - 走现有 Full Restore 流程
- 状态持久化：
  - settings 中存储 `googleDriveSyncState`（`fileId`、`lastSyncAt`）
  - 不存储 access token
- 配置要求：
  - 通过 `VITE_GOOGLE_DRIVE_CLIENT_ID` 配置 Client ID

## TODO

- Restore merge support
- Provider-based backup targets
