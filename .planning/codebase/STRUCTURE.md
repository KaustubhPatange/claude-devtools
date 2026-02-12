# Codebase Structure

**Analysis Date:** 2026-02-12

## Directory Layout

```
claude-devtools/
├── src/
│   ├── main/               # Electron main process (Node.js)
│   │   ├── constants/      # Message tags, worktree patterns
│   │   ├── ipc/            # IPC handlers by domain
│   │   ├── services/       # Business logic services
│   │   │   ├── analysis/   # Chunk building, semantic steps
│   │   │   ├── discovery/  # Project/session scanning
│   │   │   ├── error/      # Error detection, triggers
│   │   │   ├── infrastructure/  # Cache, config, file watching
│   │   │   └── parsing/    # JSONL parsing, message classification
│   │   ├── types/          # Main process type definitions
│   │   ├── utils/          # Main utilities (jsonl, pathDecoder)
│   │   └── index.ts        # Main process entry point
│   ├── preload/            # Electron preload (IPC bridge)
│   │   ├── constants/      # IPC channel names
│   │   └── index.ts        # ElectronAPI implementation
│   ├── renderer/           # React application
│   │   ├── components/     # UI components by feature
│   │   │   ├── chat/       # Session message display
│   │   │   ├── common/     # Shared UI primitives
│   │   │   ├── dashboard/  # Overview pages
│   │   │   ├── layout/     # App shell, sidebars
│   │   │   ├── notifications/  # Notification UI
│   │   │   ├── search/     # Search UI
│   │   │   ├── settings/   # Settings pages
│   │   │   └── sidebar/    # Navigation
│   │   ├── constants/      # CSS variables, layout, colors
│   │   ├── contexts/       # React contexts (TabUIContext)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── store/          # Zustand state management
│   │   │   ├── slices/     # Domain slices
│   │   │   └── utils/      # Store helpers
│   │   ├── types/          # Renderer type definitions
│   │   ├── utils/          # Renderer utilities
│   │   ├── App.tsx         # React root component
│   │   ├── main.tsx        # React entry point
│   │   └── index.css       # Global styles, theme
│   └── shared/             # Cross-process code
│       ├── constants/      # Cache, window, colors
│       ├── types/          # Shared type definitions
│       └── utils/          # Pure utilities
├── test/                   # Vitest tests
│   ├── main/               # Main process tests
│   │   ├── ipc/            # IPC handler tests
│   │   ├── services/       # Service tests
│   │   └── utils/          # Utility tests
│   ├── renderer/           # Renderer tests
│   │   ├── hooks/          # Hook tests
│   │   ├── store/          # Store tests
│   │   └── utils/          # Utility tests
│   └── shared/             # Shared code tests
├── resources/              # App icons, assets
├── dist/                   # Build output (renderer)
├── dist-electron/          # Build output (main, preload)
├── .claude/                # Claude Code configuration
│   ├── plans/              # Feature plans
│   └── rules/              # Project rules
├── .planning/              # GSD planning documents
│   └── codebase/           # Codebase analysis docs
├── package.json            # Dependencies, scripts
├── tsconfig.json           # TypeScript config (base)
├── tsconfig.node.json      # TypeScript config (main)
├── vite.config.ts          # Vite build config
└── vitest.config.ts        # Vitest test config
```

## Directory Purposes

**src/main/**
- Purpose: Electron main process - file system access, JSONL parsing, business logic
- Contains: Entry point, services (5 domains), IPC handlers (10 domains), types, utilities
- Key files: `index.ts` (app lifecycle), `services/index.ts` (barrel export), `ipc/handlers.ts` (IPC setup)

**src/main/services/analysis/**
- Purpose: Chunk building and session analysis
- Contains: ChunkBuilder, ChunkFactory, ConversationGroupBuilder, ProcessLinker, SemanticStepExtractor, SemanticStepGrouper, SubagentDetailBuilder, ToolExecutionBuilder, ToolResultExtractor, ToolSummaryFormatter
- Key files: `ChunkBuilder.ts` (orchestrator), `ChunkFactory.ts` (chunk creation), `SemanticStepExtractor.ts` (step extraction)

**src/main/services/discovery/**
- Purpose: Project/session scanning, subagent resolution
- Contains: ProjectScanner, ProjectPathResolver, SessionSearcher, SessionContentFilter, SubagentLocator, SubagentResolver, SubprojectRegistry, WorktreeGrouper
- Key files: `ProjectScanner.ts` (file system scanning), `SubagentResolver.ts` (subagent linking)

**src/main/services/infrastructure/**
- Purpose: Core application infrastructure
- Contains: DataCache, FileWatcher, ConfigManager, NotificationManager, TriggerManager, UpdaterService, SshConnectionManager, FileSystemProvider (local/SSH)
- Key files: `DataCache.ts` (LRU cache), `FileWatcher.ts` (file monitoring), `ConfigManager.ts` (config persistence)

**src/main/services/parsing/**
- Purpose: JSONL parsing and classification
- Contains: SessionParser, MessageClassifier, ClaudeMdReader, GitIdentityResolver
- Key files: `SessionParser.ts` (JSONL parsing), `MessageClassifier.ts` (message categorization)

**src/main/services/error/**
- Purpose: Error detection and notification triggers
- Contains: ErrorDetector, ErrorMessageBuilder, ErrorTriggerChecker, ErrorTriggerTester, TriggerMatcher
- Key files: `ErrorDetector.ts` (token-based detection), `TriggerMatcher.ts` (pattern matching)

**src/main/ipc/**
- Purpose: IPC request handlers organized by domain
- Contains: projects, sessions, search, subagents, validation, utility, notifications, config, ssh, updater handlers
- Key files: `handlers.ts` (registration), `sessions.ts` (session operations), `config.ts` (configuration)

**src/preload/**
- Purpose: Secure IPC bridge between main and renderer
- Contains: ElectronAPI implementation, IPC channel constants
- Key files: `index.ts` (contextBridge API), `constants/ipcChannels.ts` (channel names)

**src/renderer/components/chat/**
- Purpose: Session message display and visualization
- Contains: Chat groups (User, AI, System), chat history, display items, viewers (markdown, code, diff), SessionContextPanel (visible context tracking)
- Key files: `ChatHistory.tsx` (timeline container), `AIChatGroup.tsx` (AI responses), `ContextBadge.tsx` (per-turn context popover)

**src/renderer/components/chat/items/**
- Purpose: Individual message/tool item renderers
- Contains: BaseItem, LinkedToolItem, ExecutionTrace, SubagentItem, ThinkingItem, TextItem, SlashItem, TeammateMessageItem, MetricsPill
- Key files: `LinkedToolItem.tsx` (tool call+result), `SubagentItem.tsx` (subagent display)

**src/renderer/components/chat/SessionContextPanel/**
- Purpose: Visible context tracking panel UI
- Contains: Main panel component, section wrappers, per-injection item renderers, directory tree, formatting utils
- Key files: `index.tsx` (panel component), `components/` (section wrappers), `items/` (injection renderers)

**src/renderer/store/**
- Purpose: Zustand state management
- Contains: Store creation, 14 domain slices, store utilities
- Key files: `index.ts` (store composition, IPC listeners), `slices/sessionDetailSlice.ts` (session data), `slices/tabSlice.ts` (tab management)

**src/renderer/store/slices/**
- Purpose: Domain-specific state slices
- Contains: projectSlice, repositorySlice, sessionSlice, sessionDetailSlice, subagentSlice, conversationSlice, tabSlice, tabUISlice, paneSlice, uiSlice, notificationSlice, configSlice, connectionSlice, updateSlice
- Key files: `sessionDetailSlice.ts` (session data), `tabUISlice.ts` (per-tab UI state)

**src/shared/**
- Purpose: Cross-process types and pure utilities
- Contains: Type definitions (api, notifications, visualization), utilities (tokenFormatting, modelParser, logger), constants (cache, window, colors)
- Key files: `types/index.ts` (type re-exports), `utils/tokenFormatting.ts` (token utilities)

**test/**
- Purpose: Vitest unit tests
- Contains: Tests organized by process (main, renderer, shared), mirrors src/ structure
- Key files: `main/services/analysis/ChunkBuilder.test.ts`, `renderer/store/sessionSlice.test.ts`

## Key File Locations

**Entry Points:**
- `src/main/index.ts`: Main process entry (381 lines) - app lifecycle, service initialization, window creation
- `src/renderer/main.tsx`: Renderer entry (12 lines) - React rendering
- `src/preload/index.ts`: Preload bridge (369 lines) - ElectronAPI implementation
- `src/renderer/App.tsx`: React root - theme, IPC listeners, layout

**Configuration:**
- `package.json`: Dependencies, build scripts
- `tsconfig.json`: Base TypeScript config
- `tsconfig.node.json`: Main process TypeScript config
- `vite.config.ts`: Vite build configuration
- `vitest.config.ts`: Vitest test configuration
- `src/renderer/index.css`: Global styles, CSS custom properties

**Core Logic:**
- `src/main/services/analysis/ChunkBuilder.ts`: Chunk building orchestration
- `src/main/services/parsing/SessionParser.ts`: JSONL parsing
- `src/main/services/discovery/SubagentResolver.ts`: Subagent linking
- `src/main/services/infrastructure/DataCache.ts`: LRU cache
- `src/main/services/infrastructure/FileWatcher.ts`: File monitoring

**Testing:**
- `test/main/services/analysis/ChunkBuilder.test.ts`: Chunk building tests
- `test/main/services/parsing/SessionParser.test.ts`: JSONL parsing tests
- `test/renderer/store/sessionSlice.test.ts`: Session state tests

## Naming Conventions

**Files:**
- Services/Components: PascalCase - `ChunkBuilder.ts`, `SessionParser.ts`, `AIChatGroup.tsx`
- Utilities: camelCase - `pathDecoder.ts`, `jsonl.ts`, `formatters.ts`
- Types: camelCase - `messages.ts`, `data.ts`, `api.ts`
- Barrel exports: `index.ts`

**Directories:**
- All lowercase with domain names - `services/`, `analysis/`, `components/`
- Feature-based organization - `components/chat/`, `components/settings/`

**Constants:**
- UPPER_SNAKE_CASE - `PARALLEL_WINDOW_MS`, `MAX_CACHE_SESSIONS`, `SESSION_REFRESH_DEBOUNCE_MS`

**Functions:**
- Type guards: `isXxx` - `isUserChunk()`, `isParsedRealUserMessage()`, `isAIChunk()`
- Builders: `buildXxx` - `buildChunks()`, `buildSubagentDetail()`, `buildDisplayItems()`
- Getters: `getXxx` - `getSessionPath()`, `getProjects()`, `getTaskCalls()`
- Creators: `createXxx` - `createLogger()`, `createConfigSlice()`, `createWindow()`

**Type Guards:**
- Message: `isParsedRealUserMessage()`, `isParsedInternalUserMessage()`, `isAssistantMessage()`
- Chunk: `isUserChunk()`, `isAIChunk()`, `isSystemChunk()`, `isCompactChunk()`
- Context: `isClaudeMdInjection()`, `isMentionedFileInjection()`, `isToolOutputInjection()`, `isThinkingTextInjection()`, `isTeamCoordinationInjection()`, `isUserMessageInjection()`

## Where to Add New Code

**New Service (Main Process):**
- Implementation: `src/main/services/{domain}/{ServiceName}.ts`
- Export: Add to `src/main/services/{domain}/index.ts` barrel
- Usage: Import from `@main/services` or `@main/services/{domain}`

**New IPC Handler:**
- Implementation: Add to existing `src/main/ipc/{domain}.ts` or create new domain file
- Channel constant: Add to `src/preload/constants/ipcChannels.ts`
- Registration: Add to `src/main/ipc/handlers.ts` if new domain
- API exposure: Add method to ElectronAPI in `src/preload/index.ts`
- Type: Update `@shared/types/api.ts` if needed

**New React Component:**
- Primary code: `src/renderer/components/{feature}/{ComponentName}.tsx`
- Feature categories: chat, common, dashboard, layout, notifications, search, settings, sidebar
- Tests: `test/renderer/components/{feature}/{ComponentName}.test.tsx`

**New Zustand Slice:**
- Implementation: `src/renderer/store/slices/{domain}Slice.ts`
- Export: Add factory function `create{Domain}Slice`
- Integration: Add to store composition in `src/renderer/store/index.ts`
- Type: Update `AppState` in `src/renderer/store/types.ts`

**New Hook:**
- Implementation: `src/renderer/hooks/use{Name}.ts`
- Tests: `test/renderer/hooks/use{Name}.test.ts`
- Import: Direct import from file (no barrel exports for hooks)

**Utilities:**
- Main process: `src/main/utils/{utilityName}.ts`
- Renderer: `src/renderer/utils/{utilityName}.ts`
- Shared (pure): `src/shared/utils/{utilityName}.ts`

**Types:**
- Main process only: `src/main/types/{name}.ts`
- Renderer only: `src/renderer/types/{name}.ts`
- Shared across processes: `src/shared/types/{name}.ts`

## Special Directories

**node_modules/**
- Purpose: Package dependencies
- Generated: Yes (via `pnpm install`)
- Committed: No

**dist/ and dist-electron/**
- Purpose: Build output (production bundles)
- Generated: Yes (via `pnpm build`)
- Committed: No

**.planning/codebase/**
- Purpose: GSD codebase analysis documents
- Generated: Yes (via `/gsd:map-codebase`)
- Committed: Yes (planning metadata)

**.claude/plans/**
- Purpose: Feature implementation plans
- Generated: Yes (via `/gsd:plan-phase`)
- Committed: Yes (project planning)

**test/mocks/**
- Purpose: Test fixtures and mock data
- Generated: No (manually created)
- Committed: Yes (test infrastructure)

**resources/**
- Purpose: Application icons and assets
- Generated: No (manually created)
- Committed: Yes (app resources)

**src/renderer/components/chat/SessionContextPanel/**
- Purpose: Visible context tracking panel UI (6 context categories)
- Generated: No
- Committed: Yes
- Special: Deep component hierarchy with section wrappers and item renderers

**src/main/services/**
- Purpose: Domain-organized business logic
- Generated: No
- Committed: Yes
- Special: Each domain has barrel export (`index.ts`)

---

*Structure analysis: 2026-02-12*
