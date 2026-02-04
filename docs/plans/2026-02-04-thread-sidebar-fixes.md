# Thread Sidebar Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two bugs when opening threads from the sidebar: (1) drag and drop file upload doesn't work, (2) channel members RHS closes instead of switching to Thread Followers.

**Architecture:**
- Bug #1: Update `FileUpload.getDragEventDefinition()` to include `.ThreadView__pane` as an alternative container selector for threads opened from the sidebar.
- Bug #2: Remove `suppressRHS` from `ThreadView` and instead trigger `showThreadFollowers` when the component mounts if channel members RHS was open.

**Tech Stack:** TypeScript, React

---

## Task 1: Fix Drag and Drop Container Selector for ThreadView

**Files:**
- Modify: `webapp/channels/src/components/file_upload/file_upload.tsx:224-227`

**Step 1: Update the 'thread' case in getDragEventDefinition**

Find the switch case for `'thread'` (around line 224):

```typescript
case 'thread': {
    containerSelector = this.props.rhsPostBeingEdited ? '.post-create__container .AdvancedTextEditor__body' : '.ThreadPane';
    overlaySelector = this.props.rhsPostBeingEdited ? '#createPostFileDropOverlay' : '.right-file-overlay';
    break;
}
```

Replace with:

```typescript
case 'thread': {
    containerSelector = this.props.rhsPostBeingEdited ? '.post-create__container .AdvancedTextEditor__body' : '.ThreadPane, .ThreadView__pane';
    overlaySelector = this.props.rhsPostBeingEdited ? '#createPostFileDropOverlay' : '.right-file-overlay';
    break;
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/file_upload/file_upload.tsx
git commit -m "fix: add ThreadView__pane to drag/drop container selector"
```

---

## Task 2: Remove suppressRHS from ThreadView

**Files:**
- Modify: `webapp/channels/src/components/threading/thread_view/thread_view.tsx:95-104`

**Step 1: Remove suppressRHS dispatch**

Find the useEffect that dispatches suppressRHS (around line 95):

```typescript
useEffect(() => {
    dispatch(suppressRHS);
    dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Threads));
    dispatch(clearLastUnreadChannel);
    loadProfilesForSidebar();

    return () => {
        dispatch(unsuppressRHS);
    };
}, [dispatch]);
```

Replace with:

```typescript
useEffect(() => {
    dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Threads));
    dispatch(clearLastUnreadChannel);
    loadProfilesForSidebar();
}, [dispatch]);
```

**Step 2: Remove unused imports**

Remove `suppressRHS` and `unsuppressRHS` from the imports at line 25:

Before:
```typescript
import {suppressRHS, unsuppressRHS, showThreadPinnedPosts, showThreadFollowers, closeRightHandSide} from 'actions/views/rhs';
```

After:
```typescript
import {showThreadPinnedPosts, showThreadFollowers, closeRightHandSide} from 'actions/views/rhs';
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/threading/thread_view/thread_view.tsx
git commit -m "fix: remove suppressRHS from ThreadView to keep RHS open"
```

---

## Task 3: Trigger Thread Followers When Entering ThreadView

**Files:**
- Modify: `webapp/channels/src/components/threading/thread_view/thread_view.tsx`

**Step 1: Add import for RHSStates selector**

The imports should already include `getRhsState` from `selectors/rhs`. Verify this import exists:

```typescript
import {getRhsState, getPinnedPostsThreadId, getThreadFollowersThreadId} from 'selectors/rhs';
```

**Step 2: Add useEffect to transition RHS to Thread Followers**

Add a new useEffect after the existing ones (around line 124), to switch the RHS to Thread Followers when entering the ThreadView:

```typescript
// When entering ThreadView with channel members RHS open, switch to Thread Followers
useEffect(() => {
    if (isThreadsInSidebarEnabled && threadIdentifier && channelId) {
        // If channel members RHS is open, switch to Thread Followers
        if (rhsState === RHSStates.CHANNEL_MEMBERS) {
            dispatch(showThreadFollowers(threadIdentifier, channelId));
        }
    }
}, [dispatch, isThreadsInSidebarEnabled, threadIdentifier, channelId, rhsState]);
```

**Step 3: Verify RHSStates import**

Ensure `RHSStates` is imported from constants. It should already be at line 36:

```typescript
import {RHSStates} from 'utils/constants';
```

**Step 4: Commit**

```bash
git add webapp/channels/src/components/threading/thread_view/thread_view.tsx
git commit -m "feat: switch channel members RHS to Thread Followers when entering ThreadView"
```

---

## Task 4: Handle Returning to Channel - Switch Back to Channel Members

**Files:**
- Modify: `webapp/channels/src/components/channel_view/channel_view.tsx`

**Step 1: Add imports for RHS state and actions**

Add these imports near the top of the file (after existing imports):

```typescript
import {useSelector, useDispatch} from 'react-redux';
import {getRhsState} from 'selectors/rhs';
import {showChannelMembers} from 'actions/views/rhs';
import {RHSStates} from 'utils/constants';
import type {GlobalState} from 'types/store';
```

Note: ChannelView is a class component, so we need a different approach. Instead, we'll handle this in the RHS reducer or through the existing channel switching logic.

**Alternative Approach - Modify sidebar_right.tsx**

Actually, this is better handled in `sidebar_right.tsx` where channel changes are already detected. Let me check that file.

**Step 1: Check sidebar_right behavior**

Read `webapp/channels/src/components/sidebar_right/sidebar_right.tsx` to understand how it handles channel changes. The exploration notes mentioned it handles channel switching at lines 226-241.

The existing behavior collapses RHS but doesn't close it on channel switch. For Thread Followers → Channel Members transition, we need to:

1. Detect when navigating away from a thread (to a channel)
2. If Thread Followers is showing, switch to Channel Members

**Step 2: Add transition logic in ChannelMembersRhs**

Modify `webapp/channels/src/components/channel_members_rhs/channel_members_rhs.tsx`.

The component already has a useEffect that handles channel changes (lines 158-173). But we need the reverse - when Thread Followers was open and we switch to a channel, open Channel Members.

**Better Approach: Handle in SidebarRight**

Modify `webapp/channels/src/components/sidebar_right/sidebar_right.tsx`:

In `componentDidUpdate`, after the channel change detection, add logic to switch from Thread Followers to Channel Members:

Find the componentDidUpdate method and add after the existing channel change handling:

```typescript
// When switching from thread to channel, if Thread Followers is showing, switch to Channel Members
if (
    prevProps.rhsState === RHSStates.THREAD_FOLLOWERS &&
    this.props.channel && prevProps.channel &&
    this.props.channel.id !== prevProps.channel.id
) {
    // Only switch if we're now viewing a channel (not another thread)
    const isNowViewingChannel = !window.location.pathname.includes('/thread/');
    if (isNowViewingChannel) {
        this.props.actions.showChannelMembers(this.props.channel.id);
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/sidebar_right/sidebar_right.tsx
git commit -m "feat: switch Thread Followers back to Channel Members when leaving thread"
```

---

## Task 5: Test the Fixes

**Step 1: Build the webapp**

```bash
cd webapp/channels && npm run build
```

**Step 2: Test Bug #1 - Drag and Drop**

1. Open a thread from the sidebar (full-width thread view)
2. Drag a file over the thread view
3. Verify the upload overlay appears
4. Drop the file and verify it uploads

**Step 3: Test Bug #2 - RHS Persistence**

1. Open a channel
2. Open the channel members RHS (click the members button in header)
3. Click a thread from the sidebar
4. Verify the RHS switches to Thread Followers (not closes)
5. Click back to a channel
6. Verify the RHS switches back to Channel Members

**Step 4: Commit any fixes if needed**

---

## Summary of Changes

| File | Change |
|------|--------|
| `webapp/channels/src/components/file_upload/file_upload.tsx` | Add `.ThreadView__pane` to container selector |
| `webapp/channels/src/components/threading/thread_view/thread_view.tsx` | Remove suppressRHS, add Thread Followers transition |
| `webapp/channels/src/components/sidebar_right/sidebar_right.tsx` | Switch Thread Followers → Channel Members on channel navigation |

## Benefits

1. **Drag and drop works** - Users can upload files in full-width thread view
2. **RHS stays open** - Channel members sidebar persists through navigation
3. **Context-aware RHS** - Shows Thread Followers for threads, Channel Members for channels
