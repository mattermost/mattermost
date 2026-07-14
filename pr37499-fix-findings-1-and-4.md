# Task: Fix two findings from the code review of PR #37499

Repo: mattermost/mattermost. Branch: `MM-69792_sync_offline_remote` (the PR branch — check
it out if not already on it). These are two findings from a review of that PR. For **each**
finding: first validate it against the actual code; if you conclude it's invalid or the fix
would cause a regression, **do not change anything for that finding** — instead reply with a
clear explanation of why. If valid, apply the **minimum** change required. Do not refactor
surrounding code, rename things, or "improve" unrelated lines.

When done, run:
- `cd server && go build ./...`
- `go test ./platform/services/remotecluster/... ./platform/services/sharedchannel/...`

---

## Finding 1 (moderate — observability): connection-state-change metric fires without a real state change

File: `server/platform/services/remotecluster/ping.go`, function `PingNow`.

Current code:

```go
if online != rc.IsOnline() || (pingSucceeded && hasPendingSync) {
    if metrics := rcs.server.GetMetrics(); metrics != nil {
        metrics.IncrementRemoteClusterConnStateChangeCounter(rc.RemoteId, rc.IsOnline())
    }
    rcs.fireConnectionStateChgEvent(rc)
}
```

Concern: On the new sync-failure-recovery path (`pingSucceeded && hasPendingSync`) the remote
was online both before and after the ping, so `IncrementRemoteClusterConnStateChangeCounter`
is now called for an online→online event. That inflates a counter whose purpose is to track
genuine online/offline transitions.

Validate:
- Confirm `IncrementRemoteClusterConnStateChangeCounter` is semantically a *transition* counter
  (grep its definition/usages under `server/` and any metrics docs). If it's actually intended
  to count "recovery events" too, reject this finding with that evidence.
- Confirm the event (`fireConnectionStateChgEvent`) must still fire on the pending-sync path —
  it's what drives `ForceSyncForRemote` on recovery. The fix must NOT suppress the event.

Candidate minimal fix (only the metric is gated; the event still fires in both cases):

```go
stateChanged := online != rc.IsOnline()
if stateChanged || (pingSucceeded && hasPendingSync) {
    if stateChanged {
        if metrics := rcs.server.GetMetrics(); metrics != nil {
            metrics.IncrementRemoteClusterConnStateChangeCounter(rc.RemoteId, rc.IsOnline())
        }
    }
    rcs.fireConnectionStateChgEvent(rc)
}
```

Note the existing tests `TestPingNow_SyncFailureRecovery` / `TestPingNow_NoSpuriousFire` in
`ping_test.go` assert on the *listener* firing, not the metric, so they should still pass. If a
test does assert the counter, update it to match the corrected semantics.

---

## Finding 4 (pre-existing; validate scope carefully): success returned when response payload is malformed/empty

File: `server/platform/services/sharedchannel/sync_send_remote.go`, function `sendSyncMsgToRemote`,
inside the `rcs.SendMsg(...)` callback.

Current code (the branch after the `errResp != nil` early return):

```go
var syncResp model.SyncResponse
if rcResp != nil && len(rcResp.Payload) > 0 {
    if err2 := json.Unmarshal(rcResp.Payload, &syncResp); err2 != nil {
        scs.server.Log().LogM(mlog.MlvlSharedChannelServiceWarn, "Invalid sync msg response from remote cluster",
            mlog.String("remote", rc.Name),
            mlog.String("channel_id", msg.ChannelId),
            mlog.Err(err2),
        )
        return
    }
    if f != nil {
        f(syncResp, errResp)
    }
} else {
    // No error but response is nil or empty
    scs.server.Log().LogM(mlog.MlvlSharedChannelServiceWarn, "Empty or nil response payload from remote cluster",
        mlog.String("remote", rc.Name),
        mlog.String("channel_id", msg.ChannelId),
    )
}
```

`sendErr` (the value the function returns after `wg.Wait()`) stays nil in the unmarshal-failure
branch and the empty-payload branch. So when the remote responds with an unparseable or empty
payload, the send is reported as success: the result callback `f` never runs (cursor does not
advance) yet the task is treated as done and is not retried — the same "stuck until next organic
change" symptom this PR fixes for delivery errors.

This is pre-existing (not introduced by the PR), but the PR restructured exactly this block, so a
minimal fix here is in-scope if justified. **The two sub-cases are not equivalent — validate them
separately:**

1. **Unmarshal failure**: we sent data and got a 200-level response we can't parse. This is
   almost certainly a real failure; the cursor shouldn't advance and a retry is appropriate.
   Candidate fix: set `sendErr = err2` (or a wrapped error) before `return` so it propagates and
   the task retries.

2. **Empty/nil payload**: determine whether an empty payload is ever a *legitimate* success
   response before treating it as an error. Check the receive side that produces the response —
   grep for where `SyncResponse` is marshaled into the reply (e.g. the incoming-msg handler in
   `sync_recv.go` / the topic listener) and confirm whether a successful sync can legitimately
   return an empty body. If empty is a valid success, do **not** turn it into an error — leave it
   (optionally add a one-line comment stating the non-retry is intentional). If empty is never
   valid on success, treat it like the unmarshal case and propagate an error.

Whatever you decide for each sub-case, state your reasoning in the reply. If you conclude both
sub-cases are pre-existing behavior that shouldn't change without broader discussion, it's
acceptable to reject the code change and instead add a short comment documenting the intentional
non-retry — but say so explicitly.

If you make unmarshal-failure (or empty) propagate an error, add/adjust a focused unit test in
`sync_send_test.go` modeled on `TestSendSyncMsgToRemote_PropagatesDeliveryFailure` (use the
existing `mockRCSForSync` pattern: have its `SendMsg` invoke the callback with `errResp == nil`
but a `*remotecluster.Response` carrying an unparseable/empty payload) asserting the error now
propagates.

---

## Constraints
- Minimum viable change per finding; no drive-by edits.
- Preserve existing behavior on the success and delivery-failure paths — those are already
  covered by tests and are correct.
- Do not touch the metric *event* firing on the recovery path (Finding 1) — only the counter.
- Report per finding: VALID (with the diff) or INVALID/REJECTED (with the reason).
