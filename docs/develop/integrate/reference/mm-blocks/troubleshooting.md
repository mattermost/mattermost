---
title: "Troubleshoot Mattermost Blocks"
description: "Common issues when Mattermost Blocks posts do not render or respond as expected, with guidance for integration developers and mobile client behavior."
sidebar_label: "Troubleshoot Mattermost Blocks"
sidebar_position: 43
---

Integration posts that use Mattermost Blocks show structured content—including text, images, buttons, and menus—directly in a channel. This page covers common issues when Mattermost Blocks do not render or respond as expected. Use it alongside the [Mattermost Blocks reference](/developers/integrate/reference/mm-blocks) when debugging payloads, action handlers, and client rendering.

## Mattermost Blocks content does not appear

**Symptoms:** A post shows only plain text (or no content) and the expected buttons, images, or content blocks are missing.

**Try the following:**

1. **Confirm the integration payload.** The post must include a non-empty `props.mm_blocks` array (or a legacy format such as [message attachments](/developers/integrate/reference/message-attachments) that the client translates). Verify the webhook, bot, plugin, or REST API payload before testing in a client.
2. **Check the feature flag (self-hosted admins).** Mattermost Blocks are controlled by the `MmBlocksEnabled` feature flag (enabled by default). Self-hosted deployments can disable Mattermost Blocks by setting `MM_FEATUREFLAGS_MMBLOCKSENABLED=false`. When disabled, native Mattermost Blocks payloads are not rendered and their actions are rejected.
3. **Update the client.** Mattermost Blocks require a current Mattermost web, desktop, or mobile app. See [client availability](https://docs.mattermost.com/end-user-guide/access/client-availability.html) in the product documentation for platform support.
4. **Reload the channel.** Pull to refresh on mobile, or switch channels and return, to fetch the latest post data.

## Buttons or menus do not respond

**Symptoms:** Buttons appear disabled, or tapping a button or menu option has no effect.

**Try the following:**

1. **Validate the action registry.** Every `action_id` on a button, `static_select`, or markdown action must have a matching entry in `props.mm_blocks_actions`. Unused registry entries and unreferenced action IDs are rejected at post-create time. See [The `mm_blocks_actions` registry](/developers/integrate/reference/mm-blocks#the-mm_blocks_actions-registry).
2. **Wait for the action to finish.** Some integrations show a loading state while Mattermost calls an external service. Slow integrations may time out based on your server's [integration request timeout](https://docs.mattermost.com/configure/configuration-settings.html#integration-request-timeout) setting.
3. **Check whether the control is disabled.** Integrations can send buttons and menus with `"disabled": true`. Disabled controls cannot be activated.
4. **Verify outbound server connectivity.** External actions require Mattermost **server nodes** (not end-user devices) to make **outbound** requests to each integration action endpoint URL configured in the post. These endpoints typically use **HTTPS on TCP port 443**; if a URL uses another scheme or port, that destination must be reachable outbound from the server. Allow only the specific integration endpoints your organization uses—this is not an inbound connection requirement. For server-side 400 errors, see [Why does an interactive button or menu return a 400 error?](/developers/integrate/plugins/interactive-messages#why-does-an-interactive-button-or-menu-return-a-400-error).
5. **Look for follow-up messages.** Successful actions may update the original post or return an ephemeral reply visible only to the user who clicked. Check the thread panel if the post is part of a thread.

## Scrollable content issues on mobile

**Symptoms:** Clipped integration content cannot be expanded, or the **Scrollable content** screen is empty.

Some integration posts limit the height of a content region using a container `max_height` value. When content overflows, Mattermost mobile shows a clipped preview with an expand control in the corner of the region.

**To view the full content on mobile:**

1. Locate the clipped region in the post (a fade at the bottom indicates more content below).
2. Select the expand control in the bottom-right corner of the clipped area.
3. Mattermost opens a full-screen **Scrollable content** view where you can scroll through the complete block content.
4. Use the back gesture or navigation control to return to the channel.

**If the Scrollable content screen shows "Cannot display content":**

- Return to the channel and open the expand control again. This screen appears when the expanded payload is no longer available (for example, after navigating away before the view loaded).
- Update to the latest mobile app build if the issue persists across multiple posts.

On web and desktop, the same clipped regions scroll inside the post; a separate full-screen view is not used.

## Collapsible sections or images look wrong

**Symptoms:** A section will not expand, an image fails to load, or part of the layout is missing.

**Try the following:**

1. **Collapsible sections:** Select the section header to toggle between expanded and collapsed states. If the header is missing or empty, the integration payload may be incomplete. Both `header` and `content` arrays are required on `collapsible` blocks.
2. **Images:** External images require a valid URL and may be blocked by your server's image proxy or SVG settings. Contact your system admin if images from other integrations load but Mattermost Blocks images do not.
3. **Partial content:** Clients skip individual malformed blocks and still render valid ones in the same post. If only some elements are missing, the integration payload likely contains invalid block entries. Compare the payload against the [block types](/developers/integrate/reference/mm-blocks#block-types) reference.

## Not all blocks appear or text is cut off

**Symptoms:** Only part of an integration post renders, blocks at the end of the post are missing, or text in a block or on a button label ends abruptly.

Mattermost enforces size limits on Mattermost Blocks payloads. Content that exceeds a limit is truncated when the post is rendered.

**Try the following:**

1. **Review payload limits.** A single post is limited to:
   - **100 blocks** in the `props.mm_blocks` array
   - **32 levels** of nesting depth across nested block structures
   - **16,000 characters** total across all text in the payload, including text blocks and button labels
2. **Reduce payload size.** Split long content across multiple posts, shorten labels, flatten deeply nested structures, or remove optional blocks.
3. **Validate after content changes.** If truncation appears only for certain posts or started after an integration update, compare the payload against these limits.

## Legacy message attachments

Older integrations that use [message attachments](/developers/integrate/reference/message-attachments) are translated into the Mattermost Blocks UI at render time. Button and menu behavior should match native Mattermost Blocks posts. If an attachment-based post behaves differently from a native Mattermost Blocks post, compare the attachment `actions` array and callback URLs against an equivalent `mm_blocks` payload.

## Get more help

- **Payload format and actions:** See the [Mattermost Blocks reference](/developers/integrate/reference/mm-blocks) for block schema, action types, and migration guidance.
- **Interactive message errors:** See [interactive messages](/developers/integrate/plugins/interactive-messages) for post-action responses, error handling, and legacy attachment actions.
- **Mobile deployment issues:** See [mobile deployment troubleshooting](https://docs.mattermost.com/deploy/mobile-troubleshoot.html) for connectivity, push notification, and app install problems unrelated to Mattermost Blocks content.

If you continue to experience issues, visit the [Mattermost Troubleshooting forum](https://forum.mattermost.com/c/trouble-shoot/16) or contact your system administrator.
