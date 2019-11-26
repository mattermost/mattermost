package pluginapi

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// PostService exposes methods to manipulate posts.
type PostService struct {
	api plugin.API
}

// CreatePost creates a post.
//
// Minimum server version: 5.2
func (p *PostService) CreatePost(post *model.Post) error {
	createdPost, appErr := p.api.CreatePost(post)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*post = *createdPost

	return nil
}

// GetPost gets a post.
//
// Minimum server version: 5.2
func (p *PostService) GetPost(postID string) (*model.Post, error) {
	post, appErr := p.api.GetPost(postID)

	return post, normalizeAppErr(appErr)
}

// UpdatePost updates a post.
//
// Minimum server version: 5.2
func (p *PostService) UpdatePost(post *model.Post) error {
	updatedPost, appErr := p.api.UpdatePost(post)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*post = *updatedPost

	return nil
}

// DeletePost deletes a post.
//
// Minimum server version: 5.2
func (p *PostService) DeletePost(postID string) error {
	return normalizeAppErr(p.api.DeletePost(postID))
}

// SendEphemeralPost creates an ephemeral post.
//
// Minimum server version: 5.2
func (p *PostService) SendEphemeralPost(userID string, post *model.Post) {
	*post = *p.api.SendEphemeralPost(userID, post)
}

// UpdateEphemeralPost updates an ephemeral message previously sent to the user.
// EXPERIMENTAL: This API is experimental and can be changed without advance notice.
//
// Minimum server version: 5.2
func (p *PostService) UpdateEphemeralPost(userID string, post *model.Post) {
	*post = *p.api.UpdateEphemeralPost(userID, post)
}

// DeleteEphemeralPost deletes an ephemeral message previously sent to the user.
// EXPERIMENTAL: This API is experimental and can be changed without advance notice.
//
// Minimum server version: 5.2
func (p *PostService) DeleteEphemeralPost(userID, postID string) {
	p.api.DeleteEphemeralPost(userID, postID)
}

// GetPostThread gets a post with all the other posts in the same thread.
//
// Minimum server version: 5.6
func (p *PostService) GetPostThread(postID string) (*model.PostList, error) {
	postList, appErr := p.api.GetPostThread(postID)

	return postList, normalizeAppErr(appErr)
}

// GetPostsSince gets posts created after a specified time as Unix time in milliseconds.
//
// Minimum server version: 5.6
func (p *PostService) GetPostsSince(channelID string, time int64) (*model.PostList, error) {
	postList, appErr := p.api.GetPostsSince(channelID, time)

	return postList, normalizeAppErr(appErr)
}

// GetPostsAfter gets a page of posts that were posted after the post provided.
//
// Minimum server version: 5.6
func (p *PostService) GetPostsAfter(channelID, postID string, page, perPage int) (*model.PostList, error) {
	postList, appErr := p.api.GetPostsAfter(channelID, postID, page, perPage)

	return postList, normalizeAppErr(appErr)
}

// GetPostsBefore gets a page of posts that were posted before the post provided.
//
// Minimum server version: 5.6
func (p *PostService) GetPostsBefore(channelID, postID string, page, perPage int) (*model.PostList, error) {
	postList, appErr := p.api.GetPostsBefore(channelID, postID, page, perPage)

	return postList, normalizeAppErr(appErr)
}

// GetPostsForChannel gets a list of posts for a channel.
//
// Minimum server version: 5.6
func (p *PostService) GetPostsForChannel(channelID string, page, perPage int) (*model.PostList, error) {
	postList, appErr := p.api.GetPostsForChannel(channelID, page, perPage)

	return postList, normalizeAppErr(appErr)
}

// SearchPostsInTeam returns a list of posts in a specific team that match the given params.
//
// Minimum server version: 5.10
func (p *PostService) SearchPostsInTeam(teamID string, paramsList []*model.SearchParams) ([]*model.Post, error) {
	postList, appErr := p.api.SearchPostsInTeam(teamID, paramsList)

	return postList, normalizeAppErr(appErr)
}

// AddReaction add a reaction to a post.
//
// Minimum server version: 5.3
func (p *PostService) AddReaction(reaction *model.Reaction) error {
	addedReaction, appErr := p.api.AddReaction(reaction)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*reaction = *addedReaction

	return nil
}

// GetReactions get the reactions of a post.
//
// Minimum server version: 5.3
func (p *PostService) GetReactions(postID string) ([]*model.Reaction, error) {
	reactions, appErr := p.api.GetReactions(postID)

	return reactions, normalizeAppErr(appErr)
}

// RemoveReaction remove a reaction from a post.
//
// Minimum server version: 5.3
func (p *PostService) RemoveReaction(reaction *model.Reaction) error {
	return normalizeAppErr(p.api.RemoveReaction(reaction))
}
