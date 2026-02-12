# Coding Conventions

**Analysis Date:** 2026-02-12

## Naming Patterns

**Files:**
- Services/Components: PascalCase - `ChunkBuilder.ts`, `ProjectScanner.ts`, `AIChatGroup.tsx`
- Utilities: camelCase - `pathDecoder.ts`, `tokenizer.ts`, `formatters.ts`
- Type definitions: camelCase - `messages.ts`, `chunks.ts`, `data.ts`
- Test files: `*.test.ts` - mirrors source file name

**Functions:**
- Standard functions: camelCase - `encodePath`, `extractProjectName`, `formatDuration`
- Type guards: `isXxx` - `isParsedRealUserMessage`, `isAIChunk`, `isValidEncodedPath`
- Builder functions: `buildXxx` - `buildChunks`, `buildUserChunk`, `buildSessionPath`
- Getter functions: `getXxx` - `getProjectsBasePath`, `getExpandedDisplayItemIds`
- React components: Arrow functions with PascalCase names

**Variables:**
- Standard: camelCase - `chunkBuilder`, `sessionId`, `projectPath`
- Constants: UPPER_SNAKE_CASE - `EMPTY_METRICS`, `HARD_NOISE_TAGS`, `CONFIG_GET`
- React components: PascalCase - `AIChatGroup`, `TokenUsageDisplay`
- Unused parameters: Leading underscore - `_event`, `_arg`

**Types:**
- Interfaces/Types: PascalCase - `ParsedMessage`, `EnhancedChunk`, `SessionMetrics`
- Interfaces: NO "I" prefix (modern convention) - `ToolCall`, not `IToolCall`
- Enum members: PascalCase or UPPER_CASE - `TriggerColor`, `EMPTY_STDOUT`

## Code Style

**Formatting:**
- Tool: Prettier 3.8.1
- Config: `/Users/bskim/claude-devtools/.prettierrc.json`
- Key settings:
  - Semi: true (always use semicolons)
  - Single quotes: true
  - Tab width: 2 spaces
  - Trailing comma: es5
  - Print width: 100 characters
  - Arrow parens: always
  - End of line: lf
  - Bracket spacing: true
  - Bracket same line: false
  - Tailwind plugin: `prettier-plugin-tailwindcss` (auto-sorts classes)

**Linting:**
- Tool: ESLint 9.39.2 with typescript-eslint
- Config: `/Users/bskim/claude-devtools/eslint.config.js`
- Key rules:
  - TypeScript strict mode enabled
  - Type-aware linting via `projectService`
  - React + Hooks + A11y rules
  - Security plugin for AI-generated code
  - SonarJS for code quality
  - Module boundaries enforced (main/renderer/preload/shared separation)
  - Import sorting via `simple-import-sort`
  - No default exports (prefer named exports)
  - Explicit function return types (warn)
  - Explicit module boundary types (warn)

## Import Organization

**Order (enforced by `simple-import-sort`):**
1. Side effect imports (CSS, styles)
2. Node.js builtins (`node:fs`, `node:path`)
3. React packages (`react`, `react-dom`)
4. External packages (`@?\\w`)
5. Internal aliases (`@/`)
6. Parent imports (`../`)
7. Same-folder imports (`./`)
8. Type imports (last)

**Path Aliases:**
- `@main/*` → `src/main/*`
- `@renderer/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`
- `@preload/*` → `src/preload/*`

**Example:**
```typescript
import React, { useCallback, useMemo } from 'react';

import { ChunkBuilder, ProjectScanner } from '@main/services';
import { useStore } from '@renderer/store';
import { formatDuration } from '@shared/utils/formatters';

import { DisplayItemList } from './DisplayItemList';

import type { EnhancedChunk } from '@main/types';
```

**Import Restrictions:**
- No deep relative imports (`../../../`) - use path aliases
- No circular dependencies (max depth: 3)
- Module boundaries enforced:
  - Renderer → renderer + shared only
  - Main → main + shared only
  - Preload → preload + shared only
  - Shared → shared + main (for type re-exports)

## Type Conventions

**Type Imports:**
Use `type` modifier for type-only imports:
```typescript
import { type EnhancedChunk, type ParsedMessage } from '@main/types';
```

**Type Exports:**
```typescript
export type { Session, SessionDetail } from './types';
```

**Function Return Types:**
Always specify for exported functions (warn-level enforcement):
```typescript
export function buildChunks(messages: ParsedMessage[]): EnhancedChunk[] {
  // ...
}
```

**Type Guards:**
Use discriminated union pattern with type predicates:
```typescript
export function isParsedRealUserMessage(msg: ParsedMessage): boolean {
  return msg.type === 'user' && !msg.isMeta && typeof msg.content === 'string';
}

export function isUserChunk(chunk: Chunk | EnhancedChunk): chunk is UserChunk {
  return chunk.type === 'user';
}
```

**Barrel Exports:**
Services use barrel exports via `index.ts`:
```typescript
// src/main/services/index.ts
export * from './analysis';
export * from './discovery';
export * from './error';
export * from './infrastructure';
export * from './parsing';

// Usage:
import { ChunkBuilder, ProjectScanner } from '@main/services';
```

Renderer utils/hooks/types do NOT have barrel exports - import directly from files.

## Error Handling

**Main Process:**
```typescript
try {
  const result = await somethingRisky();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  return safeDefault;
}
```

**Renderer:**
```typescript
// Store error state
set({
  sessionsError: error instanceof Error ? error.message : 'Operation failed',
  sessionsLoading: false,
});
```

**IPC Handlers:**
```typescript
// Validate parameters
if (!isValidProjectId(projectId)) {
  throw new Error(`Invalid project ID: ${projectId}`);
}

// Return safe defaults on error
catch (error) {
  logger.error('Handler failed:', error);
  return [];
}
```

## Logging

**Framework:** Custom logger via `@shared/utils/logger`

**Pattern:**
```typescript
import { createLogger } from '@shared/utils/logger';

const logger = createLogger('Service:ChunkBuilder');

logger.info('Building chunks', { messageCount: messages.length });
logger.warn('Missing subagent', { taskId });
logger.error('Failed to parse', error);
```

**Console Usage:**
- Main process: `console.log/error` allowed (logging is expected)
- Renderer: Avoid console - use logger or store error state
- Tests: Console mocked in setup, errors/warnings cause test failures

## Comments

**When to Comment:**
- Complex business logic (chunk building, semantic step extraction)
- Non-obvious type guards (message classification rules)
- Workarounds or technical debt
- Public API documentation

**JSDoc/TSDoc:**
Used extensively for exported functions and types:
```typescript
/**
 * Encodes an absolute path into Claude Code's directory naming format.
 * Replaces all path separators (/ and \) with dashes.
 *
 * @param absolutePath - The absolute path to encode (e.g., "/Users/username/projectname")
 * @returns The encoded directory name (e.g., "-Users-username-projectname")
 */
export function encodePath(absolutePath: string): string {
  // ...
}
```

**Section Headers:**
Used to organize large files:
```typescript
// =============================================================================
// Chunk Building
// =============================================================================
```

## Function Design

**Size:** Keep focused and composable. Services orchestrate specialized modules.

**Parameters:**
- Use explicit types, no `any` (except in tests)
- Optional parameters last
- Use destructuring for options objects

**Return Values:**
- Always specify return type for exported functions
- Prefer explicit returns over implicit
- Return safe defaults instead of throwing (where appropriate)

**React Components:**
```typescript
// Prefer arrow functions for components
export const AIChatGroup: React.FC<AIChatGroupProps> = ({ aiGroup, userGroup }) => {
  // Component implementation
};
```

**Component Props:**
```typescript
interface AIChatGroupProps {
  aiGroup: AIGroup;
  userGroup?: UserGroup;
  onNavigate?: (messageId: string) => void;
}
```

## Module Design

**Exports:**
- Prefer named exports over default exports
- Barrel exports for service domains
- Direct exports for renderer utils/hooks

**File Organization:**
```typescript
// Imports
import { ... } from '...';

// Types/Interfaces
export interface MyInterface { ... }

// Constants
export const MY_CONSTANT = ...;

// Functions
export function myFunction() { ... }

// Classes
export class MyClass { ... }
```

**Services Pattern:**
```typescript
export class ChunkBuilder {
  buildChunks(messages: ParsedMessage[]): EnhancedChunk[] {
    // Implementation
  }

  buildSessionDetail(session: Session): SessionDetail {
    // Implementation
  }
}
```

## React Conventions

**Component Structure:**
```typescript
// Imports
import React, { useCallback, useMemo } from 'react';

// Types
interface ComponentProps { ... }

// Component
export const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Hooks first
  const store = useStore();
  const [state, setState] = useState();

  // Memoized values
  const computed = useMemo(() => ..., [deps]);

  // Callbacks
  const handleClick = useCallback(() => ..., [deps]);

  // Render
  return <div>...</div>;
};
```

**Hooks Rules:**
- Always use exhaustive deps (error-level enforcement)
- Custom hooks start with `use`: `useTabUI`, `useAutoScrollBottom`
- Keep hooks focused and composable

**State Management (Zustand):**
```typescript
// Slice pattern
export interface SessionSlice {
  // State
  sessions: Session[];
  selectedSessionId: string | null;
  sessionsLoading: boolean;
  sessionsError: string | null;

  // Actions
  fetchSessions: (projectId: string) => Promise<void>;
  selectSession: (id: string) => void;
}
```

## Tailwind CSS

**Use theme-aware classes:**
```tsx
<div className="bg-surface text-text border-border">
<div className="bg-surface-raised text-text-secondary">
```

**Auto-sorted by Prettier plugin:**
Classes automatically ordered by Prettier's Tailwind plugin.

**Custom CSS variables:**
Defined in `src/renderer/index.css` - use via Tailwind classes:
- `--color-surface` → `bg-surface`
- `--color-text` → `text-text`
- `--color-border` → `border-border`

## Security

**Enabled Rules:**
- `security/detect-eval-with-expression`: error
- `security/detect-child-process`: warn
- File system access: allowed (desktop app requirement)
- Dynamic patterns: allowed (intentional in this app)

**Parameter Mutation:**
Prevented via `no-param-reassign` except for:
- `draft` (Immer patterns)
- `acc` (reduce accumulators)
- `state` (Zustand)

---

*Convention analysis: 2026-02-12*
