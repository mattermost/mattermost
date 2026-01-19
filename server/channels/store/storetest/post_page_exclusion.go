// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// TestPostStorePageExclusion verifies that channel feed/pagination queries correctly
// exclude page-type posts. Pages should only appear in the wiki UI, not in channel feeds.
//
// Background: The Posts table contains multiple content types:
// - Regular messages (Type="" or Type=NULL)
// - Pages (Type="page") - displayed in wiki UI, NOT channel feed
// - Page comments (Type="page_comment") - displayed in channel feed
// - Page mentions (Type="page_mention") - system posts, excluded from feed
//
// These tests ensure that functions used for:
// - Channel feed display
// - Pagination (before/after)
// - ETags (cache invalidation)
// - Flagged posts lists
// - Time-based queries
// all correctly filter out page-type posts.
func TestPostStorePageExclusion(t *testing.T, rctx request.CTX, ss store.Store) {
	// Tests for functions fixed in this PR
	t.Run("GetFlaggedPosts excludes pages", func(t *testing.T) {
		testGetFlaggedPostsExcludesPages(t, rctx, ss)
	})
	t.Run("GetEtag ignores page updates", func(t *testing.T) {
		testGetEtagIgnoresPageUpdates(t, rctx, ss)
	})
	t.Run("GetPostsBefore excludes pages", func(t *testing.T) {
		testGetPostsBeforeExcludesPages(t, rctx, ss)
	})
	t.Run("GetPostsAfter excludes pages", func(t *testing.T) {
		testGetPostsAfterExcludesPages(t, rctx, ss)
	})
	t.Run("GetPostIdBeforeTime excludes pages", func(t *testing.T) {
		testGetPostIdBeforeTimeExcludesPages(t, rctx, ss)
	})
	t.Run("GetPostIdAfterTime excludes pages", func(t *testing.T) {
		testGetPostIdAfterTimeExcludesPages(t, rctx, ss)
	})
	t.Run("GetPostAfterTime excludes pages", func(t *testing.T) {
		testGetPostAfterTimeExcludesPages(t, rctx, ss)
	})
	t.Run("GetPostsCreatedAt excludes pages", func(t *testing.T) {
		testGetPostsCreatedAtExcludesPages(t, rctx, ss)
	})

	// Tests for functions that already had page filtering (regression tests)
	t.Run("GetPosts excludes pages", func(t *testing.T) {
		testGetPostsExcludesPages(t, rctx, ss)
	})
	t.Run("GetPostsSince excludes pages", func(t *testing.T) {
		testGetPostsSinceExcludesPages(t, rctx, ss)
	})
	t.Run("PermanentDeleteBatch preserves pages", func(t *testing.T) {
		testPermanentDeleteBatchPreservesPages(t, rctx, ss)
	})
	t.Run("GetDirectPostParentsForExportAfter excludes pages", func(t *testing.T) {
		testGetDirectPostParentsForExportAfterExcludesPages(t, rctx, ss)
	})
}

// testGetFlaggedPostsExcludesPages verifies that when a user flags both a regular message
// and a page, GetFlaggedPosts only returns the regular message.
func testGetFlaggedPostsExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Page Exclusion Test Channel",
		Name:        "pageexclusion" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userId := model.NewId()

	// Add user as channel member (required for GetFlaggedPosts)
	_, err = ss.Channel().SaveMember(rctx, &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      userId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	// Create a regular message
	regularPost, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Message:   "Regular message",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Create a page
	pagePost, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Message:   "Page Title",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)

	// Flag both posts
	err = ss.Preference().Save(model.Preferences{
		{
			UserId:   userId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     regularPost.Id,
			Value:    "true",
		},
		{
			UserId:   userId,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     pagePost.Id,
			Value:    "true",
		},
	})
	require.NoError(t, err)

	// Get flagged posts - should only return the regular message
	result, err := ss.Post().GetFlaggedPosts(userId, 0, 10)
	require.NoError(t, err)
	require.Len(t, result.Order, 1, "should return only 1 post (the regular message)")
	require.Contains(t, result.Posts, regularPost.Id, "should contain the regular message")
	require.NotContains(t, result.Posts, pagePost.Id, "should NOT contain the page")
}

// testGetEtagIgnoresPageUpdates verifies that creating or updating a page
// does not change the channel's ETag (which is used for feed caching).
func testGetEtagIgnoresPageUpdates(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "ETag Page Exclusion Test",
		Name:        "etagtest" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	// Create a regular message to establish baseline ETag
	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Baseline message",
		Type:      "",
	})
	require.NoError(t, err)

	// Get baseline ETag
	baselineEtag := ss.Post().GetEtag(channel.Id, false, false)
	require.NotEmpty(t, baselineEtag)

	time.Sleep(2 * time.Millisecond)

	// Create a page - should NOT change ETag
	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "New Page",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)

	// ETag should be unchanged
	afterPageEtag := ss.Post().GetEtag(channel.Id, false, false)
	require.Equal(t, baselineEtag, afterPageEtag, "ETag should not change after creating a page")

	time.Sleep(2 * time.Millisecond)

	// Create another regular message - should change ETag
	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Another message",
		Type:      "",
	})
	require.NoError(t, err)

	// ETag should now be different
	afterMessageEtag := ss.Post().GetEtag(channel.Id, false, false)
	require.NotEqual(t, baselineEtag, afterMessageEtag, "ETag should change after creating a regular message")
}

// testGetPostsBeforeExcludesPages verifies that pagination with GetPostsBefore
// skips over pages when finding posts before a given post.
func testGetPostsBeforeExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "PostsBefore Test",
		Name:        "postsbefore" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	// Create posts in order: message1 -> page -> message2 -> page -> message3
	message1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 1",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page 1",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	message2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 2",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page 2",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	message3, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 3",
		Type:      "",
	})
	require.NoError(t, err)

	// Get posts before message3 - should return message2 and message1, NOT pages
	result, err := ss.Post().GetPostsBefore(rctx, model.GetPostsOptions{
		ChannelId: channel.Id,
		PostId:    message3.Id,
		PerPage:   10,
	}, nil)
	require.NoError(t, err)
	require.Len(t, result.Posts, 2, "should return 2 posts (messages only)")
	require.Contains(t, result.Posts, message1.Id)
	require.Contains(t, result.Posts, message2.Id)

	// Verify order: message2 should come before message1 (newer first)
	require.Equal(t, message2.Id, result.Order[0])
	require.Equal(t, message1.Id, result.Order[1])
}

// testGetPostsAfterExcludesPages verifies that pagination with GetPostsAfter
// skips over pages when finding posts after a given post.
func testGetPostsAfterExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "PostsAfter Test",
		Name:        "postsafter" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	// Create posts in order: message1 -> page -> message2 -> page -> message3
	message1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 1",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page 1",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	message2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 2",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page 2",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	message3, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 3",
		Type:      "",
	})
	require.NoError(t, err)

	// Get posts after message1 - should return message2 and message3, NOT pages
	result, err := ss.Post().GetPostsAfter(rctx, model.GetPostsOptions{
		ChannelId: channel.Id,
		PostId:    message1.Id,
		PerPage:   10,
	}, nil)
	require.NoError(t, err)
	require.Len(t, result.Posts, 2, "should return 2 posts (messages only)")
	require.Contains(t, result.Posts, message2.Id)
	require.Contains(t, result.Posts, message3.Id)
}

// testGetPostIdBeforeTimeExcludesPages verifies that time-based navigation
// skips pages when finding the post ID before a timestamp.
func testGetPostIdBeforeTimeExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "PostIdBeforeTime Test",
		Name:        "postidbeforetime" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	// Create message1
	message1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 1",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Create a page
	page, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Create message2
	message2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 2",
		Type:      "",
	})
	require.NoError(t, err)

	// Get post ID before message2's time - should return message1, NOT the page
	postId, err := ss.Post().GetPostIdBeforeTime(channel.Id, message2.CreateAt, false)
	require.NoError(t, err)
	require.Equal(t, message1.Id, postId, "should return message1, not the page")
	require.NotEqual(t, page.Id, postId, "should NOT return the page")
}

// testGetPostIdAfterTimeExcludesPages verifies that time-based navigation
// skips pages when finding the post ID after a timestamp.
func testGetPostIdAfterTimeExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "PostIdAfterTime Test",
		Name:        "postidaftertime" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	// Create message1
	message1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 1",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Create a page
	page, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Create message2
	message2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 2",
		Type:      "",
	})
	require.NoError(t, err)

	// Get post ID after message1's time - should return message2, NOT the page
	postId, err := ss.Post().GetPostIdAfterTime(channel.Id, message1.CreateAt, false)
	require.NoError(t, err)
	require.Equal(t, message2.Id, postId, "should return message2, not the page")
	require.NotEqual(t, page.Id, postId, "should NOT return the page")
}

// testGetPostAfterTimeExcludesPages verifies that GetPostAfterTime
// skips pages when finding the first post after a timestamp.
func testGetPostAfterTimeExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "PostAfterTime Test",
		Name:        "postaftertime" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	baseTime := model.GetMillis()
	time.Sleep(2 * time.Millisecond)

	// Create a page first
	page, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Then create a message
	message, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message",
		Type:      "",
	})
	require.NoError(t, err)

	// Get post after baseTime - should return the message, NOT the page
	result, err := ss.Post().GetPostAfterTime(channel.Id, baseTime, false)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, message.Id, result.Id, "should return the message, not the page")
	require.NotEqual(t, page.Id, result.Id, "should NOT return the page")
}

// testGetPostsCreatedAtExcludesPages verifies that GetPostsCreatedAt
// excludes pages when finding posts created at a specific timestamp.
func testGetPostsCreatedAtExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "PostsCreatedAt Test",
		Name:        "postscreatedat" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	// Create both a message and a page at the same time
	targetTime := model.GetMillis()

	message, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message at target time",
		Type:      "",
		CreateAt:  targetTime,
	})
	require.NoError(t, err)

	page, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page at target time",
		Type:      model.PostTypePage,
		CreateAt:  targetTime,
	})
	require.NoError(t, err)

	// Get posts created at targetTime - should only return the message
	result, err := ss.Post().GetPostsCreatedAt(channel.Id, targetTime)
	require.NoError(t, err)
	require.Len(t, result, 1, "should return only 1 post (the message)")
	require.Equal(t, message.Id, result[0].Id, "should return the message")
	for _, p := range result {
		require.NotEqual(t, page.Id, p.Id, "should NOT return the page")
	}
}

// testGetPostsExcludesPages verifies that GetPosts (the main channel feed function)
// excludes pages from the results.
func testGetPostsExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "GetPosts Page Exclusion Test",
		Name:        "getposts" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	// Create posts: message1 -> page -> message2
	message1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 1",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	page, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page Title",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	message2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 2",
		Type:      "",
	})
	require.NoError(t, err)

	// GetPosts should return only messages, not pages
	result, err := ss.Post().GetPosts(rctx, model.GetPostsOptions{
		ChannelId: channel.Id,
		PerPage:   10,
	}, false, nil)
	require.NoError(t, err)
	require.Len(t, result.Posts, 2, "should return 2 posts (messages only)")
	require.Contains(t, result.Posts, message1.Id)
	require.Contains(t, result.Posts, message2.Id)
	require.NotContains(t, result.Posts, page.Id, "should NOT contain the page")
}

// testGetPostsSinceExcludesPages verifies that GetPostsSince excludes pages
// when fetching posts since a given time.
func testGetPostsSinceExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "GetPostsSince Page Exclusion Test",
		Name:        "getpostssince" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	// Create an initial message to establish baseline
	_, err = ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Baseline message",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	sinceTime := model.GetMillis()
	time.Sleep(2 * time.Millisecond)

	// Create posts after sinceTime: message1 -> page -> message2
	message1, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 1 after since",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	page, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Page after since",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	message2, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Message 2 after since",
		Type:      "",
	})
	require.NoError(t, err)

	// GetPostsSince should return only messages created after sinceTime, not pages
	result, err := ss.Post().GetPostsSince(rctx, model.GetPostsSinceOptions{
		ChannelId: channel.Id,
		Time:      sinceTime,
	}, false, nil)
	require.NoError(t, err)
	require.Len(t, result.Posts, 2, "should return 2 posts (messages only)")
	require.Contains(t, result.Posts, message1.Id)
	require.Contains(t, result.Posts, message2.Id)
	require.NotContains(t, result.Posts, page.Id, "should NOT contain the page")
}

// testPermanentDeleteBatchPreservesPages verifies that PermanentDeleteBatch
// does not delete pages - only regular messages should be affected by retention.
func testPermanentDeleteBatchPreservesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create channel
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "PermanentDeleteBatch Page Test",
		Name:        "deletebatch" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	// Create an old message (will be deleted)
	oldTime := model.GetMillis() - 1000000 // 1000 seconds ago
	oldMessage, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Old message to delete",
		Type:      "",
		CreateAt:  oldTime,
	})
	require.NoError(t, err)

	// Create an old page at the same time (should NOT be deleted)
	oldPage, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		Message:   "Old page to preserve",
		Type:      model.PostTypePage,
		CreateAt:  oldTime,
	})
	require.NoError(t, err)

	// Run PermanentDeleteBatch with endTime after both posts
	endTime := model.GetMillis() - 500000 // 500 seconds ago (after old posts)
	deleted, err := ss.Post().PermanentDeleteBatch(endTime, 100)
	require.NoError(t, err)
	require.Equal(t, int64(1), deleted, "should delete exactly 1 post (the message)")

	// Verify old message was deleted
	_, err = ss.Post().GetSingle(rctx, oldMessage.Id, false)
	require.Error(t, err, "old message should have been deleted")

	// Verify old page still exists
	preservedPage, err := ss.Post().GetSingle(rctx, oldPage.Id, false)
	require.NoError(t, err, "old page should NOT have been deleted")
	require.Equal(t, oldPage.Id, preservedPage.Id)
}

// testGetDirectPostParentsForExportAfterExcludesPages verifies that export
// functionality excludes pages from the export.
func testGetDirectPostParentsForExportAfterExcludesPages(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create users first (let the system assign IDs)
	user1, err := ss.User().Save(rctx, &model.User{
		Username: "exporttest1" + model.NewId(),
		Email:    model.NewId() + "@test.com",
		Password: model.NewId(),
	})
	require.NoError(t, err)

	user2, err := ss.User().Save(rctx, &model.User{
		Username: "exporttest2" + model.NewId(),
		Email:    model.NewId() + "@test.com",
		Password: model.NewId(),
	})
	require.NoError(t, err)

	// Create a direct message channel
	dmChannel, err := ss.Channel().SaveDirectChannel(rctx,
		&model.Channel{
			Name: model.GetDMNameFromIds(user1.Id, user2.Id),
			Type: model.ChannelTypeDirect,
		},
		&model.ChannelMember{
			UserId:      user1.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		},
		&model.ChannelMember{
			UserId:      user2.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		},
	)
	require.NoError(t, err)

	// Create a regular message in the DM
	message, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: dmChannel.Id,
		UserId:    user1.Id,
		Message:   "Direct message",
		Type:      "",
	})
	require.NoError(t, err)
	time.Sleep(2 * time.Millisecond)

	// Create a page in the DM (unusual but possible)
	page, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: dmChannel.Id,
		UserId:    user1.Id,
		Message:   "Page in DM",
		Type:      model.PostTypePage,
	})
	require.NoError(t, err)

	// Export should only include the message, not the page
	exports, err := ss.Post().GetDirectPostParentsForExportAfter(100, "", false)
	require.NoError(t, err)

	// Find our posts in the exports
	var foundMessage, foundPage bool
	for _, exp := range exports {
		if exp.Id == message.Id {
			foundMessage = true
		}
		if exp.Id == page.Id {
			foundPage = true
		}
	}

	require.True(t, foundMessage, "message should be in export")
	require.False(t, foundPage, "page should NOT be in export")
}
