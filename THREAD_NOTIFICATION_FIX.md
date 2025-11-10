# Thread Notification Fix - Issue #34437

## Overview
This fix prevents @all, @channel, and @here mentions from propagating to thread replies, 
eliminating notification spam when people reply to threads that started with channel-wide mentions.

## Changes Made

### Backend Changes
1. **Modified mention parsing** - Thread replies ignore channel-wide mentions
2. **Updated notification recipients** - Thread replies only notify thread participants
3. **Added thread participant tracking** - Efficiently identifies who should be notified

### Key Functions
- `shouldSkipChannelWideMention()` - Determines if channel-wide mentions should be ignored
- `GetThreadParticipants()` - Returns users who have participated in a thread
- Enhanced mention parsing logic in notification processing

## Behavior Changes

### Before (Problematic)
- Root post with @all → Notifies everyone ✅
- Reply to that thread → Notifies everyone again ❌ (causes spam)

### After (Fixed) 
- Root post with @all → Notifies everyone ✅
- Reply to that thread → Notifies only thread participants ✅

## Testing
Run the included tests to verify the fix:
```bash
go test -v ./server/channels/app -run ThreadNotification
```

## Impact
- Eliminates notification spam from thread replies
- Encourages healthy thread participation
- Maintains expected @all behavior for root posts
