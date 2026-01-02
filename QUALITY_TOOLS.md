# 代码质量工具链配置

本项目使用 ESLint、Prettier、Husky 和 lint-staged 确保代码质量。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化 Git Hooks

```bash
npm run prepare
```

这会自动配置 Husky Git hooks。

## 📋 可用命令

### 开发命令

```bash
# 开发服务器
npm run dev

# 构建项目
npm run build

# 预览构建
npm run preview
```

### 代码质量命令

```bash
# TypeScript 类型检查
npm run type-check

# ESLint 检查
npm run lint

# ESLint 自动修复
npm run lint:fix

# Prettier 格式化
npm run format

# Prettier 检查格式
npm run format:check

# 运行所有质量检查
npm run quality
```

## 🔧 工具配置

### ESLint

- 配置文件：`eslint.config.js`
- 规则：TypeScript 推荐 + 自定义规则
- 主要规则：
  - ✅ 允许 `console`（前端调试需要）
  - ⚠️ `any` 类型为警告（部分场景合理）
  - ✅ 强制 import 排序
  - ✅ 强制使用 `===` 和 `!==`
  - ✅ 优先使用 `const`

### Prettier

- 配置文件：`.prettierrc.json`
- 规则：
  - 单引号
  - 分号
  - 2 空格缩进
  - 行宽 100
  - LF 换行符

### Git Hooks (Husky + lint-staged)

**Pre-commit Hook：**

- 自动格式化暂存文件（Prettier）
- 自动修复 ESLint 问题
- 检查 TypeScript 类型（仅暂存文件）

**配置文件：**

- `.husky/pre-commit`
- `.lintstagedrc.json`

## 🔄 GitHub Actions

### 代码质量检查 (`.github/workflows/quality.yml`)

**触发条件：**

- Pull Request 到 `main` 分支
- Push 到 `main` 分支

**检查项：**

1. TypeScript 类型检查
2. ESLint 检查
3. Prettier 格式检查
4. 构建测试

所有检查必须通过才能合并 PR。

## 🛠️ VS Code 集成

项目包含 VS Code 配置（`.vscode/settings.json`）：

- **保存时自动格式化**（Prettier）
- **保存时自动修复 ESLint 问题**
- **TypeScript 内联错误提示**

**推荐安装的 VS Code 扩展：**

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## 📝 首次设置

如果是首次配置，运行以下命令修复现有代码：

```bash
# 1. 安装依赖
npm install

# 2. 初始化 Husky
npm run prepare

# 3. 格式化所有代码
npm run format

# 4. 自动修复 ESLint 问题
npm run lint:fix

# 5. 检查是否还有问题
npm run quality
```

## 🔍 常见问题

### Q: Pre-commit hook 失败怎么办？

A: 检查错误信息，通常是 ESLint 或类型错误。运行 `npm run lint:fix` 和 `npm run type-check` 查看详细错误。

### Q: 如何临时跳过 Git hooks？

A: 使用 `git commit --no-verify`（不推荐，可能导致 CI 失败）

### Q: ESLint 和 Prettier 冲突怎么办？

A: 已配置 `eslint-config-prettier` 禁用冲突规则，Prettier 负责格式，ESLint 负责代码质量。

### Q: 为什么允许使用 `any`？

A: 部分场景（API 解析、第三方库类型缺失）使用 `any` 是合理的，设为 `warn` 提醒但不阻止。

## 📚 相关文档

- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
- [TypeScript ESLint](https://typescript-eslint.io/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
