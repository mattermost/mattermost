// Fix for issue #34437: Replying to @all should not notify the whole channel
// This patch modifies the notification logic to prevent @all mentions from 
// propagating to thread replies

// File: server/channels/app/notification.go (example implementation)

package app

import (
	"strings"
	
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// GetMentionsForPost returns the mentions for a post, excluding channel-wide mentions for thread replies
func (a *App) GetMentionsForPost(post *model.Post, channel *model.Channel) (*model.PostMentions, error) {
	// ...existing code...
	
	mentions := &model.PostMentions{
		Mentions:     make(map[string]bool),
		OtherPotentialMentions: make([]string, 0),
		HereMentions: false,
		AllMentions:  false,
		ChannelMentions: false,
	}
	
	// Check if this is a thread reply
	isThreadReply := post.RootId != ""
	
	// Parse mentions from post message
	possibleMentions := model.PossibleAtMentions(post.Message)
	
	for _, mention := range possibleMentions {
		switch mention {
		case model.ChannelMentions.All:
			// Only apply @all for root posts, not thread replies
			if !isThreadReply {
				mentions.AllMentions = true
			} else {
				// For thread replies, convert @all to a regular mention context
				mlog.Debug("Skipping @all mention propagation for thread reply", 
					mlog.String("post_id", post.Id),
					mlog.String("root_id", post.RootId))
			}
		case model.ChannelMentions.Channel:
			// Only apply @channel for root posts, not thread replies
			if !isThreadReply {
				mentions.ChannelMentions = true
			}
		case model.ChannelMentions.Here:
			// Only apply @here for root posts, not thread replies
			if !isThreadReply {
				mentions.HereMentions = true
			}
		default:
			// Regular user mentions work normally in threads
			mentions.OtherPotentialMentions = append(mentions.OtherPotentialMentions, mention)
		}
	}
	
	// ...existing code for processing user mentions...
	
	return mentions, nil
}

// GetNotificationRecipientsForPost determines who should be notified for a post
func (a *App) GetNotificationRecipientsForPost(post *model.Post, channel *model.Channel, mentions *model.PostMentions) ([]string, error) {
	var recipients []string
	
	// For thread replies, use thread-specific notification logic
	if post.RootId != "" {
		return a.getThreadReplyRecipients(post, channel, mentions)
	}
	
	// For root posts, use existing logic with @all support
	return a.getRootPostRecipients(post, channel, mentions)
}

// getThreadReplyRecipients handles notifications for thread replies
func (a *App) getThreadReplyRecipients(post *model.Post, channel *model.Channel, mentions *model.PostMentions) ([]string, error) {
	var recipients []string
	
	// Get thread participants (people who have posted in this thread)
	threadParticipants, err := a.GetThreadParticipants(post.RootId)
	if err != nil {
		return nil, err
	}
	
	// Add thread participants to recipients
	for _, participantId := range threadParticipants {
		if participantId != post.UserId { // Don't notify the poster
			recipients = append(recipients, participantId)
		}
	}
	
	// Add explicitly mentioned users (but not channel-wide mentions)
	for userId := range mentions.Mentions {
		if !contains(recipients, userId) && userId != post.UserId {
			recipients = append(recipients, userId)
		}
	}
	
	// Note: We explicitly do NOT add channel-wide mention recipients here
	// This is the core fix for issue #34437
	
	return recipients, nil
}

// getRootPostRecipients handles notifications for root posts (existing logic preserved)
func (a *App) getRootPostRecipients(post *model.Post, channel *model.Channel, mentions *model.PostMentions) ([]string, error) {
	var recipients []string
	
	// Handle @all, @channel, @here mentions for root posts
	if mentions.AllMentions || mentions.ChannelMentions || mentions.HereMentions {
		channelMembers, err := a.GetChannelMembers(channel.Id)
		if err != nil {
			return nil, err
		}
		
		for _, member := range channelMembers {
			if member.UserId != post.UserId {
				recipients = append(recipients, member.UserId)
			}
		}
	}
	
	// Add explicitly mentioned users
	for userId := range mentions.Mentions {
		if !contains(recipients, userId) && userId != post.UserId {
			recipients = append(recipients, userId)
		}
	}
	
	return recipients, nil
}

// GetThreadParticipants returns users who have participated in a thread
func (a *App) GetThreadParticipants(rootId string) ([]string, error) {
	// Query to get unique user IDs from posts in this thread
	posts, err := a.Srv().Store.Post().GetPostsInThread(rootId)
	if err != nil {
		return nil, err
	}
	
	participantMap := make(map[string]bool)
	var participants []string
	
	for _, post := range posts {
		if !participantMap[post.UserId] {
			participantMap[post.UserId] = true
			participants = append(participants, post.UserId)
		}
	}
	
	return participants, nil
}

// Helper function to check if slice contains string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// Additional helper: Check if a post contains channel-wide mentions
func (a *App) PostContainsChannelWideMentions(message string) bool {
	possibleMentions := model.PossibleAtMentions(message)
	
	for _, mention := range possibleMentions {
		if mention == model.ChannelMentions.All || 
		   mention == model.ChannelMentions.Channel || 
		   mention == model.ChannelMentions.Here {
			return true
		}
	}
	
	return false
}

// Update notification audit logging to reflect the change
func (a *App) logNotificationDecision(post *model.Post, recipientCount int, skippedChannelWide bool) {
	if post.RootId != "" && skippedChannelWide {
		mlog.Debug("Thread reply notification - skipped channel-wide mentions",
			mlog.String("post_id", post.Id),
			mlog.String("root_id", post.RootId),
			mlog.Int("recipient_count", recipientCount),
			mlog.String("reason", "thread_reply_no_channel_mentions"))
	}
}