package pluginapi

import (
	"bytes"
	"io"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// EmojiService provides features to set, update and retrive emojies.
type EmojiService struct {
	api plugin.API
}

// Get gets a custom emoji by id.
//
// @tag Emoji minimum server version: 5.6
func (e *EmojiService) Get(id string) (*model.Emoji, error) {
	emoji, aerr := e.api.GetEmoji(id)
	return emoji, normalizeAppErr(aerr)
}

// GetByName gets a custom emoji by its name.
//
// @tag Emoji minimum server version: 5.6
func (e *EmojiService) GetByName(name string) (*model.Emoji, error) {
	emoji, aerr := e.api.GetEmojiByName(name)
	return emoji, normalizeAppErr(aerr)
}

// GetImage gets a custom emoji's content and format by id.
//
// @tag Emoji minimum server version: 5.6
func (e *EmojiService) GetImage(id string) (content io.Reader, format string, err error) {
	contentBytes, format, aerr := e.api.GetEmojiImage(id)
	if aerr != nil {
		return nil, "", normalizeAppErr(aerr)
	}
	return bytes.NewReader(contentBytes), format, nil
}

// List retrieves a list of custom emojies.
// sortBy parameter can be: "name".
//
// @tag Emoji minimum server version: 5.6
func (e *EmojiService) List(sortBy string, page, count int) ([]*model.Emoji, error) {
	emojies, aerr := e.api.GetEmojiList(sortBy, page, count)
	return emojies, normalizeAppErr(aerr)
}
