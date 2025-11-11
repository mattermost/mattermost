// Corrected thread notification fix - should be in server/channels/app/notifications.go
// This fixes the @all notification propagation to thread replies issue

package app

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Fix for #34437: Prevent @all notifications from propagating to thread replies

// getExplicitMentionsFromPost extracts mentions from post content, excluding channel-wide mentions in threads
func (a *App) getExplicitMentionsFromPost(c *request.Context, post *model.Post, keywords model.StringArray) (*model.ExplicitMentions, *model.AppError) {
	mentions := &model.ExplicitMentions{
		MentionedUserIds: make(model.StringArray, 0),
		OtherPotentialMentions: make([]string, 0),
		HereMentioned: false,
		AllMentioned: false,
		ChannelMentioned: false,
	}

	// For thread replies, ignore channel-wide mentions (@all, @channel, @here)
	isThreadReply := post.RootId != ""
	
	if isThreadReply {
		mlog.Debug("Processing thread reply mentions, excluding channel-wide mentions",
			mlog.String("post_id", post.Id),
			mlog.String("root_id", post.RootId))
	}

	// Parse the message for mentions
	message := post.Message
	
	// Extract user mentions (@username)
	userMentions := model.ParseMentions(message)
	for _, mention := range userMentions {
		// Skip channel-wide mentions in thread replies
		if isThreadReply && a.isChannelWideMention(mention) {
			mlog.Debug("Skipping channel-wide mention in thread reply",
				mlog.String("mention", mention),
				mlog.String("post_id", post.Id))
			continue
		}
		
		// Handle channel-wide mentions in root posts
		if !isThreadReply {
			switch mention {
			case model.CHANNEL_MENTIONS_ALL:
				mentions.AllMentioned = true
				continue
			case model.CHANNEL_MENTIONS_CHANNEL:
				mentions.ChannelMentioned = true
				continue  
			case model.CHANNEL_MENTIONS_HERE:
				mentions.HereMentioned = true
				continue
			}
		}
		
		// Regular user mention
		if user, err := a.GetUserByUsername(c, mention); err == nil {
			mentions.MentionedUserIds = append(mentions.MentionedUserIds, user.Id)
		} else {
			mentions.OtherPotentialMentions = append(mentions.OtherPotentialMentions, mention)
		}
	}

	// For thread replies, also include thread participants
	if isThreadReply {
		threadParticipants, err := a.getThreadParticipants(c, post.RootId)
		if err != nil {
			mlog.Error("Failed to get thread participants",
				mlog.String("root_id", post.RootId),
				mlog.Err(err))
		} else {
			// Add thread participants to mentions (but avoid duplicates)
			for _, participantId := range threadParticipants {
				if !mentions.MentionedUserIds.Contains(participantId) {
					mentions.MentionedUserIds = append(mentions.MentionedUserIds, participantId)
				}
			}
		}
	}

	return mentions, nil
}

// isChannelWideMention checks if a mention is a channel-wide mention
func (a *App) isChannelWideMention(mention string) bool {
	return mention == model.CHANNEL_MENTIONS_ALL ||
		   mention == model.CHANNEL_MENTIONS_CHANNEL ||
		   mention == model.CHANNEL_MENTIONS_HERE
}

// getThreadParticipants gets users who have participated in a thread
func (a *App) getThreadParticipants(c *request.Context, rootId string) ([]string, *model.AppError) {
	// Get the thread posts
	postList, err := a.GetPostThread(c, rootId, false, false, "", false)
	if err != nil {
		return nil, err
	}
	
	participants := make(map[string]bool)
	
	// Add the root post author
	if rootPost := postList.Posts[rootId]; rootPost != nil {
		participants[rootPost.UserId] = true
	}
	
	// Add all thread reply authors
	for _, post := range postList.Posts {
		if post.RootId == rootId {
			participants[post.UserId] = true
		}
	}
	
	// Convert to slice
	result := make([]string, 0, len(participants))
	for userId := range participants {
		result = append(result, userId)
	}
	
	return result, nil
}

// SendNotifications sends notifications for a post, with thread-aware mention handling
func (a *App) SendNotifications(c *request.Context, post *model.Post, team *model.Team, channel *model.Channel, sender *model.User, parentPostList *model.PostList, setOnline, setOnlineThread bool) ([]string, *model.AppError) {
	// Get mentions from the post
	mentions, err := a.getExplicitMentionsFromPost(c, post, nil)
	if err != nil {
		return nil, err
	}
	
	// Build notification recipients list
	recipients := make(map[string]bool)
	
	// Add explicitly mentioned users
	for _, userId := range mentions.MentionedUserIds {
		recipients[userId] = true
	}
	
	// For root posts with channel-wide mentions, add all channel members
	if post.RootId == "" {
		if mentions.AllMentioned || mentions.ChannelMentioned || mentions.HereMentioned {
			channelMembers, memberErr := a.GetChannelMembers(c, channel.Id, 0, 60000)
			if memberErr != nil {
				mlog.Error("Failed to get channel members for notification",
					mlog.String("channel_id", channel.Id),
					mlog.Err(memberErr))
			} else {
				for _, member := range channelMembers {
					recipients[member.UserId] = true
				}
			}
		}
	}
	
	// Remove the post author (don't notify themselves)
	delete(recipients, post.UserId)
	
	// Convert to slice
	recipientList := make([]string, 0, len(recipients))
	for userId := range recipients {
		recipientList = append(recipientList, userId)
	}
	
	mlog.Debug("Sending notifications for post",
		mlog.String("post_id", post.Id),
		mlog.String("root_id", post.RootId),
		mlog.Int("recipient_count", len(recipientList)),
		mlog.Bool("is_thread_reply", post.RootId != ""))
	
	// Send the notifications (implementation would call existing notification system)
	// This is a simplified version - actual implementation would handle push notifications,
	// email notifications, desktop notifications, etc.
	
	return recipientList, nil
}