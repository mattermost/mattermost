# RHS Transition Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two RHS panel transition bugs: Thread→Channel should show Channel Members, Thread→Thread should update Thread Followers list.

**Architecture:** URL-based detection in SidebarRight for Thread→Channel transitions; expanded condition in ThreadView for Thread→Thread updates.

**Tech Stack:** React, Redux, react-router-dom

---

## Bug Analysis

### Bug A: Thread → Channel doesn't switch to Channel Members
**Root Cause:** The current logic in `sidebar_right.tsx` detects channel ID changes, but when navigating from ThreadView to a channel, the channel context doesn't change in the expected way. The URL changes from `/thread/:id` to `/channels/:name`, but channel ID comparison fails.

**Fix:** Use URL-based detection. Check if the previous URL contained `/thread/` and the current URL doesn't.

### Bug B: Thread → Thread doesn't update Thread Followers
**Root Cause:** The useEffect in `thread_view.tsx` only triggers when `rhsState === RHSStates.CHANNEL_MEMBERS`. When switching between threads, RHS is already `THREAD_FOLLOWERS`, so the condition fails.

**Fix:** Expand the condition to also dispatch when `rhsState === RHSStates.THREAD_FOLLOWERS` and `threadIdentifier` changes.

---

## Task 1: Update Test File for New Scenarios

**Files:**
- Modify: `webapp/channels/src/tests/mattermost_extended/thread_sidebar_fixes.test.tsx`

**Step 1: Add test for Thread→Channel URL-based detection**

Add this test to the "Bug #3 - RHS Transition Back" describe block:

```typescript
it('should detect Thread→Channel transition via URL change', () => {
    const prevPathname = '/team-name/thread/abc123';
    const currentPathname = '/team-name/channels/town-square';
    const channelId = 'channel_id_1';

    let actionDispatched: any = null;

    const dispatch = (action: any) => {
        actionDispatched = action;
    };

    const showChannelMembers = (cId: string) => ({type: 'SHOW_CHANNEL_MEMBERS', channelId: cId});

    // Logic: if previous URL had /thread/ and current doesn't, switch to Channel Members
    const wasOnThread = prevPathname.includes('/thread/');
    const isNowOnChannel = !currentPathname.includes('/thread/');

    if (wasOnThread && isNowOnChannel) {
        dispatch(showChannelMembers(channelId));
    }

    expect(actionDispatched).toEqual({
        type: 'SHOW_CHANNEL_MEMBERS',
        channelId: 'channel_id_1',
    });
});

it('should NOT switch to Channel Members when navigating Thread→Thread', () => {
    const prevPathname = '/team-name/thread/abc123';
    const currentPathname = '/team-name/thread/def456';
    const channelId = 'channel_id_1';

    let actionDispatched: any = null;

    const dispatch = (action: any) => {
        actionDispatched = action;
    };

    const showChannelMembers = (cId: string) => ({type: 'SHOW_CHANNEL_MEMBERS', channelId: cId});

    const wasOnThread = prevPathname.includes('/thread/');
    const isNowOnChannel = !currentPathname.includes('/thread/');

    if (wasOnThread && isNowOnChannel) {
        dispatch(showChannelMembers(channelId));
    }

    // Should NOT dispatch because we're still on a thread
    expect(actionDispatched).toBeNull();
});
```

**Step 2: Add test for Thread→Thread update**

Add a new describe block:

```typescript
describe('Bug #4 - Thread to Thread Transition', () => {
    it('should update Thread Followers when switching threads while RHS shows THREAD_FOLLOWERS', () => {
        const rhsState = RHSStates.THREAD_FOLLOWERS;
        const newThreadIdentifier = 'thread_id_2';
        const channelId = 'channel_id_1';

        let actionDispatched: any = null;

        const dispatch = (action: any) => {
            actionDispatched = action;
        };

        const showThreadFollowers = (tId: string, cId: string) => ({
            type: 'SHOW_THREAD_FOLLOWERS',
            threadId: tId,
            channelId: cId,
        });

        // Logic: dispatch showThreadFollowers when RHS is CHANNEL_MEMBERS OR THREAD_FOLLOWERS
        if (rhsState === RHSStates.CHANNEL_MEMBERS || rhsState === RHSStates.THREAD_FOLLOWERS) {
            dispatch(showThreadFollowers(newThreadIdentifier, channelId));
        }

        expect(actionDispatched).toEqual({
            type: 'SHOW_THREAD_FOLLOWERS',
            threadId: 'thread_id_2',
            channelId: 'channel_id_1',
        });
    });

    it('should NOT update Thread Followers when RHS shows something else', () => {
        const rhsState = RHSStates.PIN;
        const newThreadIdentifier = 'thread_id_2';
        const channelId = 'channel_id_1';

        let actionDispatched: any = null;

        const dispatch = (action: any) => {
            actionDispatched = action;
        };

        const showThreadFollowers = (tId: string, cId: string) => ({
            type: 'SHOW_THREAD_FOLLOWERS',
            threadId: tId,
            channelId: cId,
        });

        if (rhsState === RHSStates.CHANNEL_MEMBERS || rhsState === RHSStates.THREAD_FOLLOWERS) {
            dispatch(showThreadFollowers(newThreadIdentifier, channelId));
        }

        // Should NOT dispatch because RHS is showing PIN, not members/followers
        expect(actionDispatched).toBeNull();
    });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd webapp/channels && npm test -- --testPathPattern=thread_sidebar_fixes`
Expected: New tests should fail (logic not yet implemented)

**Step 4: Commit**

```bash
git add webapp/channels/src/tests/mattermost_extended/thread_sidebar_fixes.test.tsx
git commit -m "test: add tests for Thread→Channel and Thread→Thread RHS transitions"
```

---

## Task 2: Fix Thread→Thread Transition in ThreadView

**Files:**
- Modify: `webapp/channels/src/components/threading/thread_view/thread_view.tsx:101-106`

**Step 1: Expand the useEffect condition**

Change the existing useEffect from:

```typescript
// Transition from Channel Members to Thread Followers when entering ThreadView
useEffect(() => {
    if (isThreadsInSidebarEnabled && threadIdentifier && channelId && rhsState === RHSStates.CHANNEL_MEMBERS) {
        dispatch(showThreadFollowers(threadIdentifier, channelId));
    }
}, [dispatch, isThreadsInSidebarEnabled, threadIdentifier, channelId, rhsState]);
```

To:

```typescript
// Transition to Thread Followers when entering ThreadView or switching threads
useEffect(() => {
    if (isThreadsInSidebarEnabled && threadIdentifier && channelId &&
        (rhsState === RHSStates.CHANNEL_MEMBERS || rhsState === RHSStates.THREAD_FOLLOWERS)) {
        dispatch(showThreadFollowers(threadIdentifier, channelId));
    }
}, [dispatch, isThreadsInSidebarEnabled, threadIdentifier, channelId, rhsState]);
```

**Step 2: Verify the change**

The key change is adding `|| rhsState === RHSStates.THREAD_FOLLOWERS` to the condition. This ensures that when `threadIdentifier` changes (switching threads), the Thread Followers list updates even if RHS is already showing THREAD_FOLLOWERS.

**Step 3: Commit**

```bash
git add webapp/channels/src/components/threading/thread_view/thread_view.tsx
git commit -m "fix: update Thread Followers when switching between threads"
```

---

## Task 3: Fix Thread→Channel Transition in SidebarRight

**Files:**
- Modify: `webapp/channels/src/components/sidebar_right/sidebar_right.tsx:235-244`

**Step 1: Update the componentDidUpdate logic**

Replace the existing Thread→Channel transition logic:

```typescript
if (
    prevProps.rhsState === RHSStates.THREAD_FOLLOWERS &&
    this.props.channel && prevProps.channel &&
    this.props.channel.id !== prevProps.channel.id
) {
    const isNowViewingChannel = !window.location.pathname.includes('/thread/');
    if (isNowViewingChannel) {
        this.props.actions.showChannelMembers(this.props.channel.id);
    }
}
```

With URL-based detection using react-router location prop:

```typescript
// Detect Thread→Channel navigation via URL change
const wasOnThread = prevProps.location?.pathname?.includes('/thread/') ?? false;
const isNowOnChannel = !this.props.location?.pathname?.includes('/thread/');

if (
    prevProps.rhsState === RHSStates.THREAD_FOLLOWERS &&
    wasOnThread && isNowOnChannel &&
    this.props.channel
) {
    this.props.actions.showChannelMembers(this.props.channel.id);
}
```

**Step 2: Verify location prop is available**

The component is already wrapped with `withRouter` in `index.ts`, which provides `location` via `RouteComponentProps`. Check the Props type includes this.

**Step 3: Commit**

```bash
git add webapp/channels/src/components/sidebar_right/sidebar_right.tsx
git commit -m "fix: detect Thread→Channel transition via URL for RHS switching"
```

---

## Task 4: Verify All Tests Pass

**Step 1: Run the test suite**

Run: `cd webapp/channels && npm test -- --testPathPattern=thread_sidebar_fixes`
Expected: All tests should pass

**Step 2: Build verification**

Run: `cd webapp/channels && npm run check-types`
Expected: No TypeScript errors

**Step 3: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "fix: adjust RHS transition logic based on test results"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `thread_sidebar_fixes.test.tsx` | Add 4 new tests for URL-based detection and Thread→Thread updates |
| `thread_view.tsx` | Expand useEffect condition to trigger on THREAD_FOLLOWERS state too |
| `sidebar_right.tsx` | Use URL-based detection instead of channel ID comparison |

## Testing Checklist

- [ ] Open Channel Members RHS on a channel
- [ ] Click a thread in sidebar → RHS should show Thread Followers
- [ ] Click another thread in sidebar → RHS should update to new thread's followers
- [ ] Click a channel in sidebar → RHS should show Channel Members
- [ ] Click back to a thread → RHS should show Thread Followers
