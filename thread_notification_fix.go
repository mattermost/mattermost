package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// ThreadNotificationFix contains the logic to prevent @all propagation in thread replies
// This addresses issue #34437

// isThreadReply checks if a post is a thread reply
func isThreadReply(post *model.Post) bool {
	return post.RootId != ""
}

// shouldSkipChannelWideMention determines if channel-wide mentions should be skipped
// for thread replies to prevent notification spam
func shouldSkipChannelWideMention(post *model.Post, mention string) bool {
	if !isThreadReply(post) {
		return false // Root posts should process all mentions normally
	}
	
	// Skip channel-wide mentions in thread replies
	channelWideMentions := []string{
		model.ChannelMentions.All,
		model.ChannelMentions.Channel, 
		model.ChannelMentions.Here,
	}
	
	for _, cwm := range channelWideMentions {
		if mention == cwm {
			mlog.Debug("Skipping channel-wide mention in thread reply",
				mlog.String("mention", mention),
				mlog.String("post_id", post.Id),
				mlog.String("root_id", post.RootId))
			return true
		}
	}
	
	return false
}

// GetThreadParticipants returns unique user IDs who have participated in a thread
func (a *App) GetThreadParticipants(rootId string) ([]string, error) {
	// This would integrate with existing post storage
	// Implementation depends on current Mattermost data access patterns
	
	posts, err := a.Srv().Store.Post().GetPostThread(rootId, model.GetPostThreadOpts{})
	if err != nil {
		return nil, err
	}
	
	participantMap := make(map[string]bool)
	var participants []string
	
	for _, post := range posts.Posts {
		if !participantMap[post.UserId] {
			participantMap[post.UserId] = true
			participants = append(participants, post.UserId)
		}
	}
	
	return participants, nil
}
