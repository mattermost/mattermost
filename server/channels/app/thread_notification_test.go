// Corrected test file for thread notification fix
// File: server/channels/app/thread_notification_test.go

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestThreadNotificationFilter(t *testing.T) {
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

	t.Run("should filter @all mentions in thread replies", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Starting a discussion",
		}
		
		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)
		
		// Create thread reply with @all (should be filtered out)
		threadReply := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "@all I agree with the above",
		}
		
		// Test mention filtering for thread reply
		filter, err := th.App.filterThreadMentions(th.Context, threadReply, nil)
		require.NoError(t, err)
		
		// @all should be ignored in thread reply
		assert.False(t, filter.AllMentioned, "@all should be ignored in thread replies")
		assert.False(t, filter.ChannelMentioned, "@channel should be ignored in thread replies")
		assert.False(t, filter.HereMentioned, "@here should be ignored in thread replies")
	})

	t.Run("should allow @all mentions in root posts", func(t *testing.T) {
		// Create root post with @all mention
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all This is important for everyone",
		}
		
		// Test mention filtering for root post
		filter, err := th.App.filterThreadMentions(th.Context, rootPost, nil)
		require.NoError(t, err)
		
		// @all should work in root posts
		assert.True(t, filter.AllMentioned, "@all should work in root posts")
	})

	t.Run("should include thread participants in notifications", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Starting a discussion",
		}
		
		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)
		
		// User2 replies to thread
		reply1 := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "I have thoughts on this",
		}
		
		reply1, err = th.App.CreatePost(th.Context, reply1, channel, false, true)
		require.NoError(t, err)
		
		// Test getting thread participants
		participants, err := th.App.getThreadParticipantIds(th.Context, rootPost.Id)
		require.NoError(t, err)
		
		// Should include root post author and reply authors
		assert.Contains(t, participants, user1.Id, "Root post author should be thread participant")
		assert.Contains(t, participants, user2.Id, "Reply author should be thread participant")
	})

	t.Run("should handle explicit user mentions in thread replies", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Discussion topic",
		}
		
		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)
		
		// Create thread reply with explicit user mention
		threadReply := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "@" + user3.Username + " what do you think?",
		}
		
		// Test mention filtering
		filter, err := th.App.filterThreadMentions(th.Context, threadReply, nil)
		require.NoError(t, err)
		
		// Should include explicitly mentioned user
		assert.Contains(t, filter.MentionedUserIds, user3.Id, "Explicitly mentioned user should be included")
		assert.False(t, filter.AllMentioned, "@all should still be ignored")
	})

	t.Run("should identify channel-wide mentions correctly", func(t *testing.T) {
		app := th.App
		
		// Test channel-wide mention identification
		assert.True(t, app.isChannelWideMention("all"))
		assert.True(t, app.isChannelWideMention("channel"))
		assert.True(t, app.isChannelWideMention("here"))
		
		// Test regular mentions
		assert.False(t, app.isChannelWideMention("username"))
		assert.False(t, app.isChannelWideMention(""))
	})
}

func TestEnhancedNotificationRecipients(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	// Create test users and channel
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

	t.Run("should calculate correct recipients for thread replies", func(t *testing.T) {
		// Create root post
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Original message",
		}
		
		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)
		
		// Create thread reply
		threadReply := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "Reply message",
		}
		
		// Test notification recipients calculation
		recipients, err := th.App.enhancedNotificationRecipients(th.Context, threadReply, channel)
		require.NoError(t, err)
		
		// Should notify thread participants (excluding the sender)
		assert.Contains(t, recipients, user1.Id, "Should notify root post author")
		assert.NotContains(t, recipients, user2.Id, "Should not notify the sender")
	})

	t.Run("should calculate correct recipients for root post @all", func(t *testing.T) {
		// Create root post with @all
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all Important announcement",
		}
		
		// Test notification recipients calculation
		recipients, err := th.App.enhancedNotificationRecipients(th.Context, rootPost, channel)
		require.NoError(t, err)
		
		// Should notify all channel members (excluding sender)
		assert.Contains(t, recipients, user2.Id, "Should notify all channel members")
		assert.Contains(t, recipients, user3.Id, "Should notify all channel members") 
		assert.NotContains(t, recipients, user1.Id, "Should not notify the sender")
	})
}

func TestUpdatePostNotifications(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	// Create test data
	user := th.CreateUser()
	team := th.CreateTeam()
	channel := th.CreatePublicChannel()
	
	th.LinkUserToTeam(user, team)
	th.AddUserToChannel(user, channel)

	t.Run("should update post notifications successfully", func(t *testing.T) {
		// Create test post
		post := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Test message",
		}
		
		// Test notification update
		err := th.App.UpdatePostNotifications(th.Context, post, channel)
		assert.NoError(t, err, "Should update notifications without error")
	})

	t.Run("should handle thread reply notifications", func(t *testing.T) {
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
		
		// Test notification update for thread reply
		err = th.App.UpdatePostNotifications(th.Context, threadReply, channel)
		assert.NoError(t, err, "Should update thread reply notifications without error")
	})
}