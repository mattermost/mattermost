# External Links Test Plan

## Application Overview

Mattermost Channels - External link handling via the useExternalLink hook. When a user posts a message containing an external URL (non-mattermost.com), the link renders as a clickable anchor that opens in a new browser tab. The useExternalLink hook passes non-mattermost.com URLs through unchanged. This test verifies the full end-to-end flow: post message with URL, confirm link renders, click link, confirm new tab opens with correct URL.

## Test Scenarios

### 1. External Links

**Seed:** `specs/seed.spec.ts`

#### 1.1. external link in a posted message opens in a new tab @ai-assisted

**File:** `specs/functional/ai-assisted/external_links/external_links.spec.ts`

**Steps:**
  1. Initialize setup with a regular user and login to the channels page
    - expect: User is logged in
    - expect: Channels page is visible
  2. Post a message containing a plain external URL: https://example.com
    - expect: Message is posted and visible in the channel center view
    - expect: The URL renders as a clickable anchor link
  3. Wait for the page popup event and then click the rendered link anchor
    - expect: A new browser tab/popup is opened
    - expect: The new tab navigates to https://example.com
  4. Verify the new tab URL matches https://example.com
    - expect: The URL of the new page matches example.com
