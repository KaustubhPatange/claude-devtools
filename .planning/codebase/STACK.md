# Technology Stack

**Analysis Date:** 2026-02-12

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code (main, preload, renderer)

**Secondary:**
- JavaScript - Configuration files (eslint.config.js, postcss.config.cjs, tailwind.config.js)

## Runtime

**Environment:**
- Node.js 25.2.1+ (ES2020/ES2022 target)
- Electron 40.3.0 (Chromium-based desktop runtime)

**Package Manager:**
- pnpm 10.25.0 (enforced via packageManager field)
- Lockfile: pnpm-lock.yaml (present)

## Frameworks

**Core:**
- Electron 40.3.0 - Desktop app framework (three-process architecture)
- React 18.3.1 - UI framework for renderer process
- React DOM 18.3.1 - React renderer
- Zustand 4.5.0 - State management

**Testing:**
- Vitest 3.1.4 - Test runner with happy-dom environment
- @vitest/coverage-v8 3.1.4 - Code coverage
- happy-dom 17.6.3 - Browser environment simulation

**Build/Dev:**
- electron-vite 2.3.0 - Build tool (Vite-based for Electron)
- Vite 5.4.2 - Development server and bundler
- electron-builder 24.13.3 - Packaging and distribution
- tsx 4.21.0 - TypeScript execution for test scripts

## Key Dependencies

**Critical:**
- ssh2 1.17.0 - SSH/SFTP connectivity for remote session access
- ssh-config 5.0.4 - SSH config file parsing
- electron-updater 6.7.3 - Auto-update functionality via GitHub releases

**Infrastructure:**
- @tanstack/react-virtual 3.10.8 - Virtual scrolling for large session lists
- @dnd-kit/core 6.3.1 + @dnd-kit/sortable 10.0.0 - Drag-and-drop for UI
- date-fns 3.6.0 - Date formatting and manipulation
- lucide-react 0.562.0 - Icon library

**Markdown/Content:**
- react-markdown 10.1.0 - Markdown rendering
- remark-gfm 4.0.1 - GitHub Flavored Markdown support
- unified 11.0.5 - Text processing pipeline
- remark-parse 11.0.0 - Markdown parser
- mdast-util-to-hast 13.2.1 - Markdown to HTML AST conversion

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS framework
- @tailwindcss/typography 0.5.19 - Typography plugin
- autoprefixer 10.4.17 - CSS vendor prefixing
- PostCSS 8.4.35 - CSS processing

**Code Quality:**
- ESLint 9.39.2 - Linting
- typescript-eslint 8.54.0 - TypeScript ESLint rules
- Prettier 3.8.1 - Code formatting
- prettier-plugin-tailwindcss 0.7.2 - Tailwind class sorting
- knip 5.82.1 - Unused code detection

**ESLint Plugins:**
- eslint-plugin-react 7.37.5 + eslint-plugin-react-hooks 7.0.1 - React rules
- eslint-plugin-jsx-a11y 6.10.2 - Accessibility rules
- eslint-plugin-tailwindcss 3.18.2 - Tailwind CSS rules
- eslint-plugin-boundaries 5.3.1 - Enforce Electron architecture boundaries
- eslint-plugin-security 3.0.1 - Security vulnerability detection
- eslint-plugin-sonarjs 3.0.6 - Code quality and bug detection
- eslint-plugin-simple-import-sort 12.1.1 - Import sorting
- eslint-plugin-import 2.32.0 - Import validation

## Configuration

**Environment:**
- No .env files - Desktop app reads from `~/.claude/` directories
- Local data: `~/.claude/projects/{encoded-path}/*.jsonl` - Session files
- Config: `~/.claude/claude-devtools-config.json` - App configuration
- Notifications: `~/.claude/claude-devtools-notifications.json` - Notification history
- Remote access: SSH/SFTP to remote `~/.claude/projects/` (optional)

**Build:**
- `electron.vite.config.ts` - Electron-specific Vite configuration with path aliases
- `tsconfig.json` - Main TypeScript config (renderer + shared)
- `tsconfig.node.json` - Main/preload process TypeScript config
- `tsconfig.test.json` - Test TypeScript config
- `vitest.config.ts` - Main test configuration
- `vitest.critical.config.ts` - Critical path coverage configuration
- `electron-builder.yml` - Build and packaging configuration

**Code Style:**
- `eslint.config.js` - Flat ESLint config with process-specific rules
- `.prettierrc.json` - Prettier formatting rules
- `tailwind.config.js` - Tailwind CSS customization with CSS variable theme

**Path Aliases:**
- `@main/*` → `src/main/*` (main process)
- `@renderer/*` → `src/renderer/*` (renderer process)
- `@shared/*` → `src/shared/*` (cross-process utilities)
- `@preload/*` → `src/preload/*` (preload bridge)

## Platform Requirements

**Development:**
- Node.js 25+ (specified in package.json engines would go here if present)
- pnpm 10.25.0+
- macOS or Windows (Linux support via Electron but not tested)

**Production:**
- macOS: DMG and ZIP distribution
- Windows: NSIS installer
- Code signing: macOS notarization via Apple Team ID (env.APPLE_TEAM_ID)
- Auto-updates: GitHub releases via electron-updater

---

*Stack analysis: 2026-02-12*
