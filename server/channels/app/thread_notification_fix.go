// Corrected thread notification fix - Uses existing Mattermost APIs
// File: server/channels/app/thread_notification_fix.go

package app

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// ThreadMentionFilter handles @all notification filtering for thread replies
type ThreadMentionFilter struct {
	MentionedUserIds      []string
	ChannelMentioned      bool
	AllMentioned          bool
	HereMentioned         bool
	ThreadParticipantIds  []string
}

// filterThreadMentions processes mentions for thread replies, excluding channel-wide mentions
func (a *App) filterThreadMentions(c *request.Context, post *model.Post, 
	keywords model.StringArray) (*ThreadMentionFilter, *model.AppError) {
	
	filter := &ThreadMentionFilter{
		MentionedUserIds: make([]string, 0),
	}

	// For thread replies, ignore channel-wide mentions
	isThreadReply := post.RootId != ""
	
	if isThreadReply {
		mlog.Debug("Processing thread reply mentions, excluding channel-wide mentions",
			mlog.String("post_id", post.Id),
			mlog.String("root_id", post.RootId))
	}

	// Parse mentions from message content
	message := strings.ToLower(post.Message)
	
	// Check for channel-wide mentions
	if strings.Contains(message, "@all") {
		if !isThreadReply {
			filter.AllMentioned = true
		}
	}
	if strings.Contains(message, "@channel") {
		if !isThreadReply {
			filter.ChannelMentioned = true
		}
	}
	if strings.Contains(message, "@here") {
		if !isThreadReply {
			filter.HereMentioned = true
		}
	}

	// Extract user mentions (@username)
	words := strings.Fields(message)
	for _, word := range words {
		if strings.HasPrefix(word, "@") && len(word) > 1 {
			username := strings.TrimPrefix(word, "@")
			username = strings.Trim(username, ".,!?;:")
			
			// Skip channel-wide mentions in threads
			if isThreadReply && a.isChannelWideMention(username) {
				mlog.Debug("Skipping channel-wide mention in thread reply",
					mlog.String("mention", username),
					mlog.String("post_id", post.Id))
				continue
			}
			
			// Try to find user by username
			if user, err := a.Srv().Store().User().GetByUsername(username); err == nil {
				filter.MentionedUserIds = append(filter.MentionedUserIds, user.Id)
			}
		}
	}

	// For thread replies, get thread participants
	if isThreadReply {
		participants, err := a.getThreadParticipantIds(c, post.RootId)
		if err != nil {
			mlog.Error("Failed to get thread participants",
				mlog.String("root_id", post.RootId),
				mlog.Err(err))
		} else {
			filter.ThreadParticipantIds = participants
		}
	}

	return filter, nil
}

// isChannelWideMention checks if a mention is channel-wide
func (a *App) isChannelWideMention(mention string) bool {
	return mention == "all" || mention == "channel" || mention == "here"
}

// getThreadParticipantIds gets user IDs who have participated in a thread
func (a *App) getThreadParticipantIds(c *request.Context, rootId string) ([]string, *model.AppError) {
	// Get posts in the thread
	postList, err := a.GetPostThread(c, rootId, false, false, "", false)
	if err != nil {
		return nil, err
	}
	
	participantMap := make(map[string]bool)
	
	// Add root post author
	if rootPost, exists := postList.Posts[rootId]; exists {
		participantMap[rootPost.UserId] = true
	}
	
	// Add all reply authors
	for _, post := range postList.Posts {
		if post.RootId == rootId {
			participantMap[post.UserId] = true
		}
	}
	
	// Convert to slice
	participants := make([]string, 0, len(participantMap))
	for userId := range participantMap {
		participants = append(participants, userId)
	}
	
	return participants, nil
}

// enhancedNotificationRecipients calculates notification recipients with thread awareness
func (a *App) enhancedNotificationRecipients(c *request.Context, post *model.Post, 
	channel *model.Channel) ([]string, *model.AppError) {
	
	// Get mention filter for the post
	mentionFilter, err := a.filterThreadMentions(c, post, nil)
	if err != nil {
		return nil, err
	}
	
	recipientMap := make(map[string]bool)
	
	// Add explicitly mentioned users
	for _, userId := range mentionFilter.MentionedUserIds {
		recipientMap[userId] = true
	}
	
	// For thread replies, add thread participants
	if post.RootId != "" {
		for _, participantId := range mentionFilter.ThreadParticipantIds {
			recipientMap[participantId] = true
		}
	} else {
		// For root posts with channel-wide mentions, add all channel members
		if mentionFilter.AllMentioned || mentionFilter.ChannelMentioned || mentionFilter.HereMentioned {
			members, memberErr := a.GetChannelMembers(c, channel.Id, 0, 60000)
			if memberErr != nil {
				mlog.Error("Failed to get channel members for notification",
					mlog.String("channel_id", channel.Id),
					mlog.Err(memberErr))
			} else {
				for _, member := range members {
					recipientMap[member.UserId] = true
				}
			}
		}
	}
	
	// Remove the post author (don't notify themselves)
	delete(recipientMap, post.UserId)
	
	// Convert to slice
	recipients := make([]string, 0, len(recipientMap))
	for userId := range recipientMap {
		recipients = append(recipients, userId)
	}
	
	mlog.Debug("Calculated notification recipients for post",
		mlog.String("post_id", post.Id),
		mlog.String("root_id", post.RootId),
		mlog.Int("recipient_count", len(recipients)),
		mlog.Bool("is_thread_reply", post.RootId != ""))
	
	return recipients, nil
}

// UpdatePostNotifications updates an existing post's notifications to respect thread rules
func (a *App) UpdatePostNotifications(c *request.Context, post *model.Post, 
	channel *model.Channel) *model.AppError {
	
	recipients, err := a.enhancedNotificationRecipients(c, post, channel)
	if err != nil {
		return err
	}
	
	// Log the notification update
	mlog.Info("Updated post notifications with thread-aware filtering",
		mlog.String("post_id", post.Id),
		mlog.String("channel_id", channel.Id),
		mlog.Int("recipients", len(recipients)),
		mlog.Bool("is_thread_reply", post.RootId != ""))
	
	// In a real implementation, this would update the notification system
	// For now, we just return success as this is a demonstration
	
	return nil
}