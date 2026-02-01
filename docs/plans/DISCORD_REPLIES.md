Discord Replies Feature Implementation Plan

Overview

Implement Discord-style replies as a built-in feature in Mattermost Extended, wrapped in the DiscordReplies feature flag. This replaces the existing plugin with native implementation for better performance and  
proper message interception.

Key Requirements

1. Feature flag DiscordReplies wraps ALL logic
2. Text content remains as blockquote + link + ping (graceful degradation when disabled)
3. "Reply" button becomes "Add to Reply Queue", "Create Thread" becomes separate option
4. Click-to-reply setting repurposes "Click to open threads"
5. Proper message interception - no DOM manipulation

---
Implementation Strategy

Phase 1: Server-Side Changes

1.1 Feature Flag

File: server/public/model/feature_flags.go
- Add DiscordReplies bool to FeatureFlags struct

1.2 Server-Side Reply Detection (Optional Enhancement)

File: server/channels/api4/post.go or hook
- Server can detect discord reply pattern and set metadata for grouping prevention
- Parse >[@username](permalink): content pattern
- Set post.metadata.priority = {priority: 'discord_reply'} to prevent grouping

---
Phase 2: Webapp - Core Infrastructure

2.1 Types and Constants

File: webapp/platform/types/src/posts.ts
- Add discord_replies to Post props type
- Define DiscordReplyData interface:
interface DiscordReplyData {
post_id: string;
user_id: string;
username: string;
nickname: string;
text: string;
has_image: boolean;
has_video: boolean;
}

2.2 Redux State for Pending Replies

File: webapp/channels/src/packages/mattermost-redux/src/action_types/posts.ts
- Add action types: ADD_PENDING_REPLY, REMOVE_PENDING_REPLY, CLEAR_PENDING_REPLIES

File: webapp/channels/src/packages/mattermost-redux/src/reducers/entities/posts/ (new file)
- Create pending_replies.ts reducer

File: webapp/channels/src/packages/mattermost-redux/src/selectors/entities/posts.ts
- Add getPendingReplies selector

File: webapp/channels/src/packages/mattermost-redux/src/actions/posts.ts
- Add addPendingReply, removePendingReply, clearPendingReplies actions

---
Phase 3: Message Interception

3.1 Outgoing Message Hook

File: webapp/channels/src/actions/hooks.ts
- In runMessageWillBePostedHooks:
- Check if DiscordReplies feature enabled
- If pending replies exist:
    - Generate quote text: >[@username](permalink): content
    - Prepend to message
    - Add discord_replies array to post.props
    - Clear pending replies state

3.2 Post Grouping Prevention

Approach: Use existing priority metadata mechanism (no changes needed to post_utils.ts)

The isConsecutivePost function in post/index.tsx:85-86 already prevents grouping for posts with non-encrypted priority:
const hasPriorityButNotEncrypted = post.metadata?.priority?.priority &&
    post.metadata.priority.priority !== PostPriority.ENCRYPTED;

Implementation:
- In runMessageWillBePostedHooks, set post.metadata.priority = { priority: 'discord_reply' } when post has pending replies
- This automatically prevents grouping with no additional changes needed

---
Phase 4: UI Components

4.1 Discord Reply Preview Component

File: webapp/channels/src/components/post/discord_reply_preview/ (new directory)
- discord_reply_preview.tsx - Main component
- discord_reply_preview.scss - Styling
- index.ts - Export

Features:
- Renders above post header (not as separate listitem)
- Shows avatar, username, preview text
- Clickable to jump to original post
- Curved connector lines (SVG)

4.2 Pending Replies Bar

File: webapp/channels/src/components/advanced_text_editor/pending_replies_bar/ (new directory)
- pending_replies_bar.tsx - Shows "Replying to: [@user1 x] [@user2 x] [x]"
- pending_replies_bar.scss - Styling
- Renders above the text editor when pending replies exist

4.3 Post Component Integration

File: webapp/channels/src/components/post/post_component.tsx
- Import and render DiscordReplyPreview when:
- Feature flag enabled
- Post has discord_replies in props
- Conditionally hide blockquote lines that match reply pattern

4.4 PostMessageView - Hide Raw Quotes

File: webapp/channels/src/components/post_view/post_message_view/post_message_view.tsx
- When feature enabled and post has discord_replies:
- Strip the quote lines from displayed message (they're shown in preview instead)
- Pass modified message to PostMarkdown

---
Phase 5: Reply Button Behavior

5.1 Change Reply Action

File: webapp/channels/src/components/dot_menu/dot_menu.tsx
- When DiscordReplies enabled:
- "Reply" → calls addPendingReply(postId) instead of opening thread
- Add new "Create Thread" menu item that opens thread RHS

File: webapp/channels/src/components/post_view/post_actions/
- Modify quick action reply button (CommentIcon)
- When feature enabled: add to pending replies instead of opening thread

5.2 Click-to-Reply Setting

File: webapp/channels/src/components/user_settings/display/user_settings_display.tsx
- When DiscordReplies enabled:
- Rename "Click to open threads" → "Click to reply"
- Update description text

File: webapp/channels/src/components/post/post_component.tsx
- Modify handlePostClick:
- When feature enabled + click_to_reply setting on:
    - Call addPendingReply(postId) instead of opening thread

---
Phase 6: Admin Console

6.1 Feature Flag Toggle

File: webapp/channels/src/components/admin_console/admin_definition.tsx
- Add to mattermost_extended.subsections.features.schema.settings:
{
type: 'bool',
key: 'FeatureFlags.DiscordReplies',
label: 'Enable Discord-Style Replies',
help_text: 'When enabled, clicking Reply adds messages to a reply queue...',
}

---
Phase 7: Styling

File: webapp/channels/src/components/post/discord_reply_preview/discord_reply_preview.scss
.discord-reply-preview {
// Connector lines
// Avatar styling (14px)
// Username styling
// Preview text (truncated)
// Hover states
}

File: webapp/channels/src/components/advanced_text_editor/pending_replies_bar/pending_replies_bar.scss
.pending-replies-bar {
// Chip styling for each pending reply
// Remove buttons
// Close all button
}

---
File Summary

Server Files

1. server/public/model/feature_flags.go - Add DiscordReplies flag

Webapp Files (Modify)

2. webapp/platform/types/src/posts.ts - Add types
3. webapp/channels/src/packages/mattermost-redux/src/action_types/posts.ts - Action types
4. webapp/channels/src/packages/mattermost-redux/src/reducers/entities/posts/index.ts - Include new reducer
5. webapp/channels/src/packages/mattermost-redux/src/selectors/entities/posts.ts - Selectors
6. webapp/channels/src/packages/mattermost-redux/src/actions/posts.ts - Actions
7. webapp/channels/src/actions/hooks.ts - Message interception + priority metadata
8. webapp/channels/src/components/post/post_component.tsx - Render preview, click handling
9. webapp/channels/src/components/post_view/post_message_view/post_message_view.tsx - Hide raw quotes
10. webapp/channels/src/components/dot_menu/dot_menu.tsx - Menu actions
11. webapp/channels/src/components/user_settings/display/user_settings_display.tsx - Setting rename
12. webapp/channels/src/components/admin_console/admin_definition.tsx - Admin UI

Webapp Files (New)

13. webapp/channels/src/components/post/discord_reply_preview/discord_reply_preview.tsx
14. webapp/channels/src/components/post/discord_reply_preview/discord_reply_preview.scss
15. webapp/channels/src/components/post/discord_reply_preview/index.ts
16. webapp/channels/src/components/advanced_text_editor/pending_replies_bar/pending_replies_bar.tsx
17. webapp/channels/src/components/advanced_text_editor/pending_replies_bar/pending_replies_bar.scss
18. webapp/channels/src/components/advanced_text_editor/pending_replies_bar/index.ts
19. webapp/channels/src/packages/mattermost-redux/src/reducers/entities/posts/pending_replies.ts

---
Verification

Manual Testing

1. Enable feature flag in System Console
2. Click "Reply" on a post → should add to pending queue (not open thread)
3. Send message → should include quote prefix and show preview
4. Preview should render above the new post
5. Clicking preview should jump to original post
6. "Create Thread" should open thread RHS
7. Disable feature flag → quotes appear as regular blockquotes
8. "Click to reply" setting works

Build Verification

# Server
cd server && make build-linux BUILD_ENTERPRISE=false

# Webapp
cd webapp && npm run build

---
Implementation Reference (from Plugin)

Plugin Source: G:\Modding\_Github\mattermost-user-manager\plugins\mattermost-discord-replies

Reply Data Structure

interface ReplyData {
    post_id: string;
    user_id: string;
    username: string;
    nickname: string;  // Display name: nickname if available, else username
    text: string;
    has_image: boolean;
    has_video: boolean;
}

Quote Format

// Format: >[@username](permalink): content
function generateQuoteText(replies: ReplyData[]): string {
    const quoteLines: string[] = [];
    for (const reply of replies) {
        const permalink = getPostPermalink(reply.post_id);
        const content = formatMediaPreview(reply.text, reply.has_image, reply.has_video, MAX_PREVIEW_LENGTH);
        quoteLines.push(`>[@${reply.username}](${permalink}): ${content}`);
    }
    return quoteLines.join('\n') + '\n\n';
}

Reply Detection Pattern

function hasDiscordReplyQuotes(message: string): boolean {
    const lines = message.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('>[@') && trimmed.includes('](') && trimmed.includes('):')) {
            return true;
        }
    }
    return false;
}

Parse Reply from Message

const replyPattern = /^>\[@([^\]]+)\]\(([^)]+\/pl\/([a-z0-9]+))\):\s*(.*)$/i;

SVG Connector Lines

// position: 'single' = only one reply (curved corner, no vertical continuation below)
//           'first' = first of multiple (curved corner, vertical continues down)
//           'middle' = middle reply (vertical line through, horizontal branch)
//           'last' = last of multiple (vertical from top, curves into horizontal)
function createConnectorSVG(position: 'single' | 'first' | 'middle' | 'last', height: number = 18): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '36');
    svg.setAttribute('height', String(height));
    svg.style.overflow = 'visible';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    // Layout constants (matching CSS)
    const IMG_COL_WIDTH = 53;           // .discord-reply-img width
    const CONNECTOR_LEFT = 27;          // .discord-reply-connectors left position (post avatar center)
    const GAP = 3;                       // Small gap so lines don't touch avatars
    const ITEM_SHIFT = 6;               // .discord-reply-item margin-left
    const H_GAP = 1;                     // Horizontal gap before reply avatar
    const V_GAP = 2;                     // Vertical gap before post avatar below

    // Calculated anchor points
    const x = 0;                         // Vertical line x-position (left edge of SVG)
    const curveR = 6;                    // Bezier curve radius
    const midY = height / 2;             // Center of row - where horizontal branches go
    const bottomY = height - V_GAP;      // Vertical line stops short of container bottom

    // Horizontal: from connector to left edge of reply avatar
    const endX = IMG_COL_WIDTH - CONNECTOR_LEFT - GAP + ITEM_SHIFT - H_GAP;  // 53 - 27 - 3 + 6 - 1 = 28

    let d: string;
    switch (position) {
        case 'single':
            d = `M ${x} ${bottomY} L ${x} ${midY + curveR} Q ${x} ${midY}, ${x + curveR} ${midY} L ${endX} ${midY}`;
            break;
        case 'first':
            d = `M ${x} ${height} L ${x} ${midY + curveR} Q ${x} ${midY}, ${x + curveR} ${midY} L ${endX} ${midY}`;
            break;
        case 'middle':
            d = `M ${x} 0 L ${x} ${height} M ${x} ${midY} L ${endX} ${midY}`;
            break;
        case 'last':
            d = `M ${x} 0 L ${x} ${bottomY} M ${x} ${midY} L ${endX} ${midY}`;
            break;
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', '#6e6e6e');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(path);
    return svg;
}

CSS Styling Reference

/* === Reply Preview - Mirrors post structure for alignment === */
.discord-reply-listitem {
    overflow: visible;
    position: relative;
    z-index: 10;
    margin-bottom: -6px;  /* Pull closer to post below so reply is right above username */
}

.discord-reply-content {
    display: flex;
    padding: 0 8px 0 5px;
    margin: 0 auto;
    padding-left: 1.5em;
    padding-right: 0.5em;
    overflow: visible;
}

/* Mirrors .post__img - same 53px width */
.discord-reply-img {
    width: 53px;
    padding-right: 10px;
    display: flex;
    justify-content: flex-start;
    align-items: stretch;
    position: relative;
    overflow: visible;
}

/* Connector column - positioned at center of avatar area */
.discord-reply-connectors {
    display: flex;
    flex-direction: column;
    position: absolute;
    left: 27px;  /* Center of avatar: 53px - 10px padding - 16px (half of 32px avatar) */
    top: 0;
    bottom: 0;
    overflow: visible;
}

.discord-reply-connector {
    height: 18px;
    box-sizing: border-box;
    position: relative;
    z-index: 10;
}

.discord-reply-body {
    display: flex;
    flex-direction: column;
    padding-left: 0;
    min-width: 0;
    flex: 1;
}

.discord-reply-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 1rem;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;
    line-height: 1.2;
    height: 18px;
    margin-left: 6px;
}

.discord-reply-item:hover .discord-reply-username,
.discord-reply-item:hover .discord-reply-text {
    color: rgba(var(--center-channel-color-rgb), 1);
}

.discord-reply-avatar {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
}

.discord-reply-username {
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    flex-shrink: 0;
    transition: color 0.1s;
}

.discord-reply-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 400px;
    transition: color 0.1s;
}

/* === Pending Reply Bar Above Textbox === */
.discord-pending-replies {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px 4px 0 0;
    font-size: 0.85rem;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin: 0 16px;
}

.discord-pending-replies .pending-label {
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 0.95rem;
    flex-shrink: 0;
}

.discord-pending-replies .pending-targets {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    overflow: hidden;
    flex-wrap: wrap;
}

.discord-pending-replies .pending-reply-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: rgba(var(--center-channel-color-rgb), 0.12);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.2);
    border-radius: 12px;
    padding: 2px 6px 2px 10px;
}

.discord-pending-replies .pending-username {
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.9);
}

.discord-pending-replies .pending-chip-remove {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    width: 16px;
    height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.5);
    font-size: 14px;
    line-height: 1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.discord-pending-replies .pending-chip-remove:hover {
    background: rgba(var(--center-channel-color-rgb), 0.15);
    color: rgba(var(--center-channel-color-rgb), 0.9);
}

.discord-pending-replies .pending-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    margin: -4px;
    margin-left: auto;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 18px;
    line-height: 1;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

/* Post highlight animation when jumping to a post */
.post--highlight {
    animation: discord-reply-highlight 2s ease-out;
}

@keyframes discord-reply-highlight {
    0% { background-color: rgba(var(--button-bg-rgb), 0.2); }
    100% { background-color: transparent; }
}

/* Hide the first blockquote (reply quote) in posts that have discord replies */
.discord-reply-listitem + [role="listitem"] .post-message__text > blockquote:first-child,
.discord-reply-listitem + [role="listitem"] .post-message__text > p:first-child:has(a[href*="/pl/"]) {
    display: none !important;
}

Thread Button SVG Icon

// Create Thread icon (list with chevron)
React.createElement('svg', {
    width: '18',
    height: '18',
    viewBox: '0 0 16 16',
    fill: 'none'
},
    // Top line
    React.createElement('path', {
        d: 'M5 4h9',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round'
    }),
    // Chevron
    React.createElement('path', {
        d: 'M2 6l3 2-3 2',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
    }),
    // Middle line (shorter on left)
    React.createElement('path', {
        d: 'M8 8h6',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round'
    }),
    // Bottom line
    React.createElement('path', {
        d: 'M5 12h9',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round'
    })
)

Click Eligibility Check (from Mattermost utils)

// Mirrors Mattermost's CLICKABLE_ELEMENTS from utils/utils.tsx
const CLICKABLE_ELEMENTS = ['a', 'button', 'img', 'svg', 'audio', 'video'];
const EXCLUDED_CLICK_SELECTOR = '.post-image__column, .embed-responsive-item, .attachment, .hljs, code';

function isEligibleForClick(event: MouseEvent, currentTarget: HTMLElement): boolean {
    let node = event.target as HTMLElement;

    // Don't trigger if text is selected
    const selection = window.getSelection();
    if (selection?.type === 'Range') return false;

    // If clicking directly on the post container, it's eligible
    if (node === currentTarget) return true;

    // In the case of a React Portal, don't trigger
    if (!currentTarget.contains(node)) return false;

    // Traverse up the DOM tree to check clickable elements
    while (node && node !== currentTarget) {
        if (CLICKABLE_ELEMENTS.includes(node.tagName.toLowerCase())) return false;
        const role = node.getAttribute('role');
        if (role === 'button' || role === 'link') return false;
        if (node.matches?.(EXCLUDED_CLICK_SELECTOR)) return false;
        node = node.parentNode as HTMLElement;
    }

    return true;
}

Constants

const PROP_KEY_DISCORD_REPLIES = 'discord_replies';
const MAX_REPLIES = 10;
const MAX_PREVIEW_LENGTH = 100;

---
CLAUDE.md Update

After implementation, add DiscordReplies to the Current Feature Flags table in CLAUDE.md.