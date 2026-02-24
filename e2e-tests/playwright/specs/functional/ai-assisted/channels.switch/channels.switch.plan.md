# channels.switch - Channel Switching

## Application Overview

Test the core channel switching functionality in Mattermost. Verifies that users can navigate between channels and that the UI correctly reflects the active channel selection.

## Test Scenarios

### 1. Channel Switching

**Seed:** `specs/functional/channels/account_settings/profile/popover_fields.spec.ts`

#### 1.1. should switch to a different channel and display its content

**File:** `specs/functional/ai-assisted/channels.switch/channels.switch.spec.ts`

**Steps:**
  1. Navigate to the Mattermost client and ensure the client is fully loaded
    - expect: The client interface is displayed and ready
  2. Locate the channel list in the sidebar (typically on the left side of the interface)
    - expect: Channel list is visible with multiple channels available
  3. Identify the currently active channel by looking for visual indicators (highlight, bold text, etc.)
    - expect: Current channel is clearly identifiable in the sidebar
  4. Click on a different channel in the sidebar (select a public channel like 'town-square' or 'off-topic' if available)
    - expect: The channel switching action is performed without errors
  5. Wait for the channel view to update and the main content area to load
    - expect: The page transitions to the selected channel without errors
  6. Verify that the selected channel is now highlighted or marked as active in the sidebar
    - expect: The previously clicked channel now appears as the active/selected channel
  7. Verify that the channel content/messages area displays content for the new channel
    - expect: The main content area shows messages or content appropriate for the selected channel
    - expect: The channel name/header reflects the selected channel
