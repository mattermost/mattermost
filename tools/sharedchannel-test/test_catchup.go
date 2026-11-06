package main

import (
	"context"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// runCatchUpTests verifies that changes to older posts made while the remote is
// offline all reach it after it comes back: edits, added and removed reactions,
// added and withdrawn acknowledgements, a reply and a delete, behind enough new
// posts to need several sync batches.
//
// The test requires managing the Server B lifecycle, so it is skipped in unmanaged mode.
func (tr *TestRunner) runCatchUpTests(ctx context.Context) error {
	tr.logger.Info("=== Outage Catch-up Tests ===")

	if !tr.cfg.Manage || tr.mgr == nil {
		tr.logger.Info("Skipping outage catch-up test (requires managed mode to stop/restart Server B)")
		return nil
	}

	channelA, channelB, err := tr.setupSharedChannel(ctx, "catchup-test")
	if err != nil {
		tr.fail("catchup/setup", err.Error())
		return err
	}
	users, err := tr.createContentUsers(ctx, "catchupuser", 3, channelA)
	if err != nil {
		tr.fail("catchup/create-users", err.Error())
		return err
	}
	if err := tr.waitForMembersOnB(ctx, channelB, users); err != nil {
		tr.fail("catchup/user-sync", "users did not sync to Server B before posting")
		return err
	}

	cr := newContentRun(tr, channelA, users)
	if err := cr.makeBase(ctx, 30); err != nil {
		tr.fail("catchup/base", err.Error())
		return err
	}

	// Keep this wait short: withdrawing an acknowledgement is only allowed within
	// five minutes of making it, and mutate withdraws some made by makeBase.
	if !tr.checkChannelsMatch(ctx, "catchup/base-synced", channelA, channelB, cr.labels, 2*time.Minute, time.Minute) {
		return nil
	}

	tr.mgr.StopServerB()

	tr.logger.Info("Changing older posts on Server A while Server B is offline...")
	if err := cr.mutate(ctx, 60); err != nil {
		tr.fail("catchup/mutate", err.Error())
		if startErr := tr.mgr.StartServerB(ctx); startErr != nil {
			tr.logger.Error("Failed to restart Server B", mlog.Err(startErr))
		}
		return nil
	}

	if err := tr.mgr.StartServerB(ctx); err != nil {
		tr.fail("catchup/restart", "failed to restart Server B: "+err.Error())
		return err
	}

	tr.logger.Info("Waiting for Server B to catch up...")
	tr.checkChannelsMatch(ctx, "catchup/all-changes-synced", channelA, channelB, cr.labels, 10*time.Minute, 2*time.Minute)
	return nil
}
