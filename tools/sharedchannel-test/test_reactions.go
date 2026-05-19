package main

import (
	"context"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

func (tr *TestRunner) runReactionTests(ctx context.Context) error {
	tr.logger.Info("=== Reaction Sync Tests ===")

	channelA, channelB, err := tr.setupSharedChannel(ctx, "reaction-test")
	if err != nil {
		tr.fail("reaction/setup", err.Error())
		return err
	}

	// Get admin's user ID (the authenticated user on clientA)
	me, _, err := tr.clientA.GetMe(ctx, "")
	if err != nil {
		tr.fail("reaction/get-me", err.Error())
		return err
	}
	adminUserID := me.Id

	// Create a post to react to
	postMsg := "React to this! " + model.NewId()[:8]
	post, _, err := tr.clientA.CreatePost(ctx, &model.Post{
		ChannelId: channelA,
		Message:   postMsg,
	})
	if err != nil {
		tr.fail("reaction/create-post", err.Error())
		return err
	}

	// Wait for post to sync
	var postBID string
	if err := tr.waitFor(ctx, 30*time.Second, func() bool {
		postBID = tr.findPostOnB(ctx, channelB, postMsg)
		return postBID != ""
	}); err != nil {
		tr.fail("reaction/post-sync", "post did not sync to Server B before adding reactions")
		return err
	}

	// ── Test: Add reaction and verify sync ──────────────────
	tr.logger.Info("Adding reaction on Server A...")
	_, _, err = tr.clientA.SaveReaction(ctx, &model.Reaction{
		UserId:    adminUserID,
		PostId:    post.Id,
		EmojiName: "thumbsup",
	})
	if err != nil {
		tr.fail("reaction/add", err.Error())
		return err
	}

	testName := "reaction/sync-add"
	err = tr.waitFor(ctx, 30*time.Second, func() bool {
		return tr.hasReactionOnB(ctx, postBID, "thumbsup")
	})
	if err != nil {
		tr.fail(testName, "reaction did not sync to Server B")
	} else {
		tr.pass(testName)
	}

	// ── Test: Remove reaction and verify sync ───────────────
	tr.logger.Info("Removing reaction on Server A...")
	_, err = tr.clientA.DeleteReaction(ctx, &model.Reaction{
		UserId:    adminUserID,
		PostId:    post.Id,
		EmojiName: "thumbsup",
	})
	if err != nil {
		tr.fail("reaction/remove", err.Error())
	} else {
		testName := "reaction/sync-remove"
		err := tr.waitFor(ctx, 30*time.Second, func() bool {
			return !tr.hasReactionOnB(ctx, postBID, "thumbsup")
		})
		if err != nil {
			tr.fail(testName, "reaction removal did not sync to Server B")
		} else {
			tr.pass(testName)
		}
	}

	return nil
}

// hasReactionOnB checks if a post on Server B has a specific emoji reaction.
func (tr *TestRunner) hasReactionOnB(ctx context.Context, postID, emojiName string) bool {
	if postID == "" {
		return false
	}
	reactions, _, err := tr.clientB.GetReactions(ctx, postID)
	if err != nil {
		return false
	}
	for _, r := range reactions {
		if r.EmojiName == emojiName {
			return true
		}
	}
	return false
}
