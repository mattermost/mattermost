package main

import (
	"context"
	"fmt"
	"time"
)

func (tr *TestRunner) runMembershipTests(ctx context.Context) error {
	tr.logger.Info("=== Membership Sync Tests ===")

	channelA, channelB, err := tr.setupSharedChannel(ctx, "membership-test")
	if err != nil {
		tr.fail("membership/setup", err.Error())
		return err
	}

	// Create test users
	userIDs := make([]string, 3)
	for i := range 3 {
		name := fmt.Sprintf("memtest%d", i+1)
		id, err := tr.createTestUser(ctx, name)
		if err != nil {
			tr.fail("membership/create-user-"+name, err.Error())
			return err
		}
		userIDs[i] = id
	}

	// ── Test: Add users and verify sync ─────────────────────
	tr.logger.Info("Adding users to shared channel...")
	for i, uid := range userIDs {
		_, _, err := tr.clientA.AddChannelMember(ctx, channelA, uid)
		if err != nil {
			tr.fail(fmt.Sprintf("membership/add-user-%d", i+1), err.Error())
			return err
		}
	}

	tr.logger.Info("Waiting for membership sync...")
	for i := range 3 {
		name := fmt.Sprintf("memtest%d", i+1)
		testName := "membership/add-sync-" + name
		err := tr.waitFor(ctx, 30*time.Second, func() bool {
			return tr.verifyMemberOnB(ctx, channelB, name)
		})
		if err != nil {
			tr.fail(testName, fmt.Sprintf("user %s did not sync to Server B: %v", name, err))
		} else {
			tr.pass(testName)
		}
	}

	// ── Test: Remove one user and verify sync ───────────────
	tr.logger.Info("Removing memtest3 from shared channel...")
	_, err = tr.clientA.RemoveUserFromChannel(ctx, channelA, userIDs[2])
	if err != nil {
		tr.fail("membership/remove-memtest3", err.Error())
	} else {
		testName := "membership/remove-sync-memtest3"
		err := tr.waitFor(ctx, 30*time.Second, func() bool {
			return !tr.verifyMemberOnB(ctx, channelB, "memtest3")
		})
		if err != nil {
			tr.fail(testName, "memtest3 still present on Server B after removal")
		} else {
			tr.pass(testName)
		}

		// Verify others still present
		for _, name := range []string{"memtest1", "memtest2"} {
			testName := "membership/still-present-" + name
			if tr.verifyMemberOnB(ctx, channelB, name) {
				tr.pass(testName)
			} else {
				tr.fail(testName, name+" unexpectedly missing after memtest3 removal")
			}
		}
	}

	// ── Test: Re-add removed user ───────────────────────────
	tr.logger.Info("Re-adding memtest3...")
	_, _, err = tr.clientA.AddChannelMember(ctx, channelA, userIDs[2])
	if err != nil {
		tr.fail("membership/re-add-memtest3", err.Error())
	} else {
		testName := "membership/re-add-sync-memtest3"
		err := tr.waitFor(ctx, 30*time.Second, func() bool {
			return tr.verifyMemberOnB(ctx, channelB, "memtest3")
		})
		if err != nil {
			tr.fail(testName, "memtest3 re-add did not sync to Server B")
		} else {
			tr.pass(testName)
		}
	}

	// ── Test: Bulk removal ──────────────────────────────────
	tr.logger.Info("Bulk removing all 3 users...")
	for _, uid := range userIDs {
		_, _ = tr.clientA.RemoveUserFromChannel(ctx, channelA, uid)
	}

	testName := "membership/bulk-remove-sync"
	err = tr.waitFor(ctx, 30*time.Second, func() bool {
		for i := range 3 {
			if tr.verifyMemberOnB(ctx, channelB, fmt.Sprintf("memtest%d", i+1)) {
				return false
			}
		}
		return true
	})
	if err != nil {
		tr.fail(testName, "not all users removed from Server B after bulk removal")
	} else {
		tr.pass(testName)
	}

	return nil
}

// verifyChannelMemberCount returns the number of members in a channel on Server B.
func (tr *TestRunner) verifyChannelMemberCount(ctx context.Context, channelB string) int {
	members, _, err := tr.clientB.GetChannelMembers(ctx, channelB, 0, 200, "")
	if err != nil {
		return -1
	}
	return len(members)
}
