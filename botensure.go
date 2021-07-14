package pluginapi

import (
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type ensureBotOptions struct {
	ProfileImagePath string
	IconImagePath    string
}

type EnsureBotOption func(*ensureBotOptions)

func ProfileImagePath(path string) EnsureBotOption {
	return func(args *ensureBotOptions) {
		args.ProfileImagePath = path
	}
}

func IconImagePath(path string) EnsureBotOption {
	return func(args *ensureBotOptions) {
		args.IconImagePath = path
	}
}

// EnsureBot either returns an existing bot user matching the given bot, or creates a bot user from the given bot.
// A profile image or icon image may be optionally passed in to be set for the existing or newly created bot.
// Returns the id of the resulting bot.
//
// Minimum server version: 5.10
func (b *BotService) EnsureBot(bot *model.Bot, options ...EnsureBotOption) (retBotID string, retErr error) {
	err := ensureServerVersion(b.api, "5.10.0")
	if err != nil {
		return "", errors.Wrap(err, "failed to ensure bot")
	}

	// Default options
	o := &ensureBotOptions{
		ProfileImagePath: "",
		IconImagePath:    "",
	}

	for _, setter := range options {
		setter(o)
	}

	botID, err := b.ensureBot(bot)
	if err != nil {
		return "", err
	}

	err = b.setBotImages(botID, o.ProfileImagePath, o.IconImagePath)
	if err != nil {
		return "", err
	}

	return botID, nil
}

func (b *BotService) ensureBot(bot *model.Bot) (retBotID string, retErr error) {
	// Must provide a bot with a username
	if bot == nil {
		return "", errors.New("passed a nil bot")
	}

	if len(bot.Username) < 1 {
		return "", errors.New("passed a bot with no username")
	}

	// If we fail for any reason, this could be a race between creation of bot and
	// retrieval from another EnsureBot. Just try the basic retrieve existing again.
	defer func() {
		if retBotID == "" || retErr != nil {
			var err error
			var botIDBytes []byte

			err = progressiveRetry(func() error {
				botIDBytes, err = b.api.KVGet(botUserKey)
				if err != nil {
					return err
				}
				return nil
			})

			if err == nil && botIDBytes != nil {
				retBotID = string(botIDBytes)
				retErr = nil
			}
		}
	}()

	botIDBytes, kvGetErr := b.api.KVGet(botUserKey)
	if kvGetErr != nil {
		return "", errors.Wrap(kvGetErr, "failed to get bot")
	}

	// If the bot has already been created, use it
	if botIDBytes != nil {
		botID := string(botIDBytes)

		// ensure existing bot is synced with what is being created
		botPatch := &model.BotPatch{
			Username:    &bot.Username,
			DisplayName: &bot.DisplayName,
			Description: &bot.Description,
		}

		if _, err := b.api.PatchBot(botID, botPatch); err != nil {
			return "", errors.Wrap(err, "failed to patch bot")
		}

		return botID, nil
	}

	// Check for an existing bot user with that username. If one exists, then use that.
	if user, userGetErr := b.api.GetUserByUsername(bot.Username); userGetErr == nil && user != nil {
		if user.IsBot {
			if kvSetErr := b.api.KVSet(botUserKey, []byte(user.Id)); kvSetErr != nil {
				b.api.LogWarn("Failed to set claimed bot user id.", "userid", user.Id, "err", kvSetErr)
			}
		} else {
			b.api.LogError("Plugin attempted to use an account that already exists. Convert user to a bot "+
				"account in the CLI by running 'mattermost user convert <username> --bot'. If the user is an "+
				"existing user account you want to preserve, change its username and restart the Mattermost server, "+
				"after which the plugin will create a bot account with that name. For more information about bot "+
				"accounts, see https://mattermost.com/pl/default-bot-accounts", "username",
				bot.Username,
				"user_id",
				user.Id,
			)
		}
		return user.Id, nil
	}

	// Create a new bot user for the plugin
	createdBot, createBotErr := b.api.CreateBot(bot)
	if createBotErr != nil {
		return "", errors.Wrap(createBotErr, "failed to create bot")
	}

	if kvSetErr := b.api.KVSet(botUserKey, []byte(createdBot.UserId)); kvSetErr != nil {
		b.api.LogWarn("Failed to set created bot user id.", "userid", createdBot.UserId, "err", kvSetErr)
	}

	return createdBot.UserId, nil
}

func (b *BotService) setBotImages(botID, profileImagePath, iconImagePath string) error {
	if profileImagePath != "" {
		imageBytes, err := b.readFile(profileImagePath)
		if err != nil {
			return errors.Wrap(err, "failed to read profile image")
		}
		appErr := b.api.SetProfileImage(botID, imageBytes)
		if appErr != nil {
			return errors.Wrap(appErr, "failed to set profile image")
		}
	}

	if iconImagePath != "" {
		imageBytes, err := b.readFile(iconImagePath)
		if err != nil {
			return errors.Wrap(err, "failed to read icon image")
		}
		appErr := b.api.SetBotIconImage(botID, imageBytes)
		if appErr != nil {
			return errors.Wrap(appErr, "failed to set icon image")
		}
	}

	return nil
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
