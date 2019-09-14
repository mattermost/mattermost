// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"io/ioutil"
	"path/filepath"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
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

func (p *HelpersImpl) readImage(path string) ([]byte, error) {
	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get bundle path")
	}

	imageBytes, err := ioutil.ReadFile(filepath.Join(bundlePath, path))
	if err != nil {
		return nil, errors.Wrap(err, "failed to read image")
	}
	return imageBytes, nil
}

func (p *HelpersImpl) setIconAndProfileImageIfNotEmpty(botId string, profileImagePath string, iconImagePath string) error {
	if !(profileImagePath == "") {
		imageBytes, err := p.readImage(profileImagePath)
		if err != nil {
			return errors.Wrap(err, "Failed to read profile image")
		}
		setProfileErr := p.API.SetProfileImage(botId, imageBytes)
		if setProfileErr != nil {
			return errors.Wrap(err, "Failed to set profile image")
		}
	}
	if !(iconImagePath == "") {
		imageBytes, err := p.readImage(iconImagePath)
		if err != nil {
			return errors.Wrap(err, "Failed to read icon image")
		}
		setIconErr := p.API.SetBotIconImage(botId, imageBytes)
		if setIconErr != nil {
			return errors.Wrap(err, "Failed to set profile image")
		}
	}
	return nil
}

// EnsureBot either returns an existing bot user matching the given bot, or creates a bot user from the given bot.
// Returns the id of the resulting bot. A profile image or icon image may be optionally passed in to be set for
// the existing or newly created bot.
func (p *HelpersImpl) EnsureBot(bot *model.Bot, setters ...EnsureBotOption) (retBotId string, retErr error) {
	// Default options
	args := &ensureBotOptions{
		ProfileImagePath: "",
		IconImagePath:    "",
	}

	for _, setter := range setters {
		setter(args)
	}

	// Must provide a bot with a username
	if bot == nil || len(bot.Username) < 1 {
		return "", errors.New("passed a bad bot, nil or no username")
	}

	// If we fail for any reason, this could be a race between creation of bot and
	// retrieval from another EnsureBot. Just try the basic retrieve existing again.
	defer func() {
		if retBotId == "" || retErr != nil {
			var err error
			var botIdBytes []byte

			err = utils.ProgressiveRetry(func() error {
				botIdBytes, err = p.API.KVGet(BOT_USER_KEY)
				if err != nil {
					return err
				}
				return nil
			})

			if err == nil && botIdBytes != nil {
				retBotId = string(botIdBytes)
				retErr = nil
			}
		}
	}()

	botIdBytes, kvGetErr := p.API.KVGet(BOT_USER_KEY)
	if kvGetErr != nil {
		return "", errors.Wrap(kvGetErr, "failed to get bot")
	}

	// If the bot has already been created, there is nothing to do.
	if botIdBytes != nil {
		botId := string(botIdBytes)
		setImagesErr := p.setIconAndProfileImageIfNotEmpty(botId, args.ProfileImagePath, args.IconImagePath)
		if setImagesErr != nil {
			return botId, errors.Wrap(setImagesErr, "Failed to set icon or profile image")
		}
	}

	// Check for an existing bot user with that username. If one exists, then use that.
	if user, userGetErr := p.API.GetUserByUsername(bot.Username); userGetErr == nil && user != nil {
		if user.IsBot {
			if kvSetErr := p.API.KVSet(BOT_USER_KEY, []byte(user.Id)); kvSetErr != nil {
				p.API.LogWarn("Failed to set claimed bot user id.", "userid", user.Id, "err", kvSetErr)
			}
		} else {
			p.API.LogError("Plugin attempted to use an account that already exists. Convert user to a bot account in the CLI by running 'mattermost user convert <username> --bot'. If the user is an existing user account you want to preserve, change its username and restart the Mattermost server, after which the plugin will create a bot account with that name. For more information about bot accounts, see https://mattermost.com/pl/default-bot-accounts", "username", bot.Username, "user_id", user.Id)
		}
		setImagesErr := p.setIconAndProfileImageIfNotEmpty(user.Id, args.ProfileImagePath, args.IconImagePath)
		if setImagesErr != nil {
			return user.Id, errors.Wrap(setImagesErr, "Failed to set icon or profile image")
		}
		return user.Id, nil
	}

	// Create a new bot user for the plugin
	createdBot, createBotErr := p.API.CreateBot(bot)
	if createBotErr != nil {
		return "", errors.Wrap(createBotErr, "failed to create bot")
	}

	if kvSetErr := p.API.KVSet(BOT_USER_KEY, []byte(createdBot.UserId)); kvSetErr != nil {
		p.API.LogWarn("Failed to set created bot user id.", "userid", createdBot.UserId, "err", kvSetErr)
	}

	return createdBot.UserId, nil
}
