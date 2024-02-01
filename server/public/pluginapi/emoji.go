package pluginapi

import (
	"bytes"
	"io"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// EmojiService exposes methods to manipulate emojis.
type EmojiService struct {
	api plugin.API
}

// Get gets a custom emoji by id.
//
// Minimum server version: 5.6
func (e *EmojiService) Get(id string) (*model.Emoji, error) {
	emoji, appErr := e.api.GetEmoji(id)

	return emoji, normalizeAppErr(appErr)
}

// GetByName gets a custom emoji by its name.
//
// Minimum server version: 5.6
func (e *EmojiService) GetByName(name string) (*model.Emoji, error) {
	emoji, appErr := e.api.GetEmojiByName(name)

	return emoji, normalizeAppErr(appErr)
}

// GetImage gets a custom emoji's content and format by id.
//
// Minimum server version: 5.6
func (e *EmojiService) GetImage(id string) (io.Reader, string, error) {
	contentBytes, format, appErr := e.api.GetEmojiImage(id)
	if appErr != nil {
		return nil, "", normalizeAppErr(appErr)
	}

	return bytes.NewReader(contentBytes), format, nil
}

// List retrieves a list of custom emojis.
// sortBy parameter can be: "name".
//
// Minimum server version: 5.6
func (e *EmojiService) List(sortBy string, page, count int) ([]*model.Emoji, error) {
	emojis, appErr := e.api.GetEmojiList(sortBy, page, count)

	return emojis, normalizeAppErr(appErr)
}
