// Unit tests for issue #34437 fix
// Tests the notification logic changes to prevent @all propagation in thread replies

package app

import (
	"testing"
	
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMentionsForPost_ThreadReplies(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := th.CreateTeam()
	channel := th.CreatePublicChannel()
	user1 := th.CreateUser()
	user2 := th.CreateUser()
	
	th.LinkUserToTeam(user1, team)
	th.LinkUserToTeam(user2, team)
	th.AddUserToChannel(user1, channel)
	th.AddUserToChannel(user2, channel)

	t.Run("@all in root post should create AllMentions", func(t *testing.T) {
		rootPost := &model.Post{
			Id:        model.NewId(),
			UserId:    user1.Id,
			ChannelId: channel.Id,
			Message:   "Important announcement @all please read!",
			RootId:    "", // Root post
		}
		
		mentions, err := th.App.GetMentionsForPost(rootPost, channel)
		require.NoError(t, err)
		assert.True(t, mentions.AllMentions, "Root post with @all should have AllMentions=true")
	})

	t.Run("@all in thread reply should NOT create AllMentions", func(t *testing.T) {
		rootPost := th.CreatePost(channel)
		
		threadReply := &model.Post{
			Id:        model.NewId(),
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   "I agree with this @all",
			RootId:    rootPost.Id, // Thread reply
		}
		
		mentions, err := th.App.GetMentionsForPost(threadReply, channel)
		require.NoError(t, err)
		assert.False(t, mentions.AllMentions, "Thread reply with @all should NOT have AllMentions=true")
	})

	t.Run("@channel in thread reply should NOT create ChannelMentions", func(t *testing.T) {
		rootPost := th.CreatePost(channel)
		
		threadReply := &model.Post{
			Id:        model.NewId(),
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   "Hey @channel what do you think?",
			RootId:    rootPost.Id,
		}
		
		mentions, err := th.App.GetMentionsForPost(threadReply, channel)
		require.NoError(t, err)
		assert.False(t, mentions.ChannelMentions, "Thread reply with @channel should NOT have ChannelMentions=true")
	})

	t.Run("@here in thread reply should NOT create HereMentions", func(t *testing.T) {
		rootPost := th.CreatePost(channel)
		
		threadReply := &model.Post{
			Id:        model.NewId(),
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   "Quick question @here",
			RootId:    rootPost.Id,
		}
		
		mentions, err := th.App.GetMentionsForPost(threadReply, channel)
		require.NoError(t, err)
		assert.False(t, mentions.HereMentions, "Thread reply with @here should NOT have HereMentions=true")
	})

	t.Run("regular user mentions in thread replies should work normally", func(t *testing.T) {
		rootPost := th.CreatePost(channel)
		
		threadReply := &model.Post{
			Id:        model.NewId(),
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   "Thanks @" + user1.Username + " for the info!",
			RootId:    rootPost.Id,
		}
		
		mentions, err := th.App.GetMentionsForPost(threadReply, channel)
		require.NoError(t, err)
		
		// Regular user mentions should still work
		assert.Contains(t, mentions.OtherPotentialMentions, user1.Username)
	})
}

func TestGetNotificationRecipientsForPost_ThreadBehavior(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := th.CreateTeam()
	channel := th.CreatePublicChannel()
	user1 := th.CreateUser() // Original poster
	user2 := th.CreateUser() // Thread participant
	user3 := th.CreateUser() // Channel member (not in thread)
	user4 := th.CreateUser() // Mentioned user
	
	th.LinkUserToTeam(user1, team)
	th.LinkUserToTeam(user2, team)
	th.LinkUserToTeam(user3, team)
	th.LinkUserToTeam(user4, team)
	th.AddUserToChannel(user1, channel)
	th.AddUserToChannel(user2, channel)
	th.AddUserToChannel(user3, channel)
	th.AddUserToChannel(user4, channel)

	// Create root post with @all
	rootPost := &model.Post{
		Id:        model.NewId(),
		UserId:    user1.Id,
		ChannelId: channel.Id,
		Message:   "Important announcement @all",
		RootId:    "",
	}
	rootPost, _ = th.App.CreatePost(th.Context, rootPost, channel, false, true)

	// Create thread reply from user2
	threadReply1 := &model.Post{
		Id:        model.NewId(),
		UserId:    user2.Id,
		ChannelId: channel.Id,
		Message:   "Thanks for the update!",
		RootId:    rootPost.Id,
	}
	threadReply1, _ = th.App.CreatePost(th.Context, threadReply1, channel, false, true)

	t.Run("root post with @all should notify everyone", func(t *testing.T) {
		mentions, err := th.App.GetMentionsForPost(rootPost, channel)
		require.NoError(t, err)
		
		recipients, err := th.App.GetNotificationRecipientsForPost(rootPost, channel, mentions)
		require.NoError(t, err)
		
		// Should include all channel members except the poster
		expectedRecipients := []string{user2.Id, user3.Id, user4.Id}
		assert.ElementsMatch(t, expectedRecipients, recipients)
	})

	t.Run("thread reply should only notify thread participants", func(t *testing.T) {
		threadReply2 := &model.Post{
			Id:        model.NewId(),
			UserId:    user3.Id, // user3 joining the thread
			ChannelId: channel.Id,
			Message:   "I have a question about this",
			RootId:    rootPost.Id,
		}
		
		mentions, err := th.App.GetMentionsForPost(threadReply2, channel)
		require.NoError(t, err)
		
		recipients, err := th.App.GetNotificationRecipientsForPost(threadReply2, channel, mentions)
		require.NoError(t, err)
		
		// Should only include thread participants (user1 and user2)
		// user4 should NOT be notified even though they were notified for the original @all
		expectedRecipients := []string{user1.Id, user2.Id}
		assert.ElementsMatch(t, expectedRecipients, recipients)
	})

	t.Run("thread reply with explicit mention should notify mentioned user", func(t *testing.T) {
		threadReply3 := &model.Post{
			Id:        model.NewId(),
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   "Hey @" + user4.Username + " what do you think about this?",
			RootId:    rootPost.Id,
		}
		
		mentions, err := th.App.GetMentionsForPost(threadReply3, channel)
		require.NoError(t, err)
		
		recipients, err := th.App.GetNotificationRecipientsForPost(threadReply3, channel, mentions)
		require.NoError(t, err)
		
		// Should include thread participants AND the explicitly mentioned user
		expectedRecipients := []string{user1.Id, user3.Id, user4.Id} // user3 joined earlier, user4 explicitly mentioned
		assert.ElementsMatch(t, expectedRecipients, recipients)
	})

	t.Run("thread reply with @all should NOT notify entire channel", func(t *testing.T) {
		// Create additional users who are NOT in the thread
		user5 := th.CreateUser()
		user6 := th.CreateUser()
		th.LinkUserToTeam(user5, team)
		th.LinkUserToTeam(user6, team)
		th.AddUserToChannel(user5, channel)
		th.AddUserToChannel(user6, channel)
		
		threadReplyWithAll := &model.Post{
			Id:        model.NewId(),
			UserId:    user2.Id,
			ChannelId: channel.Id,
			Message:   "This affects @all of us in this discussion",
			RootId:    rootPost.Id,
		}
		
		mentions, err := th.App.GetMentionsForPost(threadReplyWithAll, channel)
		require.NoError(t, err)
		
		recipients, err := th.App.GetNotificationRecipientsForPost(threadReplyWithAll, channel, mentions)
		require.NoError(t, err)
		
		// Should NOT include user5 and user6 who aren't in the thread
		// Should only include thread participants
		expectedRecipients := []string{user1.Id, user3.Id} // Only thread participants
		assert.ElementsMatch(t, expectedRecipients, recipients)
		
		// Verify that @all was ignored
		assert.False(t, mentions.AllMentions, "@all should be ignored in thread replies")
	})
}

func TestGetThreadParticipants(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := th.CreateTeam()
	channel := th.CreatePublicChannel()
	user1 := th.CreateUser()
	user2 := th.CreateUser()
	user3 := th.CreateUser()
	
	th.LinkUserToTeam(user1, team)
	th.LinkUserToTeam(user2, team)
	th.LinkUserToTeam(user3, team)
	th.AddUserToChannel(user1, channel)
	th.AddUserToChannel(user2, channel)
	th.AddUserToChannel(user3, channel)

	// Create root post
	rootPost := th.CreatePost(channel)
	
	// Create thread replies
	threadReply1 := &model.Post{
		UserId:    user2.Id,
		ChannelId: channel.Id,
		Message:   "First reply",
		RootId:    rootPost.Id,
	}
	th.CreatePost(channel, threadReply1)
	
	threadReply2 := &model.Post{
		UserId:    user3.Id,
		ChannelId: channel.Id,
		Message:   "Second reply",
		RootId:    rootPost.Id,
	}
	th.CreatePost(channel, threadReply2)
	
	threadReply3 := &model.Post{
		UserId:    user2.Id, // user2 replies again
		ChannelId: channel.Id,
		Message:   "Third reply",
		RootId:    rootPost.Id,
	}
	th.CreatePost(channel, threadReply3)

	t.Run("should return unique thread participants", func(t *testing.T) {
		participants, err := th.App.GetThreadParticipants(rootPost.Id)
		require.NoError(t, err)
		
		// Should include root post author and all reply authors (unique)
		expectedParticipants := []string{rootPost.UserId, user2.Id, user3.Id}
		assert.ElementsMatch(t, expectedParticipants, participants)
		assert.Len(t, participants, 3, "Should have exactly 3 unique participants")
	})
}

func TestPostContainsChannelWideMentions(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testCases := []struct {
		name     string
		message  string
		expected bool
	}{
		{
			name:     "@all mention",
			message:  "Important update @all please read",
			expected: true,
		},
		{
			name:     "@channel mention",
			message:  "Hey @channel what's the status?",
			expected: true,
		},
		{
			name:     "@here mention",
			message:  "Quick question @here",
			expected: true,
		},
		{
			name:     "regular user mention",
			message:  "Thanks @john for the help",
			expected: false,
		},
		{
			name:     "no mentions",
			message:  "Just a regular message",
			expected: false,
		},
		{
			name:     "multiple channel mentions",
			message:  "Urgent @all and @here please respond",
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := th.App.PostContainsChannelWideMentions(tc.message)
			assert.Equal(t, tc.expected, result)
		})
	}
}