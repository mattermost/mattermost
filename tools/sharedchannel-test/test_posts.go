package main

import (
	"context"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (tr *TestRunner) runPostTests(ctx context.Context) error {
	tr.logger.Info("=== Post Sync Tests ===")

	channelA, channelB, err := tr.setupSharedChannel(ctx, "post-test")
	if err != nil {
		tr.fail("post/setup", err.Error())
		return err
	}

	// Create a user and add to channel
	userID, err := tr.createTestUser(ctx, "postuser1")
	if err != nil {
		tr.fail("post/create-user", err.Error())
		return err
	}
	_, _, err = tr.clientA.AddChannelMember(ctx, channelA, userID)
	if err != nil {
		tr.fail("post/add-user-to-channel", err.Error())
		return err
	}

	// Wait for user to sync before posting
	if err := tr.waitFor(ctx, 15*time.Second, func() bool {
		return tr.verifyMemberOnB(ctx, channelB, "postuser1")
	}); err != nil {
		tr.fail("post/user-sync", "postuser1 did not sync to Server B before posting")
		return err
	}

	// ── Test: Create post and verify sync ───────────────────
	tr.logger.Info("Creating post on Server A...")
	postMessage := "Hello from Server A! " + model.NewId()[:8]
	post, _, err := tr.clientA.CreatePost(ctx, &model.Post{
		ChannelId: channelA,
		Message:   postMessage,
	})
	if err != nil {
		tr.fail("post/create", err.Error())
		return err
	}

	testName := "post/sync-create"
	err = tr.waitFor(ctx, 30*time.Second, func() bool {
		return tr.findPostOnB(ctx, channelB, postMessage) != ""
	})
	if err != nil {
		tr.fail(testName, "post did not sync to Server B")
	} else {
		tr.pass(testName)
	}

	// ── Test: Edit post and verify sync ─────────────────────
	tr.logger.Info("Editing post on Server A...")
	editedMessage := "Edited: " + postMessage
	post.Message = editedMessage
	_, _, err = tr.clientA.UpdatePost(ctx, post.Id, post)
	if err != nil {
		tr.fail("post/edit", err.Error())
	} else {
		testName := "post/sync-edit"
		err := tr.waitFor(ctx, 30*time.Second, func() bool {
			return tr.findPostOnB(ctx, channelB, editedMessage) != ""
		})
		if err != nil {
			tr.fail(testName, "post edit did not sync to Server B")
		} else {
			tr.pass(testName)
		}
	}

	// ── Test: Delete post and verify sync ───────────────────
	tr.logger.Info("Deleting post on Server A...")
	_, err = tr.clientA.DeletePost(ctx, post.Id)
	if err != nil {
		tr.fail("post/delete", err.Error())
	} else {
		testName := "post/sync-delete"
		err := tr.waitFor(ctx, 30*time.Second, func() bool {
			return tr.findPostOnB(ctx, channelB, editedMessage) == ""
		})
		if err != nil {
			tr.fail(testName, "post delete did not sync to Server B")
		} else {
			tr.pass(testName)
		}
	}

	return nil
}

// runOfflineRecoveryTests verifies that messages posted while a remote is briefly
// offline (for less than the 5-minute IsOnline() threshold) are eventually synced
// once the remote comes back online — even though no new organic message triggers a
// sync and no connection-state flip occurs via the IsOnline() path.
//
// This exercises the recovery path added for MM-69792: a failed sync sets a flag in
// the remote cluster service, and the next successful ping fires a targeted resync.
//
// The test requires managing the Server B lifecycle, so it is skipped in unmanaged mode.
func (tr *TestRunner) runOfflineRecoveryTests(ctx context.Context) error {
	tr.logger.Info("=== Offline Recovery Tests ===")

	if !tr.cfg.Manage || tr.mgr == nil {
		tr.logger.Info("Skipping offline-recovery test (requires managed mode to stop/restart Server B)")
		return nil
	}

	channelA, channelB, err := tr.setupSharedChannel(ctx, "offline-recovery-test")
	if err != nil {
		tr.fail("post/offline-recovery-setup", err.Error())
		return err
	}

	// Create a user and add to the channel so posts have an author that syncs.
	userID, err := tr.createTestUser(ctx, "offlineuser1")
	if err != nil {
		tr.fail("post/offline-recovery-create-user", err.Error())
		return err
	}
	if _, _, err = tr.clientA.AddChannelMember(ctx, channelA, userID); err != nil {
		tr.fail("post/offline-recovery-add-user", err.Error())
		return err
	}
	if err := tr.waitFor(ctx, 15*time.Second, func() bool {
		return tr.verifyMemberOnB(ctx, channelB, "offlineuser1")
	}); err != nil {
		tr.fail("post/offline-recovery-user-sync", "offlineuser1 did not sync to Server B before posting")
		return err
	}

	testName := "post/offline-recovery"

	// Step 1: baseline sync works.
	m1 := "M1 baseline " + model.NewId()[:8]
	tr.logger.Info("Posting M1 (baseline) on Server A...")
	if _, _, err := tr.clientA.CreatePost(ctx, &model.Post{ChannelId: channelA, Message: m1}); err != nil {
		tr.fail(testName, "failed to create baseline post M1: "+err.Error())
		return nil
	}
	if err := tr.waitFor(ctx, 30*time.Second, func() bool {
		return tr.findPostOnB(ctx, channelB, m1) != ""
	}); err != nil {
		tr.fail(testName, "baseline post M1 did not sync to Server B")
		return nil
	}
	tr.logger.Info("Baseline post M1 synced to Server B")

	// Step 2: stop Server B.
	tr.mgr.StopServerB()

	// Step 3: post M2 and M3 while Server B is offline.
	m2 := "M2 during-outage " + model.NewId()[:8]
	m3 := "M3 during-outage " + model.NewId()[:8]
	tr.logger.Info("Posting M2 and M3 on Server A while Server B is offline...")
	for _, msg := range []string{m2, m3} {
		if _, _, err := tr.clientA.CreatePost(ctx, &model.Post{ChannelId: channelA, Message: msg}); err != nil {
			tr.fail(testName, "failed to create post during outage: "+err.Error())
			// Best effort: bring Server B back before returning so later tests can run.
			if startErr := tr.mgr.StartServerB(ctx); startErr != nil {
				tr.logger.Error("Failed to restart Server B", mlog.Err(startErr))
			}
			return nil
		}
	}

	// Step 4: wait long enough for send retries to exhaust, but short enough that
	// IsOnline() has not flipped (LastPingAt stays within the 5-minute window).
	tr.logger.Info("Waiting 90s for send retries to exhaust while Server B stays offline...")
	if err := interruptibleSleep(ctx, 90*time.Second); err != nil {
		return err
	}

	// Step 5: restart Server B.
	if err := tr.mgr.StartServerB(ctx); err != nil {
		tr.fail(testName, "failed to restart Server B: "+err.Error())
		return err
	}

	// Step 6: M2 and M3 must eventually appear on Server B via the recovery path.
	tr.logger.Info("Waiting up to 120s for M2 and M3 to sync to Server B after recovery...")
	if err := tr.waitFor(ctx, 120*time.Second, func() bool {
		return tr.findPostOnB(ctx, channelB, m2) != "" && tr.findPostOnB(ctx, channelB, m3) != ""
	}); err != nil {
		tr.fail(testName, "M2 and/or M3 did not sync to Server B after recovery")
		return nil
	}

	tr.pass(testName)
	return nil
}

// interruptibleSleep sleeps for d, returning early with an error if ctx is cancelled.
func interruptibleSleep(ctx context.Context, d time.Duration) error {
	select {
	case <-time.After(d):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// findPostOnB searches for a post with the given message in a channel on Server B.
// Returns the post ID if found, empty string otherwise.
func (tr *TestRunner) findPostOnB(ctx context.Context, channelB, message string) string {
	postList, _, err := tr.clientB.GetPostsForChannel(ctx, channelB, 0, 100, "", false, false)
	if err != nil {
		return ""
	}
	for _, post := range postList.Posts {
		if post.Message == message {
			return post.Id
		}
	}
	return ""
}
