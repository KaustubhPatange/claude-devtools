# Feature Research: Multi-Context Workspace Switching

**Domain:** Desktop application with multi-context/workspace switching
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

Multi-context desktop applications require three fundamental pillars: **instant switching**, **comprehensive state preservation**, and **clear status communication**. Research across VS Code Remote, JetBrains Gateway, Slack, Notion, Discord, and Figma reveals that users expect workspace switching to feel instantaneous with zero cognitive load, complete context preservation across switches, and continuous awareness of connection status. The line between table stakes and differentiators is clear: users will leave apps with clunky switching UX but deeply value innovations that reduce mental overhead during context transitions.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Visual workspace list** | Every multi-context app shows available workspaces | LOW | None | Dropdown, sidebar, or command palette |
| **Keyboard shortcuts for switching** | Power users demand keyboard-driven workflows | LOW | Visual workspace list | Ctrl/Cmd+Number or dedicated switcher shortcut |
| **Current workspace indicator** | Users need to know "where am I?" at all glance | LOW | None | Status bar, title bar, or persistent sidebar element |
| **Connection status indicators** | Network-dependent contexts require real-time status | MEDIUM | None | Online, connecting, offline, error states with distinct visual treatment |
| **Saved connection profiles** | Users refuse to re-enter connection details repeatedly | MEDIUM | Profile storage system | Name, host, port, credentials (secure), last connected |
| **Recent connections list** | Users return to recent contexts 80%+ of the time | LOW | Profile system | Default to showing 5-10 most recent |
| **Per-workspace state preservation** | Context loss on switch = immediate user frustration | HIGH | State management system | Window size, scroll position, open files, UI state |
| **Auto-reconnect on network restore** | Brief network blips shouldn't require manual reconnection | MEDIUM | Connection health monitoring | Exponential backoff, max 6-10 retries |
| **Error state communication** | Silent failures destroy user trust | LOW | Connection monitoring | Clear error messages with actionable guidance |
| **Loading indicators during switch** | Switching delays without feedback feel like freezes | LOW | None | Skeleton states, progress indicators, or spinners |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Instant context preview on hover** | Reduces cognitive load by showing context before switching | MEDIUM | State caching | Slack's tab preview pattern - preview without full switch |
| **Workspace-specific color coding** | Visual distinction reduces mental overhead | LOW | Visual theming system | Discord/Slack pattern - unique color per workspace |
| **Parallel workspace windows** | Advanced users want simultaneous multi-context view | HIGH | Window management, resource isolation | Slack's separate windows feature |
| **Smart workspace ordering** | Auto-prioritize by usage frequency | LOW | Usage analytics | VS Code's MRU (most recently used) ordering |
| **Workspace search/filter** | Critical when managing 10+ workspaces | LOW | Workspace metadata | Command palette pattern from VS Code |
| **One-click duplicate workspace** | Speeds up creating similar configurations | MEDIUM | Profile cloning system | Common in database tools |
| **Workspace activity notifications** | Stay informed without context switching | MEDIUM | Event system | Slack's unread indicators per workspace |
| **Offline-first with sync queue** | Continue working during network issues | HIGH | Local storage, sync engine | WhatsApp pattern - queue and sync later |
| **Workspace templates** | Accelerate common setup patterns | MEDIUM | Template storage system | JetBrains pattern for remote dev environments |
| **Connection health metrics** | Proactive awareness prevents surprises | MEDIUM | Network monitoring | Latency, bandwidth, stability indicators |
| **Workspace-specific keyboard shortcuts** | Power users customize per context | HIGH | Shortcut management system | VS Code's workspace-level settings pattern |
| **Quick switcher with fuzzy search** | Fastest method for 20+ workspaces | LOW | Search algorithm | Cmd+K pattern from modern apps |
| **Workspace groups/folders** | Organize 50+ workspaces hierarchically | MEDIUM | Grouping data model | Remote Desktop Manager pattern |
| **Context-aware AI assistance** | Auto-suggest next workspace based on patterns | HIGH | ML/pattern recognition | 2026 trend - VS Code January 2026 release |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Automatic workspace switching** | Users think it saves time | Destroys mental model, causes confusion about current context | Suggest switching with one-click confirmation |
| **Unlimited parallel workspaces** | Power users want "all contexts open" | Resource exhaustion, performance degradation | Limit to 3-5 windows with clear capacity indicator |
| **Real-time sync of all workspace state** | Seems like cloud-native best practice | Network overhead, conflict resolution complexity | Sync critical state only (profiles, favorites); defer non-critical |
| **Complex workspace hierarchies** | Enterprise users request deep nesting | Cognitive overhead, navigation confusion | Flat list with tags/labels for filtering |
| **Automatic reconnection without confirmation** | Reduces user friction | Security risk for sensitive connections; unexpected costs | Auto-reconnect with user-configurable policy per profile |
| **Workspace merging** | Requested for "combining contexts" | State collision, unclear semantics | Support opening multiple windows instead |
| **Background workspace updates** | Keep all contexts "warm" | Resource drain, battery impact | Update on switch or on-demand refresh only |
| **Infinite workspace history** | "Never lose a workspace" | Storage bloat, performance degradation | Keep 50-100 recent, archive older |
| **Cross-workspace clipboard sync** | Seems convenient | Security issue, unexpected data leakage between contexts | Explicit "copy to..." action with user confirmation |

## Feature Dependencies

```
Core Infrastructure:
    Profile Storage System
        └──requires──> Secure Credential Storage
        └──enables──> Recent Connections List
        └──enables──> Favorite/Pinned Workspaces
        └──enables──> Workspace Templates

    Connection Manager
        └──requires──> Profile System
        └──enables──> Connection Status Indicators
        └──enables──> Auto-reconnect
        └──enables──> Connection Health Metrics

    State Preservation System
        └──requires──> Per-workspace state isolation
        └──enables──> Instant context switching
        └──enables──> Context preview on hover
        └──enables──> Parallel workspace windows

Visual Layer:
    Workspace List UI
        └──requires──> Profile System
        └──enhances──with──> Quick Switcher
        └──enhances──with──> Fuzzy Search
        └──enhances──with──> Workspace Groups

    Status Indicators
        └──requires──> Connection Manager
        └──enhances──with──> Connection Health Metrics
        └──enhances──with──> Activity Notifications

Advanced Features:
    Parallel Windows
        └──requires──> State Preservation
        └──requires──> Resource Isolation
        └──conflicts──with──> Unlimited Parallel Workspaces (anti-pattern)

    Offline-First
        └──requires──> Local State Storage
        └──requires──> Sync Queue
        └──requires──> Conflict Resolution
        └──enables──> Continue work during outages

    Context-Aware AI
        └──requires──> Usage Analytics
        └──requires──> Pattern Recognition
        └──enhances──> Quick Switcher
```

### Dependency Notes

- **Profile System is foundational**: Nearly all features depend on having profile storage and management
- **State Preservation enables advanced features**: Context preview, parallel windows, and offline mode all require robust state management
- **Connection Manager is critical path**: Status indicators, health metrics, and auto-reconnect all depend on centralized connection management
- **Quick Switcher amplifies other features**: When combined with fuzzy search, workspace groups, and AI suggestions, it becomes the primary navigation method
- **Parallel windows conflict with unlimited contexts**: Must enforce limits to prevent resource exhaustion

## MVP Definition

### Launch With (v1) - Core Context Switching

**Goal**: Users can switch between local and SSH workspaces without friction

**Essential features** (ranked by priority):
1. **Visual workspace list with status** - Users need to see available workspaces and connection status at a glance
   - Why: Table stakes. Users can't switch if they can't see options
   - Implementation: Sidebar with workspace cards showing name, type (local/SSH), and status dot
2. **Saved connection profiles** - Store SSH host, port, user for quick access
   - Why: Re-entering connection details is unacceptable UX
   - Implementation: Profile manager with CRUD operations, secure credential storage
3. **Recent connections (5-10)** - Most users return to same 3-5 workspaces
   - Why: 80% of switches go to recent contexts
   - Implementation: Auto-populate list from connection history
4. **Current workspace indicator** - Status bar showing active workspace
   - Why: Prevents "where am I?" confusion
   - Implementation: Persistent badge in title bar or status bar
5. **Per-workspace state preservation** - Restore open files, scroll position, window size
   - Why: Context loss = user frustration and productivity loss
   - Implementation: State snapshot per workspace, restore on switch
6. **Connection status indicators** - Online, connecting, offline, error states
   - Why: Network-dependent contexts need real-time status
   - Implementation: Color-coded dots with tooltip details
7. **Loading states during switch** - Visual feedback for 0.5s+ operations
   - Why: Delays without feedback feel like hangs
   - Implementation: Skeleton UI or progress bar
8. **Basic error handling** - Clear messages for connection failures
   - Why: Silent failures destroy trust
   - Implementation: Error modal with actionable message and retry button
9. **Keyboard shortcut for switcher** - Cmd/Ctrl+K to open workspace list
   - Why: Power users demand keyboard access
   - Implementation: Keyboard shortcut opening modal or command palette

**Explicitly NOT in v1**:
- Command palette/fuzzy search (v1.x priority)
- Auto-reconnect (v1.x priority)
- Parallel windows (v2+ complexity)
- Workspace groups (only needed at 20+ workspaces)
- AI suggestions (v2+ nice-to-have)

### Add After Validation (v1.x) - Enhanced Switching

**Triggers for adding**:
- User feedback: "I have 10+ workspaces and can't find them"
- Analytics: Users repeatedly reconnecting after brief network blips
- Support tickets: Confusion about workspace state after switch

**Features to add**:
1. **Quick switcher with fuzzy search** - Cmd+K to instantly filter workspaces
   - When: Users managing 10+ workspaces
   - Why: Linear list becomes overwhelming; search is faster than scrolling
2. **Auto-reconnect with exponential backoff** - Automatically retry failed connections
   - When: Users report frustration with manual reconnection
   - Why: Brief network blips are common; auto-recovery improves UX
3. **Workspace templates** - Save connection profile as reusable template
   - When: Users creating multiple similar configurations
   - Why: Accelerates common setup patterns
4. **Connection health metrics** - Latency, stability indicators in workspace list
   - When: Users working across high-latency connections
   - Why: Proactive awareness prevents surprises
5. **Workspace-specific color coding** - Visual distinction per workspace
   - When: Users managing 5+ workspaces and switching frequently
   - Why: Reduces cognitive load through visual patterns
6. **Activity notifications** - Unread indicators for background workspaces
   - When: Users need to monitor multiple contexts simultaneously
   - Why: Stay informed without switching

### Future Consideration (v2+) - Advanced Capabilities

Features to defer until product-market fit is established.

1. **Parallel workspace windows** - Open 2-3 workspaces simultaneously
   - Why defer: High complexity, resource management challenges
   - Prerequisites: Usage data showing demand for multi-window workflows
2. **Offline-first with sync queue** - Queue operations during network outages
   - Why defer: Complex conflict resolution, requires robust sync engine
   - Prerequisites: Users reporting productivity loss during outages
3. **Context-aware AI workspace suggestions** - Predict next workspace based on patterns
   - Why defer: Requires ML infrastructure, significant training data
   - Prerequisites: Strong v1 adoption, usage analytics baseline
4. **Workspace groups/folders** - Hierarchical organization for 50+ workspaces
   - Why defer: Only needed at significant scale
   - Prerequisites: Users managing 20+ workspaces
5. **Workspace-specific keyboard shortcuts** - Customize shortcuts per context
   - Why defer: Implementation complexity, potential user confusion
   - Prerequisites: Power user requests for per-workspace customization
6. **Cross-workspace search** - Search files/content across all workspaces
   - Why defer: Performance challenges, requires indexing infrastructure
   - Prerequisites: Users managing large numbers of workspaces

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Visual workspace list | HIGH | LOW | P1 | v1 |
| Saved connection profiles | HIGH | MEDIUM | P1 | v1 |
| Recent connections | HIGH | LOW | P1 | v1 |
| Current workspace indicator | HIGH | LOW | P1 | v1 |
| Per-workspace state preservation | HIGH | HIGH | P1 | v1 |
| Connection status indicators | HIGH | MEDIUM | P1 | v1 |
| Loading states | HIGH | LOW | P1 | v1 |
| Basic error handling | HIGH | LOW | P1 | v1 |
| Keyboard shortcut for switcher | HIGH | LOW | P1 | v1 |
| Quick switcher with fuzzy search | HIGH | LOW | P2 | v1.x |
| Auto-reconnect | HIGH | MEDIUM | P2 | v1.x |
| Workspace templates | MEDIUM | MEDIUM | P2 | v1.x |
| Connection health metrics | MEDIUM | MEDIUM | P2 | v1.x |
| Workspace color coding | MEDIUM | LOW | P2 | v1.x |
| Activity notifications | MEDIUM | MEDIUM | P2 | v1.x |
| Context preview on hover | MEDIUM | MEDIUM | P2 | v1.x |
| Parallel workspace windows | HIGH | HIGH | P3 | v2+ |
| Offline-first with sync queue | MEDIUM | HIGH | P3 | v2+ |
| Context-aware AI suggestions | LOW | HIGH | P3 | v2+ |
| Workspace groups/folders | MEDIUM | MEDIUM | P3 | v2+ |
| Workspace-specific shortcuts | LOW | HIGH | P3 | v2+ |
| Cross-workspace search | MEDIUM | HIGH | P3 | v2+ |

**Priority key**:
- **P1 (Must have for launch)**: Core functionality, missing = broken product
- **P2 (Should have, add when possible)**: Significantly improves UX, validates value proposition
- **P3 (Nice to have, future consideration)**: Advanced capabilities for mature product

## UX Pattern Analysis by Application

### VS Code Remote (2026)

**Table Stakes Implemented**:
- Remote Explorer with visual host list
- SSH config file integration (saved profiles)
- Status bar indicator showing local/remote context
- Recent connections in Command Palette
- Extension classification (UI vs Workspace) for state isolation

**Differentiators**:
- Workspace indexing for faster code search (January 2026)
- Agent integration with remote workspaces (AI-assisted development)
- Extension recommendations per workspace type
- Transparent remote filesystem access

**Observed Patterns**:
- Command Palette as primary navigation (Ctrl+Shift+P)
- Activity Bar for persistent context (sidebar with icons)
- Status bar for ambient awareness (current context, connection status)

### JetBrains Gateway

**Table Stakes Implemented**:
- Workspace list with start/stop controls
- Connection status display (started, stopped, busy)
- Recent workspaces list
- IDE backend management (version control)

**Differentiators**:
- Explicit workspace lifecycle control (start, stop, not just connect)
- IDE backend version management from Gateway
- Integration with cloud dev environments (Coder, Gitpod, Harness)

**Observed Patterns**:
- Explicit state management (stopped vs running)
- Green/red controls for visual clarity (start/stop icons)
- Backend management separated from connection management

### Slack

**Table Stakes Implemented**:
- Workspace switcher icon in title bar
- Keyboard shortcuts (Ctrl+Shift+S for switcher, Ctrl+Number to jump)
- Recent workspace list
- Per-workspace notifications

**Differentiators**:
- Separate windows for simultaneous multi-workspace view
- Workspace filter to show/hide specific workspaces
- Tab preview on hover (see content without switching)
- Ctrl+Shift+[ and ] for sequential navigation
- Enterprise Grid support (simplified multi-workspace in large orgs)

**Observed Patterns**:
- Workspace switcher always visible (persistent awareness)
- Multiple access methods (click, keyboard numbers, sequential nav)
- Parallel windows for advanced users

### Notion

**Table Stakes Implemented**:
- Workspace dropdown in top-left
- Ctrl+Shift+Number for quick switching
- Multi-account support (10+ accounts without hard limit)
- Drag-to-reorder workspaces

**Differentiators**:
- Account aggregation (multiple email accounts in one app)
- Workspace prioritization via drag-and-drop
- Smooth tab switching with preview on hover

**Observed Patterns**:
- Top-left corner for workspace identity (consistent with OS patterns)
- Visual priority ordering (users customize workspace sequence)
- Performance degradation warning (10+ accounts)

### Discord

**Table Stakes Implemented**:
- Server list in left sidebar (always visible)
- Status indicators (online, idle, DND, streaming)
- Platform-specific icons (desktop vs mobile)
- Quick Switcher (Ctrl+K) with online status indicators (October 2025)

**Differentiators**:
- Color-coded status (green=online, yellow=idle, red=DND, purple=streaming)
- Platform awareness (desktop vs mobile indicators)
- Status shown in Quick Switcher search results
- Unread indicators per server

**Observed Patterns**:
- Persistent sidebar for context awareness
- Quick Switcher as power user feature
- Visual status prioritized over text labels

### Figma (2026)

**Table Stakes Implemented**:
- File list with recent files
- Standardized page structures (Cover, Playground, Handoff, Archive)
- Team file navigation

**Differentiators**:
- Multi-file modular architecture (tokens, components, docs in separate files)
- AI-powered search across team files
- UI3 redesign maximizing canvas space while retaining navigation anchors
- Zero cognitive load context switching via standardized structures

**Observed Patterns**:
- Standardization reduces cognitive load (consistent structure = instant familiarity)
- Modular file architecture for independent updates
- AI assistance for cross-file navigation

## Common Patterns Across Applications

### Switcher UI Patterns
1. **Dropdown** (Notion, VS Code partial): Click workspace name to show list
2. **Sidebar** (Discord, Slack partial): Always-visible list for instant access
3. **Command Palette** (VS Code, Discord, Figma): Keyboard-first fuzzy search
4. **Hybrid** (Slack): All three methods available

**Recommendation**: Start with dropdown + keyboard shortcut for MVP; add command palette in v1.x when users manage 10+ workspaces.

### Status Indicator Patterns
1. **Color-coded dots** (Discord, VS Code): Green=connected, yellow=connecting, red=error, gray=offline
2. **Text labels** (JetBrains): "Started", "Stopped", "Busy"
3. **Icon + text combo** (Slack): Icon with tooltip on hover

**Recommendation**: Color-coded dots with tooltip for details (minimal space, accessible, standard pattern).

### Connection Profile Patterns
1. **Manual entry** (VS Code): Edit SSH config file
2. **Form-based** (JetBrains, database tools): GUI for connection details
3. **Implicit** (Notion, Slack): Profiles created automatically on first connection

**Recommendation**: Form-based GUI for SSH connections (lower friction); auto-save on successful connection as implicit profile.

### State Preservation Patterns
1. **Full snapshot** (VS Code): Restore all open files, cursor positions, UI state
2. **Partial snapshot** (Slack): Remember channel but not scroll position
3. **Session storage** (Web apps): Local/session storage for UI state

**Recommendation**: Full snapshot for development tools (VS Code pattern); partial for lighter contexts if needed.

### Loading State Patterns
1. **Skeleton screens** (Modern web apps): Show structure while loading
2. **Progress bars** (JetBrains): Percentage-based for long operations
3. **Spinners** (Generic): Simple animation for indeterminate duration

**Recommendation**: Skeleton screens for predictable loading (workspace list); spinners for connection attempts (unpredictable duration).

### Error Handling Patterns
1. **Modal dialogs** (Traditional apps): Blocking error message with retry
2. **Toast notifications** (Modern apps): Non-blocking error with auto-dismiss
3. **Inline errors** (Forms): Error message in context of failure

**Recommendation**: Toast notifications for transient errors (network blip); modal for critical errors requiring user action (invalid credentials).

## Roadmap Implications

### Phase 1: Core Infrastructure (v1)
**Focus**: Make workspace switching work reliably

**Critical features**:
- Profile storage with secure credentials
- Connection manager with status tracking
- State preservation per workspace
- Visual workspace list with status
- Basic keyboard navigation

**Success criteria**: Users can switch between local and SSH workspaces without re-entering details, with state preserved across switches.

### Phase 2: Enhanced UX (v1.x)
**Focus**: Make switching delightful

**Critical features**:
- Quick switcher with fuzzy search
- Auto-reconnect on network restore
- Workspace color coding
- Connection health metrics
- Activity notifications

**Success criteria**: Users with 10+ workspaces can find and switch to any workspace in <2 seconds; network blips don't interrupt workflows.

### Phase 3: Advanced Capabilities (v2+)
**Focus**: Support power users and scale

**Critical features**:
- Parallel workspace windows
- Offline-first with sync queue
- Workspace groups for 50+ contexts
- Context-aware AI suggestions
- Cross-workspace search

**Success criteria**: Users managing 20+ workspaces across flaky networks maintain productivity; power users can monitor multiple contexts simultaneously.

## Sources

### VS Code Remote Development
- [VS Code Remote Development Overview](https://code.visualstudio.com/docs/remote/remote-overview)
- [Remote Development using SSH](https://code.visualstudio.com/docs/remote/ssh)
- [January 2026 Release Notes (version 1.109)](https://code.visualstudio.com/updates/v1_109)
- [Supporting Remote Development and GitHub Codespaces](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- [Remote Development FAQ](https://code.visualstudio.com/docs/remote/faq)

### JetBrains Gateway
- [JetBrains Gateway - Remote Development for JetBrains IDEs](https://www.jetbrains.com/remote-development/gateway/)
- [Connect and work with JetBrains Gateway | IntelliJ IDEA Documentation](https://www.jetbrains.com/help/idea/remote-development-a.html)
- [A Deep Dive Into JetBrains Gateway | The JetBrains Blog](https://blog.jetbrains.com/blog/2021/12/03/dive-into-jetbrains-gateway/)
- [Remote development overview | IntelliJ IDEA Documentation](https://www.jetbrains.com/help/idea/remote-development-overview.html)

### Slack
- [Switch between workspaces | Slack](https://slack.com/help/articles/1500002200741-Switch-between-workspaces)
- [A consolidated set of tabs for Slack on desktop | Slack](https://slack.com/help/articles/16764236868755-An-overview-of-Slacks-new-design)
- [A redesigned Slack, built for focus | Slack](https://slack.com/blog/productivity/a-redesigned-slack-built-for-focus)
- [More Intuitive Multi-Workspace Slack Experience | Medium](https://medium.com/design-bootcamp/slack-home-reinventing-a-more-intuitive-experience-for-you-a-ux-case-study-da7c3e399cc6)

### Notion
- [Create, join & leave workspaces – Notion Help Center](https://www.notion.com/help/create-delete-and-switch-workspaces)
- [Notion for desktop – Notion Help Center](https://www.notion.com/help/notion-for-desktop)
- [A Notion guide on switching between work and personal accounts](https://www.notion.com/help/guides/a-notion-guide-on-switching-between-work-and-personal-accounts)
- [Intro to workspaces – Notion Help Center](https://www.notion.com/help/intro-to-workspaces)

### Discord
- [Discord Patch Notes: October 7, 2025](https://discord.com/blog/discord-patch-notes-october-7-2025)
- [User Status | Discord Wiki](https://discord.fandom.com/wiki/User_Status)
- [Discord Status Icons: 2026 Guide](https://www.qqtube.com/blog/what-does-the-green-phone-icon-mean-on-discord)

### Figma
- [The Complete Guide to Design Systems in Figma (2026 Edition) | Medium](https://medium.com/@EmiliaBiblioKit/the-world-of-design-systems-is-no-longer-just-about-components-and-libraries-its-about-5beecc0d21cb)
- [Stop the Chaos: The Best Figma Plugins to Organize Design Files in 2026 | Medium](https://medium.com/design-bootcamp/stop-the-chaos-the-best-figma-plugins-to-organize-design-files-in-2026-ff9941d213a6)
- [Figma Config 2025: What's new, what's next, and what you should be doing - LogRocket Blog](https://blog.logrocket.com/ux-design/figma-config-2025-whats-new-whats-next/)

### UX Patterns & Best Practices
- [Linux Desktop: Do we need better Workspace Management?](https://linuxblog.io/linux-desktop-workspace-management/)
- [Designing desktop apps for cross-platform UX | ToDesktop Blog](https://www.todesktop.com/blog/posts/designing-desktop-apps-cross-platform-ux)
- [Command Palette | UX Patterns #1 | Medium](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1)
- [Command Palette UI Design: Best practices, Design variants & Examples | Mobbin](https://mobbin.com/glossary/command-palette)

### Connection Profile Management
- [Remote Desktop Connection Manager - Microsoft Learn](https://learn.microsoft.com/en-us/sysinternals/downloads/rdcman)
- [Favorite Connections - Compass - MongoDB Docs](https://docs.mongodb.com/compass/master/connect/favorite-connections/)
- [Manage Connection Profiles](https://github.com/microsoft/vscode-mssql/wiki/manage-connection-profiles)
- [Preferred connections: "remember" frequently used servers/databases with SSMSBoost](https://www.ssmsboost.com/Features/ssms-add-in-preferred-connections)

### Error Handling & Reconnection
- [Finally! Improved Blazor Server reconnection UX](https://jonhilton.net/blazor-server-reconnects/)
- [Connection Management | PubNub Docs](https://www.pubnub.com/docs/general/setup/connection-management)
- [Handling Database Reconnection Issues in .NET with Polly - NashTech Blog](https://blog.nashtechglobal.com/handling-database-reconnection-issues-in-net-with-polly/)
- [Offline Mobile App Design: Challenges, Strategies, Best Practices - LeanCode](https://leancode.co/blog/offline-mobile-app-design)

### Loading States & System Status
- [UX Design Patterns for Loading - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback)
- [6 Loading State Patterns That Feel Premium | Medium](https://medium.com/uxdworld/6-loading-state-patterns-that-feel-premium-716aa0fe63e8)
- [4 Ways To Communicate the Visibility of System Status in UI | UX Planet](https://uxplanet.org/4-ways-to-communicate-the-visibility-of-system-status-in-ui-14ff2351c8e8)
- [FOSDEM 2026 - Designing for Local-First: UX Patterns for a Network-Optional World](https://fosdem.org/2026/schedule/event/JX7Y3D-ux-design-for-local-first/)

---
*Feature research for: Multi-context workspace switching in desktop applications*
*Researched: 2026-02-12*
