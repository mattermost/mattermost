// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
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

	result := <-a.Srv.Store.User().Get(botUserId)
	if result.Err != nil {
		return nil, result.Err
	}
	user := result.Data.(*model.User)

	patchedUser := model.UserFromBot(bot)
	user.Id = patchedUser.Id
	user.Username = patchedUser.Username
	user.Email = patchedUser.Email
	user.FirstName = patchedUser.FirstName
	if result := <-a.Srv.Store.User().Update(user, true); result.Err != nil {
		return nil, result.Err
	}

	result = <-a.Srv.Store.Bot().Update(bot)
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
	result := <-a.Srv.Store.User().Get(botUserId)
	if result.Err != nil {
		return nil, result.Err
	}
	user := result.Data.(*model.User)

	if _, err := a.UpdateActive(user, active); err != nil {
		return nil, err
	}

	result = <-a.Srv.Store.Bot().Get(botUserId, true)
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

	bot.CreatorId = newOwnerId

	if result := <-a.Srv.Store.Bot().Update(bot); result.Err != nil {
		return nil, result.Err
	}

	return result.Data.(*model.Bot), nil
}
