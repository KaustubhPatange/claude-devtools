# Testing Patterns

**Analysis Date:** 2026-02-12

## Test Framework

**Runner:**
- Vitest 3.1.4
- Config: `/Users/bskim/claude-devtools/vitest.config.ts`

**Environment:**
- `happy-dom` 17.4.6 (DOM simulation)
- Globals enabled (`describe`, `it`, `expect` available without imports)

**Assertion Library:**
- Vitest built-in assertions (Chai-compatible API)

**Run Commands:**
```bash
pnpm test                      # Run all tests
pnpm test:watch                # Watch mode
pnpm test:coverage             # Coverage report
pnpm test:coverage:critical    # Critical path coverage only
pnpm test:chunks               # Chunk building tests
pnpm test:semantic             # Semantic step extraction
pnpm test:noise                # Noise filtering tests
pnpm test:task-filtering       # Task tool filtering
```

## Test File Organization

**Location:**
Co-located in separate `test/` directory, mirroring source structure.

**Naming:**
`*.test.ts` - matches source file name exactly.

**Structure:**
```
test/
├── main/
│   ├── ipc/                   # IPC handler tests
│   │   ├── configValidation.test.ts
│   │   └── guards.test.ts
│   ├── services/              # Service layer tests
│   │   ├── analysis/          # ChunkBuilder, etc.
│   │   ├── discovery/         # ProjectPathResolver, SessionSearcher
│   │   ├── infrastructure/    # FileWatcher
│   │   └── parsing/           # MessageClassifier, SessionParser
│   └── utils/                 # Utility function tests
│       ├── jsonl.test.ts
│       ├── pathDecoder.test.ts
│       ├── pathValidation.test.ts
│       ├── regexValidation.test.ts
│       └── tokenizer.test.ts
├── renderer/
│   ├── hooks/                 # Hook tests
│   │   ├── navigationUtils.test.ts
│   │   ├── useAutoScrollBottom.test.ts
│   │   ├── useSearchContextNavigation.test.ts
│   │   └── useVisibleAIGroup.test.ts
│   ├── store/                 # Zustand store slice tests
│   │   ├── notificationSlice.test.ts
│   │   ├── paneSlice.test.ts
│   │   ├── pathResolution.test.ts
│   │   ├── sessionSlice.test.ts
│   │   ├── tabSlice.test.ts
│   │   └── tabUISlice.test.ts
│   └── utils/                 # Renderer utilities
│       ├── claudeMdTracker.test.ts
│       ├── dateGrouping.test.ts
│       ├── formatters.test.ts
│       └── pathUtils.test.ts
├── shared/
│   └── utils/                 # Shared utilities
│       ├── markdownSearchRendererAlignment.test.ts
│       ├── markdownTextSearch.test.ts
│       ├── modelParser.test.ts
│       └── tokenFormatting.test.ts
├── mocks/                     # Test fixtures and mocks
│   └── electronAPI.ts         # Mock window.electronAPI
└── setup.ts                   # Global test setup
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from 'vitest';

import { ChunkBuilder } from '../../../../src/main/services/analysis/ChunkBuilder';
import { isAIChunk, isUserChunk } from '../../../../src/main/types';

describe('ChunkBuilder', () => {
  const builder = new ChunkBuilder();

  describe('buildChunks', () => {
    it('should return empty array for empty input', () => {
      const chunks = builder.buildChunks([]);
      expect(chunks).toEqual([]);
    });

    it('should filter out sidechain messages', () => {
      const messages = [
        createMessage({ type: 'user', isSidechain: false }),
        createMessage({ type: 'assistant', isSidechain: true }),
      ];

      const chunks = builder.buildChunks(messages);
      expect(chunks).toHaveLength(1);
      expect(isUserChunk(chunks[0])).toBe(true);
    });
  });

  describe('UserChunk creation', () => {
    // Nested describe for logical grouping
  });
});
```

**Patterns:**
- Top-level `describe` per class/module
- Nested `describe` per method/function
- Descriptive `it` statements ("should do X when Y")
- Arrange-Act-Assert pattern

## Fixtures and Factories

**Test Data:**
Helper functions to create test objects:

```typescript
/**
 * Creates a minimal ParsedMessage for testing.
 */
function createMessage(overrides: Partial<ParsedMessage>): ParsedMessage {
  return {
    uuid: `msg-${Math.random().toString(36).slice(2, 11)}`,
    parentUuid: null,
    type: 'user',
    timestamp: new Date(),
    content: '',
    isSidechain: false,
    isMeta: false,
    toolCalls: [],
    toolResults: [],
    ...overrides,
  };
}

/**
 * Creates a minimal Process (subagent) for testing.
 */
function createSubagent(overrides: Partial<Process>): Process {
  return {
    id: `agent-${Math.random().toString(36).slice(2, 11)}`,
    filePath: '/path/to/agent.jsonl',
    parentTaskId: 'task-1',
    description: 'Test subagent',
    startTime: new Date(),
    endTime: new Date(),
    durationMs: 1000,
    isOngoing: false,
    messages: [],
    metrics: {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 150,
      messageCount: 2,
      durationMs: 1000,
    },
    ...overrides,
  };
}
```

**Location:**
Defined in test files (not centralized) for visibility and simplicity.

## Mocking

**Framework:** Vitest built-in mocking (`vi.fn()`, `vi.mock()`, `vi.spyOn()`)

**ElectronAPI Mock Pattern:**
```typescript
// test/mocks/electronAPI.ts
export interface MockElectronAPI {
  getProjects: ReturnType<typeof vi.fn>;
  getSessions: ReturnType<typeof vi.fn>;
  getSessionsPaginated: ReturnType<typeof vi.fn>;
  // ... all IPC methods
}

export function installMockElectronAPI(): MockElectronAPI {
  const mock: MockElectronAPI = {
    getProjects: vi.fn(),
    getSessions: vi.fn(),
    // ...
  };

  vi.stubGlobal('window', {
    electronAPI: mock,
  });

  return mock;
}

// Usage in tests:
import { installMockElectronAPI, type MockElectronAPI } from '../../mocks/electronAPI';

describe('sessionSlice', () => {
  let mockAPI: MockElectronAPI;

  beforeEach(() => {
    mockAPI = installMockElectronAPI();
  });

  it('should fetch sessions', async () => {
    mockAPI.getSessions.mockResolvedValue([/* data */]);
    // Test implementation
  });
});
```

**Console Mocking:**
Automatic via `test/setup.ts` - all tests fail if unexpected console.error/warn occurs:
```typescript
// test/setup.ts
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  const unexpectedErrors = errorSpy.mock.calls.map(formatConsoleCall);
  const unexpectedWarnings = warnSpy.mock.calls.map(formatConsoleCall);

  errorSpy.mockRestore();
  warnSpy.mockRestore();

  expect(unexpectedErrors, `Unexpected console.error calls:\n${unexpectedErrors.join('\n')}`).toEqual([]);
  expect(unexpectedWarnings, `Unexpected console.warn calls:\n${unexpectedWarnings.join('\n')}`).toEqual([]);
});
```

**What to Mock:**
- `window.electronAPI` - Always mock in renderer tests
- File system operations - Mock when testing logic, not I/O
- External dependencies - Mock when testing integration points

**What NOT to Mock:**
- Internal utilities (test them directly)
- Type guards (pure functions)
- Formatters and transformers (integration is valuable)

## Coverage

**Requirements:** No enforced minimum (quality over coverage)

**Provider:** v8 (native V8 coverage)

**Reporters:**
- `text` - Terminal output
- `json` - Machine-readable
- `html` - Interactive browser report

**View Coverage:**
```bash
pnpm test:coverage          # Full coverage
pnpm test:coverage:critical # Critical paths only
```

**Includes:**
- `src/**/*.ts`
- `src/**/*.tsx`

**Excludes:**
- `src/**/*.d.ts` (type definitions)
- `src/main/index.ts` (entry point)
- `src/preload/index.ts` (entry point)

**Critical Path Config:**
Separate config at `/Users/bskim/claude-devtools/vitest.critical.config.ts` focuses on:
- Chunk building (`ChunkBuilder.test.ts`)
- Message classification (`MessageClassifier.test.ts`)
- Session parsing (`SessionParser.test.ts`)

## Test Types

**Unit Tests:**
Test individual functions, classes, and utilities in isolation.

**Example:**
```typescript
describe('pathDecoder', () => {
  describe('encodePath', () => {
    it('should encode absolute POSIX paths', () => {
      expect(encodePath('/Users/username/project')).toBe('-Users-username-project');
    });

    it('should encode Windows paths', () => {
      expect(encodePath('C:\\Users\\username\\project')).toBe('-C:-Users-username-project');
    });
  });
});
```

**Integration Tests:**
Test interactions between modules (e.g., ChunkBuilder + MessageClassifier).

**Example:**
```typescript
it('should link subagents to AIChunks', () => {
  const messages = [
    createMessage({ type: 'assistant', toolCalls: [{ isTask: true, id: 'task-1' }] }),
  ];
  const subagents = [
    createSubagent({ parentTaskId: 'task-1' }),
  ];

  const chunks = builder.buildChunks(messages, subagents);
  const aiChunk = chunks.find(isAIChunk);

  expect(aiChunk?.subagents).toHaveLength(1);
});
```

**Store Tests:**
Test Zustand slice behavior (state updates, async actions).

**Example:**
```typescript
describe('sessionSlice', () => {
  it('should update sessions on fetch', async () => {
    mockAPI.getSessions.mockResolvedValue([
      { id: 'session-1', createdAt: '2024-01-15T10:00:00Z' },
    ]);

    await store.getState().fetchSessions('project-1');

    expect(store.getState().sessions).toHaveLength(1);
    expect(store.getState().sessionsLoading).toBe(false);
  });
});
```

**E2E Tests:**
Not currently implemented.

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operations', async () => {
  mockAPI.getSessions.mockResolvedValue([/* data */]);

  await store.getState().fetchSessions('project-1');

  expect(store.getState().sessions).toHaveLength(1);
});
```

**Error Testing:**
```typescript
it('should handle fetch error', async () => {
  mockAPI.getSessions.mockRejectedValue(new Error('Network error'));

  await store.getState().fetchSessions('project-1');

  expect(store.getState().sessionsError).toBe('Network error');
  expect(store.getState().sessionsLoading).toBe(false);
});
```

**Timing/Debounce Testing:**
```typescript
it('should debounce rapid calls', async () => {
  vi.useFakeTimers();

  const callback = vi.fn();
  const debounced = debounce(callback, 100);

  debounced();
  debounced();
  debounced();

  vi.advanceTimersByTime(100);

  expect(callback).toHaveBeenCalledTimes(1);

  vi.useRealTimers();
});
```

**State Transitions:**
```typescript
it('should set loading state during fetch', async () => {
  mockAPI.getSessions.mockImplementation(
    () => new Promise(resolve => setTimeout(() => resolve([]), 100))
  );

  const fetchPromise = store.getState().fetchSessions('project-1');
  expect(store.getState().sessionsLoading).toBe(true);

  await fetchPromise;
  expect(store.getState().sessionsLoading).toBe(false);
});
```

## Test-Specific ESLint Relaxations

Tests use relaxed TypeScript rules (from `eslint.config.js`):

```typescript
// Relaxed for tests
'@typescript-eslint/no-explicit-any': 'off',
'@typescript-eslint/no-non-null-assertion': 'off',
'@typescript-eslint/no-unsafe-assignment': 'off',
'@typescript-eslint/no-unsafe-member-access': 'off',
'@typescript-eslint/no-unsafe-call': 'off',
'@typescript-eslint/no-unsafe-argument': 'off',
'@typescript-eslint/no-unsafe-return': 'off',
'@typescript-eslint/unbound-method': 'off',
'@typescript-eslint/no-floating-promises': 'off',
```

**Rationale:** Test code prioritizes readability and flexibility over type safety.

## Setup and Teardown

**Global Setup:**
`/Users/bskim/claude-devtools/test/setup.ts` runs before each test file:
- Mocks `process.env.HOME`
- Installs console spies (fail on unexpected errors/warnings)

**Per-Suite Setup:**
```typescript
describe('MyService', () => {
  let mockAPI: MockElectronAPI;
  let store: TestStore;

  beforeEach(() => {
    mockAPI = installMockElectronAPI();
    store = createTestStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
```

## Path Aliases in Tests

Vitest config mirrors TypeScript paths:
```typescript
resolve: {
  alias: {
    '@shared': resolve(__dirname, 'src/shared'),
    '@main': resolve(__dirname, 'src/main'),
    '@renderer': resolve(__dirname, 'src/renderer'),
  },
}
```

Use same aliases as source code:
```typescript
import { ChunkBuilder } from '@main/services';
import { useStore } from '@renderer/store';
import { formatTokens } from '@shared/utils/tokenFormatting';
```

## Best Practices

**Test Independence:**
Each test should run independently - no shared state between tests.

**Descriptive Names:**
```typescript
// Good
it('should return empty array when no messages provided', () => {});

// Bad
it('returns []', () => {});
```

**Single Assertion Focus:**
Prefer multiple small tests over one large test with many assertions.

**Factory Functions:**
Use factory functions for test data creation - more maintainable than inline objects.

**Mock Minimally:**
Only mock external boundaries (IPC, file system) - test real logic.

**Console Discipline:**
If a test legitimately logs errors, it will fail. Either:
1. Fix the code to not log errors
2. Mock the specific logger call
3. Adjust test expectations

---

*Testing analysis: 2026-02-12*
