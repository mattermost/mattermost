// Corrected test file for thread notification fix
// File: server/channels/app/notifications_test.go

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestThreadNotificationFix(t *testing.T) {
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

	t.Run("should not propagate @all mentions to thread replies", func(t *testing.T) {
		// Create root post with @all mention
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all Please check this important message",
		}
		
		rootPost, err := th.App.CreatePost(th.Context, rootPost, channel, false, true)
		require.NoError(t, err)
		
		// Create thread reply with @all (should be ignored)
		threadReply := &model.Post{
			UserId:    user2.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "@all I agree with the above",
		}
		
		// Test mention extraction for thread reply
		mentions, err := th.App.getExplicitMentionsFromPost(th.Context, threadReply, nil)
		require.NoError(t, err)
		
		// @all should be ignored in thread reply
		assert.False(t, mentions.AllMentioned, "@all should be ignored in thread replies")
		assert.False(t, mentions.ChannelMentioned, "@channel should be ignored in thread replies")
		assert.False(t, mentions.HereMentioned, "@here should be ignored in thread replies")
	})

	t.Run("should allow @all mentions in root posts", func(t *testing.T) {
		// Create root post with @all mention
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all This is important for everyone",
		}
		
		// Test mention extraction for root post
		mentions, err := th.App.getExplicitMentionsFromPost(th.Context, rootPost, nil)
		require.NoError(t, err)
		
		// @all should work in root posts
		assert.True(t, mentions.AllMentioned, "@all should work in root posts")
	})

	t.Run("should include thread participants in thread reply notifications", func(t *testing.T) {
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
		
		// User3 replies to thread (should notify user1 and user2 as participants)
		reply2 := &model.Post{
			UserId:    user3.Id,
			ChannelId: channel.Id,
			RootId:    rootPost.Id,
			Message:   "Adding to the discussion",
		}
		
		// Test getting thread participants
		participants, err := th.App.getThreadParticipants(th.Context, rootPost.Id)
		require.NoError(t, err)
		
		// Should include root post author and reply authors
		assert.Contains(t, participants, user1.Id, "Root post author should be thread participant")
		assert.Contains(t, participants, user2.Id, "Reply author should be thread participant")
		assert.Len(t, participants, 2, "Should have exactly 2 participants")
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
		
		// Test mention extraction
		mentions, err := th.App.getExplicitMentionsFromPost(th.Context, threadReply, nil)
		require.NoError(t, err)
		
		// Should include explicitly mentioned user
		assert.Contains(t, mentions.MentionedUserIds, user3.Id, "Explicitly mentioned user should be included")
		assert.False(t, mentions.AllMentioned, "@all should still be ignored")
	})

	t.Run("should identify channel-wide mentions correctly", func(t *testing.T) {
		app := th.App
		
		// Test all channel-wide mention types
		assert.True(t, app.isChannelWideMention(model.CHANNEL_MENTIONS_ALL))
		assert.True(t, app.isChannelWideMention(model.CHANNEL_MENTIONS_CHANNEL))
		assert.True(t, app.isChannelWideMention(model.CHANNEL_MENTIONS_HERE))
		
		// Test regular mentions
		assert.False(t, app.isChannelWideMention("username"))
		assert.False(t, app.isChannelWideMention(""))
	})
}

func TestSendNotifications(t *testing.T) {
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

	t.Run("should send notifications to correct recipients for thread replies", func(t *testing.T) {
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
		
		// Test notification sending
		recipients, err := th.App.SendNotifications(th.Context, threadReply, team, channel, user2, nil, false, false)
		require.NoError(t, err)
		
		// Should notify thread participants (excluding the sender)
		assert.Contains(t, recipients, user1.Id, "Should notify root post author")
		assert.NotContains(t, recipients, user2.Id, "Should not notify the sender")
	})

	t.Run("should send notifications to all members for root post @all", func(t *testing.T) {
		// Create root post with @all
		rootPost := &model.Post{
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "@all Important announcement",
		}
		
		// Test notification sending
		recipients, err := th.App.SendNotifications(th.Context, rootPost, team, channel, user1, nil, false, false)
		require.NoError(t, err)
		
		// Should notify all channel members (excluding sender)
		assert.Contains(t, recipients, user2.Id, "Should notify all channel members")
		assert.Contains(t, recipients, user3.Id, "Should notify all channel members") 
		assert.NotContains(t, recipients, user1.Id, "Should not notify the sender")
		assert.Len(t, recipients, 2, "Should notify exactly 2 users (all except sender)")
	})
}