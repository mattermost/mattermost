package pluginapi

import (
	"bytes"
	"io"
	"io/ioutil"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
)

// BotService exposes functionalities to deal with bots.
type BotService struct {
	api plugin.API
}

// Create creates the bot and corresponding user.
//
// Minimum server version: 5.10
func (b *BotService) Create(bot *model.Bot) error {
	createdBot, appErr := b.api.CreateBot(bot)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}
	*bot = *createdBot
	return nil
}

// BotUpdateOption is an option to update bot.
type BotUpdateOption func(*model.BotPatch)

// BotUserNameUpdate is an option to update bot's user name.
func BotUserNameUpdate(userName string) BotUpdateOption {
	return func(o *model.BotPatch) {
		o.Username = &userName
	}
}

// BotDisplayNameUpdate is an option to update bot's display name.
func BotDisplayNameUpdate(displayName string) BotUpdateOption {
	return func(o *model.BotPatch) {
		o.DisplayName = &displayName
	}
}

// BotDescriptionUpdate is an option to update bot's description.
func BotDescriptionUpdate(description string) BotUpdateOption {
	return func(o *model.BotPatch) {
		o.Description = &description
	}
}

// Update applies the given update options to the bot and corresponding user.
//
// Minimum server version: 5.10
func (b *BotService) Update(botUserID string, options ...BotUpdateOption) (*model.Bot, error) {
	opts := &model.BotPatch{}
	if len(options) == 0 {
		return nil, errors.New("no update options provided")
	}
	for _, o := range options {
		o(opts)
	}
	bot, appErr := b.api.PatchBot(botUserID, opts)
	return bot, normalizeAppErr(appErr)
}

// UpdateStatus marks a bot as active or inactive, along with its corresponding user.
//
// Minimum server version: 5.10
func (b *BotService) UpdateStatus(botUserID string, isActive bool) (*model.Bot, error) {
	bot, appErr := b.api.UpdateBotActive(botUserID, isActive)
	return bot, normalizeAppErr(appErr)
}

// SetIconImage sets LHS bot icon image. Icon image must be SVG format, all other formats are rejected.
//
// Minimum server version: 5.14
func (b *BotService) SetIconImage(botUserID string, content io.Reader) error {
	contentBytes, err := ioutil.ReadAll(content)
	if err != nil {
		return err
	}
	appErr := b.api.SetBotIconImage(botUserID, contentBytes)
	return normalizeAppErr(appErr)
}

// Get returns a bot by botUserID.
//
// Minimum server version: 5.10
func (b *BotService) Get(botUserID string, includeDeleted bool) (*model.Bot, error) {
	bot, appErr := b.api.GetBot(botUserID, includeDeleted)
	return bot, normalizeAppErr(appErr)
}

// GetIconImage gets LHS bot icon image.
//
// Minimum server version: 5.14
func (b *BotService) GetIconImage(botUserID string) (content io.Reader, err error) {
	contentBytes, appErr := b.api.GetBotIconImage(botUserID)
	if appErr != nil {
		return nil, normalizeAppErr(appErr)
	}
	return bytes.NewReader(contentBytes), nil
}

// BotListOption is an option to configure a bot List() request.
type BotListOption func(*model.BotGetOptions)

// BotOwner option configures bot list request to only retrive the bots that matches with
// owner's id.
func BotOwner(id string) BotListOption {
	return func(o *model.BotGetOptions) {
		o.OwnerId = id
	}
}

// BotIncludeDeleted option configures bot list request to also retrive the deleted bots.
func BotIncludeDeleted() BotListOption {
	return func(o *model.BotGetOptions) {
		o.IncludeDeleted = true
	}
}

// BotOnlyOrphans option configures bot list request to only retrive orphan bots.
func BotOnlyOrphans() BotListOption {
	return func(o *model.BotGetOptions) {
		o.OnlyOrphaned = true
	}
}

// List returns a list of bots by page, count and options.
//
// Minimum server version: 5.10
func (b *BotService) List(page, count int, options ...BotListOption) ([]*model.Bot, error) {
	opts := &model.BotGetOptions{
		Page:    page,
		PerPage: count,
	}
	for _, o := range options {
		o(opts)
	}
	bots, appErr := b.api.GetBots(opts)
	return bots, normalizeAppErr(appErr)
}

// DeleteIconImage deletes LHS bot icon image.
//
// Minimum server version: 5.14
func (b *BotService) DeleteIconImage(botUserID string) error {
	appErr := b.api.DeleteBotIconImage(botUserID)
	return normalizeAppErr(appErr)
}

// DeletePermanently permanently deletes a bot and its corresponding user.
//
// Minimum server version: 5.10
func (b *BotService) DeletePermanently(botUserID string) error {
	appErr := b.api.PermanentDeleteBot(botUserID)
	return normalizeAppErr(appErr)
}
