package pluginapi

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// ReactionService exposes methods to read, write and delete the post reactions for a Mattermost server.
type ReactionService struct {
	api plugin.API
}

// AddReaction add a reaction to a post.
//
// Minimum server version: 5.3
func (r *ReactionService) AddReaction(reaction *model.Reaction) (*model.Reaction, error) {
	reaction, appErr := r.api.AddReaction(reaction)

	return reaction, normalizeAppErr(appErr)
}

// GetReactions get the reactions of a post.
//
// Minimum server version: 5.3
func (r *ReactionService) GetReactions(postID string) ([]*model.Reaction, error) {
	reactions, appErr := r.api.GetReactions(postID)

	return reactions, normalizeAppErr(appErr)
}

// RemoveReaction remove a reaction from a post.
//
// Minimum server version: 5.3
func (r *ReactionService) RemoveReaction(reaction *model.Reaction) error {
	appErr := r.api.RemoveReaction(reaction)

	return normalizeAppErr(appErr)
}
