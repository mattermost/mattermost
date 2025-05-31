# MM-63240 Implementation Plan: TeamSettings.BrowseArchivedPublicChannels

## Overview

This issue involves replacing the `TeamSettings.ExperimentalViewArchivedChannels` setting with a new, more focused setting called `TeamSettings.BrowseArchivedPublicChannels`. This change provides more granular control over the visibility of archived channels.

## Current Behavior

- `TeamSettings.ExperimentalViewArchivedChannels` controls whether users can access and see archived channels.
- When enabled (true), users can access archived channels and see them listed in places like the channel switcher.
- When disabled (false), users cannot access or see archived channels at all.
- This setting has defaulted to true since October 2022 (v5.28).

## Desired Behavior

- A new setting `TeamSettings.BrowseArchivedPublicChannels` will default to true.
- This setting will specifically control the visibility of archived public channels when browsing available channels:
  - When enabled (true): Archived public channels will be visible when browsing available channels
  - When disabled (false): Archived public channels will be hidden when browsing available channels, unless the user is already a member
- Users will always be able to access archived channels where they are members.
- Users can leave archived channels if they no longer wish to see them.

## Implementation Plan

After each step below, commit the changes and update the implementation plan to mark this step as done.

### 1. Stop relying on `TeamSettings.ExperimentalViewArchivedChannels`

- Everywhere we use `TeamSettings.ExperimentalViewArchivedChannels`, replace it with a `if (true)` condition.
- Now, remove all the dead code paths.
- Update the tests
- Update the API documentation as needed.
- After this change, the `ExperimentalViewArchivedChannels` setting will no longer be used in the codebase.
- Do not remove it from the configuration block, but mark it as deprecated.

### 2. Add the New Config Setting

- Add `BrowseArchivedPublicChannels` to the `TeamSettings` struct in `/public/model/config.go`
- Set a default value of `true` in the `SetDefaults()` method
- Add appropriate JSON tags and documentation
- Expose the new setting in `/config/client.go` for the frontend to use
- Update telemetry reporting to include the new setting
- Add unit tests for the new setting

### 2. Update API/App/Store layers

- Modify the `getPublicChannelsForTeam` endpoint in `/channels/api4/channel.go`
- Pass the new setting to the App layer
- Modify the `GetPublicChannelsForTeam` method in `/channels/app/channel.go`
- Pass the new setting to the Store layer
- Modify the `GetPublicChannelsForTeam` method in `/channels/store/sqlstore/channel_store.go`
- Update the query to conditionally include/exclude archived channels based on the new setting

### 3. Update e2e tests

- Add a Playwright test to validate that archived channels are hidden when using the `Browse Channels` feature and `TeamSettings.BrowseArchivedPublicChannels` is set to false.
- Add a Playwright test to validate that archived channels are shown when using the `Browse Channels` feature and `TeamSettings.BrowseArchivedPublicChannels` is set to true.

