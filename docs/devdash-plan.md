# DevDash: Mattermost Development Dashboard TUI

## Context

There's no unified entry point for Mattermost development. Developers juggle 5+ internal Makefiles (server, webapp, e2e-tests, api, templates) and 8+ sibling plugin repos, each with their own make targets and npm scripts. Running `make` from the repo root currently does nothing (no root Makefile exists).

This plan creates a root-level `Makefile` whose default target launches a Charmbracelet-powered TUI dashboard that:
- Auto-discovers all internal sub-projects and sibling `mattermost-plugin-*` repos
- Displays repos as rows with their make targets/npm scripts as clickable chips
- Runs commands with streaming log output, search/filtering, and log level controls
- Supports configurable hotkeys for primary dev flows
- Supports mouse interaction (click targets to run them)

## Tech Stack

- **Go** standalone module at `tools/devdash/` (same pattern as `tools/mmgotool/`)
- **Charmbracelet ecosystem**:
  - `bubbletea` — TUI framework (elm architecture)
  - `bubbles` — viewport (log scrolling), textinput (search), key bindings
  - `lipgloss` — styling, layout, borders, colors
  - `huh` — config/settings forms (hotkey editor, log level selector)
  - `log` (charmbracelet/log) — structured internal logging
- **Mouse support** via `tea.WithMouseCellMotion()`

## Layout

### Grid View (default)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DevDash v0.1  │ ● 2 running  ○ 0 failed │ Last scan: just now  │ F1  │
├─────────────────────────────────────────────────────────────────────────┤
│ ▸ server     [run-server] [run-client] [test] [check-style] [build] ▸  │
│   webapp     [run] [dev] [test] [check-style] [check-types] [dist]     │
│   e2e-tests  [run] [run-test] [clean]                                   │
│   api        [build] [run] [clean]                                      │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│   playbooks  [all] [deploy] [test] [check-style] [server] [webapp]     │
│   calls      [all] [deploy] [test] [check-style] [server] [webapp]     │
│   ...                                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ F5:RunSrv  F6:RunCli  F7:Test  F8:Lint  F9:Deploy   /:Search  q:Quit  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Split View (log panel open)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DevDash v0.1  │ ● 2 running  ○ 0 failed │                       │ F1  │
├─────────────────────────────────────────────────────────────────────────┤
│ ▸ server     [run-server●] [test] [check-style]                       │
│   webapp     [run●] [dev] [test]                                       │
╞═════════════════════════════════════════════════════════════════════════╡
│ LOG: server:run-server (running 2m31s)             [/] Search  ▾ auto  │
│─────────────────────────────────────────────────────────────────────────│
│ [10:31:02] [INFO]  Server is listening on :8065                        │
│ [10:31:03] [DEBUG] Websocket connection established                    │
│ [10:31:04] [WARN]  Plugin health check failed                          │
│                                                          ▼ auto-scroll │
├─────────────────────────────────────────────────────────────────────────┤
│ 1:ERR  2:WARN  3:INFO  4:ALL  s:Stop  R:Restart  Tab:Focus  Esc:Close │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Bindings

| Key | Action |
|---|---|
| `j/k` `↑/↓` | Move between repo rows |
| `h/l` `←/→` | Move between targets |
| `Enter` / Click | Execute target (or view log if running) |
| `L` | Toggle log panel |
| `Tab` | Cycle focus: grid ↔ log |
| `/` | Search logs |
| `1/2/3/4` | Log filter: ERR/WARN/INFO/ALL |
| `s` | Stop process |
| `R` | Restart process |
| `Ctrl+X` | Stop all |
| `Ctrl+R` | Re-scan repos |
| `?` / `F1` | Help |
| `q` | Quit |
| `F5-F9` | Configurable hotkeys |
