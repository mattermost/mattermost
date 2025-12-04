# Mattermost Redux CLAUDE.md

## Overview
`mattermost-redux` is a legacy internal package located at `channels/src/packages/mattermost-redux`. It contains the core Redux logic (actions, reducers, selectors, types) for server data.

## State Structure
- **state.entities**: Contains all data sourced from the server (Users, Channels, Teams, Posts, Files, etc.).
- **state.requests**: Tracks the status of network requests (loading, success, failure).
- **state.errors**: Global error state.

**Note**: UI state (modals, expanded sidebars, form state) belongs in `state.views`, which is typically defined outside of this package in the main `channels` app code.

## Development
- This package is treated as a local dependency.
- When adding new server-side entities, their Redux logic (types, actions, reducers) should go here.



