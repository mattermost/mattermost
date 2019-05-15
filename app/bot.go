// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

// CreateBot creates the given bot and corresponding user.
func (a *App) CreateBot(bot *model.Bot) (*model.Bot, *model.AppError) {
	result := <-a.Srv.Store.User().Save(model.UserFromBot(bot))
	if result.Err != nil {
		return nil, result.Err
	}
	bot.UserId = result.Data.(*model.User).Id

	result = <-a.Srv.Store.Bot().Save(bot)
	if result.Err != nil {
		<-a.Srv.Store.User().PermanentDelete(bot.UserId)
		return nil, result.Err
	}

	return result.Data.(*model.Bot), nil
}

// PatchBot applies the given patch to the bot and corresponding user.
func (a *App) PatchBot(botUserId string, botPatch *model.BotPatch) (*model.Bot, *model.AppError) {
	bot, err := a.GetBot(botUserId, true)
	if err != nil {
		return nil, err
	}

	bot.Patch(botPatch)

	user, err := a.Srv.Store.User().Get(botUserId)
	if err != nil {
		return nil, err
	}

	patchedUser := model.UserFromBot(bot)
	user.Id = patchedUser.Id
	user.Username = patchedUser.Username
	user.Email = patchedUser.Email
	user.FirstName = patchedUser.FirstName
	if result := <-a.Srv.Store.User().Update(user, true); result.Err != nil {
		return nil, result.Err
	}

	result := <-a.Srv.Store.Bot().Update(bot)
	if result.Err != nil {
		return nil, result.Err
	}

	return result.Data.(*model.Bot), nil
}

// GetBot returns the given bot.
func (a *App) GetBot(botUserId string, includeDeleted bool) (*model.Bot, *model.AppError) {
	result := <-a.Srv.Store.Bot().Get(botUserId, includeDeleted)
	if result.Err != nil {
		return nil, result.Err
	}

	return result.Data.(*model.Bot), nil
}

// GetBots returns the requested page of bots.
func (a *App) GetBots(options *model.BotGetOptions) (model.BotList, *model.AppError) {
	result := <-a.Srv.Store.Bot().GetAll(options)
	if result.Err != nil {
		return nil, result.Err
	}

	return result.Data.([]*model.Bot), nil
}

// UpdateBotActive marks a bot as active or inactive, along with its corresponding user.
func (a *App) UpdateBotActive(botUserId string, active bool) (*model.Bot, *model.AppError) {
	user, err := a.Srv.Store.User().Get(botUserId)
	if err != nil {
		return nil, err
	}

	if _, err := a.UpdateActive(user, active); err != nil {
		return nil, err
	}

	result := <-a.Srv.Store.Bot().Get(botUserId, true)
	if result.Err != nil {
		return nil, result.Err
	}
	bot := result.Data.(*model.Bot)

	changed := true
	if active && bot.DeleteAt != 0 {
		bot.DeleteAt = 0
	} else if !active && bot.DeleteAt == 0 {
		bot.DeleteAt = model.GetMillis()
	} else {
		changed = false
	}

	if changed {
		result := <-a.Srv.Store.Bot().Update(bot)
		if result.Err != nil {
			return nil, result.Err
		}
		bot = result.Data.(*model.Bot)
	}

	return bot, nil
}

// PermanentDeleteBot permanently deletes a bot and its corresponding user.
func (a *App) PermanentDeleteBot(botUserId string) *model.AppError {
	if result := <-a.Srv.Store.Bot().PermanentDelete(botUserId); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.User().PermanentDelete(botUserId); result.Err != nil {
		return result.Err
	}

	return nil
}

// UpdateBotOwner changes a bot's owner to the given value
func (a *App) UpdateBotOwner(botUserId, newOwnerId string) (*model.Bot, *model.AppError) {
	result := <-a.Srv.Store.Bot().Get(botUserId, true)
	if result.Err != nil {
		return nil, result.Err
	}
	bot := result.Data.(*model.Bot)

	bot.OwnerId = newOwnerId

	if result = <-a.Srv.Store.Bot().Update(bot); result.Err != nil {
		return nil, result.Err
	}

	return result.Data.(*model.Bot), nil
}

// disableUserBots disables all bots owned by the given user
func (a *App) disableUserBots(userId string) *model.AppError {
	perPage := 20
	for {
		options := &model.BotGetOptions{
			OwnerId:        userId,
			IncludeDeleted: false,
			OnlyOrphaned:   false,
			Page:           0,
			PerPage:        perPage,
		}
		userBots, err := a.GetBots(options)
		if err != nil {
			return err
		}

		for _, bot := range userBots {
			_, err := a.UpdateBotActive(bot.UserId, false)
			if err != nil {
				mlog.Error("Unable to deactivate bot.", mlog.String("bot_user_id", bot.UserId), mlog.Err(err))
			}
		}

		// Get next set of bots if we got the max number of bots
		if len(userBots) == perPage {
			options.Page += 1
			continue
		}
		break
	}

	return nil
}

// ConvertUserToBot converts a user to bot
func (a *App) ConvertUserToBot(user *model.User) (*model.Bot, *model.AppError) {
	result := <-a.Srv.Store.Bot().Save(model.BotFromUser(user))
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.Bot), nil
}
