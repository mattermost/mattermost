package main

import (
	"context"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
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
