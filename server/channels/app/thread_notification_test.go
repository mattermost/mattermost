// Thread notification test - Final CI-compliant version
// File: server/channels/app/thread_notification_test.go

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProcessThreadMentions(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	// Create test users
	user1 := th.CreateUser()
	user2 := th.CreateUser()
	user3 := th.CreateUser()
	team := th.CreateTeam()
	channel := th.CreatePublicChannel()

	// Link users to team and channel
	th.LinkUserToTeam(user1, team)
	th.LinkUserToTeam(user2, team)
	th.LinkUserToTeam(user3, team)
	th.AddUserToChannel(user1, channel)
	th.AddUserToChannel(user2, channel)
	th.AddUserToChannel(user3, channel)

	t.Run("should filter channel-wide mentions in thread replies", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Starting a discussion",
		}

		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)

		// Create thread reply with @all mention
		threadReply := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "@all I agree with this",
		}

		// Process mentions for thread reply
		result, err := th.App.ProcessThreadMentions(th.Context, threadReply)
		require.NoError(t, err)

		// Channel-wide mentions should be filtered in thread replies
		assert.False(t, result.AllMentioned, "@all should be filtered in thread replies")
		assert.False(t, result.ChannelMentioned, "@channel should be filtered in thread replies")
		assert.False(t, result.HereMentioned, "@here should be filtered in thread replies")
	})

	t.Run("should allow channel-wide mentions in root posts", func(t *testing.T) {
		// Create root post with @all mention
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all This is important for everyone",
		}

		// Process mentions for root post
		result, err := th.App.ProcessThreadMentions(th.Context, rootPost)
		require.NoError(t, err)

		// Channel-wide mentions should be allowed in root posts
		assert.True(t, result.AllMentioned, "@all should be allowed in root posts")
	})

	t.Run("should include thread participants in thread replies", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Discussion starter",
		}

		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)

		// User2 replies to create thread participation
		reply1 := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "First reply",
		}

		_, err = th.App.CreatePost(th.Context, reply1, channel, false, true)
		require.NoError(t, err)

		// Process another thread reply
		reply2 := &model.Post{
			UserId:    user3.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "Second reply",
		}

		result, err := th.App.ProcessThreadMentions(th.Context, reply2)
		require.NoError(t, err)

		// Should include thread participants
		assert.Contains(t, result.ThreadParticipantIds, user1.Id, "Root author should be participant")
		assert.Contains(t, result.ThreadParticipantIds, user2.Id, "Reply author should be participant")
	})

	t.Run("should handle explicit user mentions", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Discussion topic",
		}

		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)

		// Create thread reply with explicit mention
		threadReply := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "@" + user3.Username + " what are your thoughts?",
		}

		result, err := th.App.ProcessThreadMentions(th.Context, threadReply)
		require.NoError(t, err)

		// Should include explicitly mentioned user
		assert.Contains(t, result.MentionedUserIds, user3.Id, "Explicitly mentioned user should be included")
	})

	t.Run("should identify channel-wide mention keywords", func(t *testing.T) {
		app := th.App

		// Test channel-wide mention keyword detection
		assert.True(t, app.isChannelWideMentionKeyword("all"))
		assert.True(t, app.isChannelWideMentionKeyword("channel"))
		assert.True(t, app.isChannelWideMentionKeyword("here"))

		// Test non-channel-wide keywords
		assert.False(t, app.isChannelWideMentionKeyword("user"))
		assert.False(t, app.isChannelWideMentionKeyword(""))
		assert.False(t, app.isChannelWideMentionKeyword("everyone"))
	})
}

func TestGetThreadParticipants(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	// Create test users
	user1 := th.CreateUser()
	user2 := th.CreateUser()
	user3 := th.CreateUser()
	team := th.CreateTeam()
	channel := th.CreatePublicChannel()

	th.LinkUserToTeam(user1, team)
	th.LinkUserToTeam(user2, team)
	th.LinkUserToTeam(user3, team)
	th.AddUserToChannel(user1, channel)
	th.AddUserToChannel(user2, channel)
	th.AddUserToChannel(user3, channel)

	t.Run("should get participants from thread", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Root message",
		}

		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)

		// Create thread replies
		reply1 := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "First reply",
		}

		_, err = th.App.CreatePost(th.Context, reply1, channel, false, true)
		require.NoError(t, err)

		reply2 := &model.Post{
			UserId:    user3.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "Second reply",
		}

		_, err = th.App.CreatePost(th.Context, reply2, channel, false, true)
		require.NoError(t, err)

		// Get thread participants
		participants, err := th.App.getThreadParticipants(th.Context, rootPost.Id)
		require.NoError(t, err)

		// Should include all participants
		assert.Contains(t, participants, user1.Id, "Root author should be participant")
		assert.Contains(t, participants, user2.Id, "First reply author should be participant")
		assert.Contains(t, participants, user3.Id, "Second reply author should be participant")
		assert.Len(t, participants, 3, "Should have exactly 3 participants")
	})
}

func TestCalculateThreadAwareNotificationRecipients(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	// Create test data
	user1 := th.CreateUser()
	user2 := th.CreateUser()
	user3 := th.CreateUser()
	team := th.CreateTeam()
	channel := th.CreatePublicChannel()

	th.LinkUserToTeam(user1, team)
	th.LinkUserToTeam(user2, team)
	th.LinkUserToTeam(user3, team)
	th.AddUserToChannel(user1, channel)
	th.AddUserToChannel(user2, channel)
	th.AddUserToChannel(user3, channel)

	t.Run("should calculate recipients for thread replies correctly", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Root message",
		}

		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)

		// Create thread reply
		threadReply := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "Thread reply",
		}

		// Calculate recipients
		recipients, err := th.App.CalculateThreadAwareNotificationRecipients(th.Context, threadReply, channel)
		require.NoError(t, err)

		// Should notify thread participants (excluding sender)
		assert.Contains(t, recipients, user1.Id, "Should notify root post author")
		assert.NotContains(t, recipients, user2.Id, "Should not notify sender")
	})

	t.Run("should calculate recipients for root post @all correctly", func(t *testing.T) {
		// Create root post with @all
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all Important announcement",
		}

		// Calculate recipients
		recipients, err := th.App.CalculateThreadAwareNotificationRecipients(th.Context, rootPost, channel)
		require.NoError(t, err)

		// Should notify all channel members (excluding sender)
		assert.Contains(t, recipients, user2.Id, "Should notify all channel members")
		assert.Contains(t, recipients, user3.Id, "Should notify all channel members")
		assert.NotContains(t, recipients, user1.Id, "Should not notify sender")
	})
}

func TestApplyThreadNotificationFilter(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	// Create test data
	user := th.CreateUser()
	team := th.CreateTeam()
	channel := th.CreatePublicChannel()

	th.LinkUserToTeam(user, team)
	th.AddUserToChannel(user, channel)

	t.Run("should apply filter without error", func(t *testing.T) {
		// Create test post
		post := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Test message",
		}

		// Apply filter
		err := th.App.ApplyThreadNotificationFilter(th.Context, post, channel)
		assert.NoError(t, err, "Should apply filter without error")
	})

	t.Run("should handle thread reply filter application", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Root message",
		}

		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)

		// Create thread reply
		threadReply := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "Thread reply",
		}

		// Apply filter to thread reply
		err = th.App.ApplyThreadNotificationFilter(th.Context, threadReply, channel)
		assert.NoError(t, err, "Should apply filter to thread reply without error")
	})
}
