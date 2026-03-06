# Bookmarks Overflow DnD — Requirements

## Summary
Replace `react-beautiful-dnd` with `@atlaskit/pragmatic-drag-and-drop` for channel bookmarks. Add overflow detection so bookmarks that don't fit in the bar move to an overflow menu. Support drag-and-drop reordering within the bar, within the overflow menu, and across containers. Full keyboard accessibility with live region announcements.

## Jira
- Ticket: [MM-56762](https://mattermost.atlassian.net/browse/MM-56762)
- PR: [#35118](https://github.com/mattermost/mattermost/pull/35118)

## Acceptance Criteria
1. Bookmarks that don't fit in the bar overflow into a dropdown menu
2. Drag-and-drop reorder works within the bar (horizontal, left/right indicators)
3. Drag-and-drop reorder works within the overflow menu (vertical, top/bottom indicators)
4. Cross-container drag: bar→overflow and overflow→bar
5. Keyboard reorder: Space to select, arrows to move, Space/Enter to confirm, Escape to cancel
6. Keyboard reorder crosses containers with direction-aware arrows (Left/Right in bar, Up/Down in overflow)
7. Live region announces reorder start/move/confirm/cancel for screen readers
8. Overflow menu auto-closes after drag-and-drop completes (~400ms delay)
9. Truncated bookmark labels show tooltip on hover
10. Dot menu accessible via keyboard (ArrowRight to open, ArrowLeft to close in overflow)
11. Focus management: focus follows moved item, no MUI focus trap interference

## Affected Layers
- Webapp only (React components, hooks, SCSS, Menu component)

## Scope
- L (multi-file, cross-component, Menu.tsx changes)

## Non-Goals
- Anchor/links semantic redesign in overflow (deferred — MUI `<li>` structure limitation)
- BookmarkMeasureItem replacement with IntersectionObserver (medium-term)
- A11yController region registration (enhancement)
- useTextOverflow callback ref pattern (concluded not viable)
