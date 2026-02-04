# Fix Heartbeat Activity Detection

## Problem
The `UpdateActivityFromHeartbeat` function was incorrectly treating "window active" as manual activity even when no channel was selected (e.g., user is idle or in a state where no channel ID is reported). This caused `LastActivityAt` to be updated unnecessarily, potentially leading to inaccurate status tracking.

## Solution
Modified `server/channels/app/platform/status.go` to update the `isManualActivity` logic. Now, `windowActive` counts as manual activity only if a valid `channelID` is also present.

## Changes
1.  **Modified `server/channels/app/platform/status.go`**:
    *   Updated `isManualActivity` calculation: `isManualActivity := (windowActive && channelID != "") || channelChanged`

2.  **Modified `server/channels/app/platform/accurate_statuses_test.go`**:
    *   Added a new test case `when window is active but no active channel, should NOT update LastActivityAt` to `TestUpdateActivityFromHeartbeat` to verify the fix and prevent regression.

## Verification
Ran `go test -v -run TestUpdateActivityFromHeartbeat ./channels/app/platform` and verified that all tests, including the new case, pass.