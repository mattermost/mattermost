# Channel Tabs Implementation

This directory contains the implementation for transforming the bookmarks bar into a tab bar system for Mattermost channels, as designed in Figma.

## Components

### `channel_tabs.tsx`
The main tab bar component that replaces the bookmarks bar. Features:
- Tab navigation with keyboard support (arrow keys)
- Active tab indicator with blue underline
- Tab types: Messages, Files, Wiki, Bookmarks
- Add tab button for future functionality

### `channel_tab.tsx`
Individual tab component that handles:
- Tab rendering with label and optional icon
- Active and focused states
- Click and keyboard event handling
- Accessibility attributes (ARIA)

### `channel_tab.scss`
Dedicated stylesheet for the individual tab component:
- Tab button styling and hover states
- Active tab indicator
- Text and icon styling
- Focus and accessibility styles

### `channel_tab_content.tsx`
Handles the content display for each tab:
- Messages tab: Shows the existing PostView component
- Files tab: Shows channel files in a dedicated list format within the tab content
- Wiki tab: Placeholder content for future wiki implementation
- Bookmarks tab: Shows the existing ChannelBookmarks component when enabled

### `channel_files_content.tsx`
Dedicated component for displaying channel files:
- Fetches channel files directly using the search API
- Displays files in a clean list format within the tab content
- Handles file attachment enablement checks
- Shows file names, extensions, and sizes

## Integration

The new tab system is temporarily integrated by modifying `channel_identifier_router.tsx` to use `ChannelViewWithTabs` instead of the standard `ChannelView`. This should be replaced with a proper feature flag system in production.

## Styling

- Uses styled-components for component-specific styles
- Follows Mattermost's existing design system
- Responsive design with proper accessibility support

## Current Tab Structure

1. **Messages** - Shows the existing PostView component (default active tab)
2. **Files** - Shows recent files in the channel in a dedicated list format
3. **Wiki** - Placeholder for future wiki functionality
4. **Bookmarks** - Shows existing ChannelBookmarks component when enabled

## Future Work

1. Implement proper feature flag system
2. Add wiki functionality to the Wiki tab
3. Add tab management (add/remove tabs)
4. Integrate with existing bookmark system
5. Add proper state management for tab content
