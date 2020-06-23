package poster

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

type defaultPoster struct {
	pluginAPI plugin.API
	id        string
}

func NewPoster(api plugin.API, id string) Poster {
	return &defaultPoster{
		pluginAPI: api,
		id:        id,
	}
}

// DM posts a simple Direct Message to the specified user
func (p *defaultPoster) DM(mattermostUserID, format string, args ...interface{}) (string, error) {
	postID, err := p.dm(mattermostUserID, &model.Post{
		Message: fmt.Sprintf(format, args...),
	})
	if err != nil {
		return "", err
	}
	return postID, nil
}

// DMWithAttachments posts a Direct Message that contains Slack attachments.
// Often used to include post actions.
func (p *defaultPoster) DMWithAttachments(mattermostUserID string, attachments ...*model.SlackAttachment) (string, error) {
	post := model.Post{}
	model.ParseSlackAttachment(&post, attachments)
	return p.dm(mattermostUserID, &post)
}

func (p *defaultPoster) dm(mattermostUserID string, post *model.Post) (string, error) {
	channel, err := p.pluginAPI.GetDirectChannel(mattermostUserID, p.id)
	if err != nil {
		p.pluginAPI.LogInfo("Couldn't get bot's DM channel", "user_id", mattermostUserID)
		return "", err
	}
	post.ChannelId = channel.Id
	post.UserId = p.id
	sentPost, err := p.pluginAPI.CreatePost(post)
	if err != nil {
		return "", err
	}
	return sentPost.Id, nil
}

// Ephemeral sends an ephemeral message to a user
func (p *defaultPoster) Ephemeral(userID, channelID, format string, args ...interface{}) {
	post := &model.Post{
		UserId:    p.id,
		ChannelId: channelID,
		Message:   fmt.Sprintf(format, args...),
	}
	_ = p.pluginAPI.SendEphemeralPost(userID, post)
}

func (p *defaultPoster) UpdatePostByID(postID, format string, args ...interface{}) error {
	post, appErr := p.pluginAPI.GetPost(postID)
	if appErr != nil {
		return appErr
	}

	post.Message = fmt.Sprintf(format, args...)
	err := p.UpdatePost(post)
	if err != nil {
		return err
	}

	return nil
}

func (p *defaultPoster) DeletePost(postID string) error {
	appErr := p.pluginAPI.DeletePost(postID)
	if appErr != nil {
		return appErr
	}
	return nil
}

func (p *defaultPoster) UpdatePost(post *model.Post) error {
	_, appErr := p.pluginAPI.UpdatePost(post)
	if appErr != nil {
		return appErr
	}
	return nil
}

func (p *defaultPoster) UpdatePosterID(id string) {
	p.id = id
}
