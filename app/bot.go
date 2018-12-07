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
func (a *App) PatchBot(userId string, botPatch *model.BotPatch) (*model.Bot, *model.AppError) {
	bot, err := a.GetBot(userId, true)
	if err != nil {
		return nil, err
	}

	bot.Patch(botPatch)

	result := <-a.Srv.Store.User().Get(userId)
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
func (a *App) GetBot(userId string, includeDeleted bool) (*model.Bot, *model.AppError) {
	result := <-a.Srv.Store.Bot().Get(userId, includeDeleted)
	if result.Err != nil {
		return nil, result.Err
	}

	return result.Data.(*model.Bot), nil
}

// GetBots returns the requested page of bots.
func (a *App) GetBots(page, perPage int, creatorId string, includeDeleted bool) (model.BotList, *model.AppError) {
	result := <-a.Srv.Store.Bot().GetAll(page*perPage, perPage, creatorId, includeDeleted)
	if result.Err != nil {
		return nil, result.Err
	}

	return result.Data.([]*model.Bot), nil
}

// DisableBot marks a bot and its corresponding user as disabled.
func (a *App) DisableBot(userId string) (*model.Bot, *model.AppError) {
	result := <-a.Srv.Store.User().Get(userId)
	if result.Err != nil {
		return nil, result.Err
	}
	user := result.Data.(*model.User)

	if user.DeleteAt == 0 {
		if _, err := a.UpdateActive(user, false); err != nil {
			return nil, err
		}
	}

	result = <-a.Srv.Store.Bot().Get(userId, true)
	if result.Err != nil {
		return nil, result.Err
	}
	bot := result.Data.(*model.Bot)

	if bot.DeleteAt == 0 {
		bot.DeleteAt = model.GetMillis()

		result := <-a.Srv.Store.Bot().Update(bot)
		if result.Err != nil {
			return nil, result.Err
		}
		bot = result.Data.(*model.Bot)
	}

	return bot, nil
}

// PermanentDeleteBot permanently deletes a bot and its corresponding user.
func (a *App) PermanentDeleteBot(userId string) *model.AppError {
	if result := <-a.Srv.Store.Bot().PermanentDelete(userId); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.User().PermanentDelete(userId); result.Err != nil {
		return result.Err
	}

	return nil
}
