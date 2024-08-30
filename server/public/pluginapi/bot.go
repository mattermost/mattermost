package pluginapi

import (
	"os"
	"path/filepath"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"
)

const (
	internalKeyPrefix = "mmi_"
	botUserKey        = internalKeyPrefix + "botid"
	botEnsureMutexKey = internalKeyPrefix + "bot_ensure"
)

// BotService exposes methods to manipulate bots.
type BotService struct {
	api plugin.API
}

// Get returns a bot by botUserID.
//
// Minimum server version: 5.10
func (b *BotService) Get(botUserID string, includeDeleted bool) (*model.Bot, error) {
	bot, appErr := b.api.GetBot(botUserID, includeDeleted)

	return bot, normalizeAppErr(appErr)
}

// BotListOption is an option to configure a bot List() request.
type BotListOption func(*model.BotGetOptions)

// BotOwner option configures bot list request to only retrieve the bots that matches with
// owner's id.
func BotOwner(id string) BotListOption {
	return func(o *model.BotGetOptions) {
		o.OwnerId = id
	}
}

// BotIncludeDeleted option configures bot list request to also retrieve the deleted bots.
func BotIncludeDeleted() BotListOption {
	return func(o *model.BotGetOptions) {
		o.IncludeDeleted = true
	}
}

// BotOnlyOrphans option configures bot list request to only retrieve orphan bots.
func BotOnlyOrphans() BotListOption {
	return func(o *model.BotGetOptions) {
		o.OnlyOrphaned = true
	}
}

// List returns a list of bots by page, count and options.
//
// Minimum server version: 5.10
func (b *BotService) List(page, perPage int, options ...BotListOption) ([]*model.Bot, error) {
	opts := &model.BotGetOptions{
		Page:    page,
		PerPage: perPage,
	}
	for _, o := range options {
		o(opts)
	}
	bots, appErr := b.api.GetBots(opts)

	return bots, normalizeAppErr(appErr)
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

// Patch applies the given patch to the bot and corresponding user.
//
// Minimum server version: 5.10
func (b *BotService) Patch(botUserID string, botPatch *model.BotPatch) (*model.Bot, error) {
	bot, appErr := b.api.PatchBot(botUserID, botPatch)

	return bot, normalizeAppErr(appErr)
}

// UpdateActive marks a bot as active or inactive, along with its corresponding user.
//
// Minimum server version: 5.10
func (b *BotService) UpdateActive(botUserID string, isActive bool) (*model.Bot, error) {
	bot, appErr := b.api.UpdateBotActive(botUserID, isActive)

	return bot, normalizeAppErr(appErr)
}

// DeletePermanently permanently deletes a bot and its corresponding user.
//
// Minimum server version: 5.10
func (b *BotService) DeletePermanently(botUserID string) error {
	return normalizeAppErr(b.api.PermanentDeleteBot(botUserID))
}

type ensureBotOptions struct {
	ProfileImagePath  string
	ProfileImageBytes []byte
}

type EnsureBotOption func(*ensureBotOptions)

// ProfileImagePath configures EnsureBot to set a profile image from the given path.
//
// Using this option overrides any previously set ProfileImageBytes option.
func ProfileImagePath(path string) EnsureBotOption {
	return func(args *ensureBotOptions) {
		args.ProfileImagePath = path
		args.ProfileImageBytes = nil
	}
}

// ProfileImageBytes configures EnsureBot to set a profile image from the given bytes.
//
// Using this option overrides any previously set ProfileImagePath option.
func ProfileImageBytes(bytes []byte) EnsureBotOption {
	return func(args *ensureBotOptions) {
		args.ProfileImageBytes = bytes
		args.ProfileImagePath = ""
	}
}

// EnsureBot either returns an existing bot user matching the given bot, or creates a bot user from the given bot.
// A profile image or icon image may be optionally passed in to be set for the existing or newly created bot.
// Returns the id of the resulting bot.
// EnsureBot can safely be called multiple instances of a plugin concurrently.
//
// Minimum server version: 5.10
func (b *BotService) EnsureBot(bot *model.Bot, options ...EnsureBotOption) (string, error) {
	m, err := cluster.NewMutex(b.api, botEnsureMutexKey)
	if err != nil {
		return "", errors.Wrap(err, "failed to create mutex")
	}

	return b.ensureBot(m, bot, options...)
}

type mutex interface {
	Lock()
	Unlock()
}

func (b *BotService) ensureBot(m mutex, bot *model.Bot, options ...EnsureBotOption) (string, error) {
	err := ensureServerVersion(b.api, "5.10.0")
	if err != nil {
		return "", errors.Wrap(err, "failed to ensure bot")
	}

	// Default options
	o := &ensureBotOptions{
		ProfileImagePath: "",
	}

	for _, setter := range options {
		setter(o)
	}

	botID, err := b.ensureBotUser(m, bot)
	if err != nil {
		return "", err
	}

	if o.ProfileImagePath != "" {
		imageBytes, err := b.readFile(o.ProfileImagePath)
		if err != nil {
			return "", errors.Wrap(err, "failed to read profile image")
		}
		appErr := b.api.SetProfileImage(botID, imageBytes)
		if appErr != nil {
			return "", errors.Wrap(appErr, "failed to set profile image")
		}
	} else if len(o.ProfileImageBytes) > 0 {
		appErr := b.api.SetProfileImage(botID, o.ProfileImageBytes)
		if appErr != nil {
			return "", errors.Wrap(appErr, "failed to set profile image")
		}
	}

	return botID, nil
}

func (b *BotService) ensureBotUser(m mutex, bot *model.Bot) (retBotID string, retErr error) {
	// Lock to prevent two plugins from racing to create the bot account
	m.Lock()
	defer m.Unlock()

	return b.api.EnsureBotUser(bot)
}

func (b *BotService) readFile(path string) ([]byte, error) {
	bundlePath, err := b.api.GetBundlePath()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get bundle path")
	}

	imageBytes, err := os.ReadFile(filepath.Join(bundlePath, path))
	if err != nil {
		return nil, errors.Wrap(err, "failed to read image")
	}

	return imageBytes, nil
}
