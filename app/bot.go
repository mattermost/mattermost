// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
)

// CreateBot creates the given bot and corresponding user.
func (a *App) CreateBot(bot *model.Bot) (*model.Bot, *model.AppError) {
	user, err := a.Srv.Store.User().Save(model.UserFromBot(bot))
	if err != nil {
		return nil, err
	}
	bot.UserId = user.Id

	savedBot, err := a.Srv.Store.Bot().Save(bot)
	if err != nil {
		a.Srv.Store.User().PermanentDelete(bot.UserId)
		return nil, err
	}

	// Get the owner of the bot, if one exists. If not, don't send a message
	ownerUser, err := a.Srv.Store.User().Get(bot.OwnerId)
	if err != nil && err.Id != store.MISSING_ACCOUNT_ERROR {
		mlog.Error(err.Error())
		return nil, err
	} else if ownerUser != nil {
		// Send a message to the bot's creator to inform them that the bot needs to be added
		// to a team and channel after it's created
		channel, err := a.GetOrCreateDirectChannel(savedBot.UserId, bot.OwnerId)
		if err != nil {
			return nil, err
		}

		T := utils.GetUserTranslations(ownerUser.Locale)
		botAddPost := &model.Post{
			Type:      model.POST_ADD_BOT_TEAMS_CHANNELS,
			UserId:    savedBot.UserId,
			ChannelId: channel.Id,
			Message:   T("api.bot.teams_channels.add_message_mobile"),
		}

		if _, err := a.CreatePostAsUser(botAddPost, a.Session.Id); err != nil {
			return nil, err
		}
	}

	return savedBot, nil
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

	userUpdate, err := a.Srv.Store.User().Update(user, true)
	if err != nil {
		return nil, err
	}

	ruser := userUpdate.New
	a.sendUpdatedUserEvent(*ruser)

	return a.Srv.Store.Bot().Update(bot)
}

// GetBot returns the given bot.
func (a *App) GetBot(botUserId string, includeDeleted bool) (*model.Bot, *model.AppError) {
	return a.Srv.Store.Bot().Get(botUserId, includeDeleted)
}

// GetBots returns the requested page of bots.
func (a *App) GetBots(options *model.BotGetOptions) (model.BotList, *model.AppError) {
	return a.Srv.Store.Bot().GetAll(options)
}

// UpdateBotActive marks a bot as active or inactive, along with its corresponding user.
func (a *App) UpdateBotActive(botUserId string, active bool) (*model.Bot, *model.AppError) {
	user, err := a.Srv.Store.User().Get(botUserId)
	if err != nil {
		return nil, err
	}

	if _, err = a.UpdateActive(user, active); err != nil {
		return nil, err
	}

	bot, err := a.Srv.Store.Bot().Get(botUserId, true)
	if err != nil {
		return nil, err
	}

	changed := true
	if active && bot.DeleteAt != 0 {
		bot.DeleteAt = 0
	} else if !active && bot.DeleteAt == 0 {
		bot.DeleteAt = model.GetMillis()
	} else {
		changed = false
	}

	if changed {
		bot, err = a.Srv.Store.Bot().Update(bot)
		if err != nil {
			return nil, err
		}
	}

	return bot, nil
}

// PermanentDeleteBot permanently deletes a bot and its corresponding user.
func (a *App) PermanentDeleteBot(botUserId string) *model.AppError {
	if err := a.Srv.Store.Bot().PermanentDelete(botUserId); err != nil {
		return err
	}

	if err := a.Srv.Store.User().PermanentDelete(botUserId); err != nil {
		return err
	}

	return nil
}

// UpdateBotOwner changes a bot's owner to the given value.
func (a *App) UpdateBotOwner(botUserId, newOwnerId string) (*model.Bot, *model.AppError) {
	bot, err := a.Srv.Store.Bot().Get(botUserId, true)
	if err != nil {
		return nil, err
	}

	bot.OwnerId = newOwnerId

	bot, err = a.Srv.Store.Bot().Update(bot)
	if err != nil {
		return nil, err
	}

	return bot, nil
}

// disableUserBots disables all bots owned by the given user.
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

func (a *App) notifySysadminsBotOwnerDeactivated(userId string) *model.AppError {
	perPage := 25
	botOptions := &model.BotGetOptions{
		OwnerId:        userId,
		IncludeDeleted: false,
		OnlyOrphaned:   false,
		Page:           0,
		PerPage:        perPage,
	}
	// get owner bots
	var userBots []*model.Bot
	for {
		bots, err := a.GetBots(botOptions)
		if err != nil {
			return err
		}

		userBots = append(userBots, bots...)

		if len(bots) < perPage {
			break
		}

		botOptions.Page += 1
	}

	// user does not own bots
	if len(userBots) == 0 {
		return nil
	}

	userOptions := &model.UserGetOptions{
		Page:     0,
		PerPage:  perPage,
		Role:     model.SYSTEM_ADMIN_ROLE_ID,
		Inactive: false,
	}
	// get sysadmins
	var sysAdmins []*model.User
	for {
		sysAdminsList, err := a.GetUsers(userOptions)
		if err != nil {
			return err
		}

		sysAdmins = append(sysAdmins, sysAdminsList...)

		if len(sysAdminsList) < perPage {
			break
		}

		userOptions.Page += 1
	}

	// user being disabled
	user, err := a.GetUser(userId)
	if err != nil {
		return err
	}

	// for each sysadmin, notify user that owns bots was disabled
	for _, sysAdmin := range sysAdmins {
		channel, appErr := a.GetOrCreateDirectChannel(sysAdmin.Id, sysAdmin.Id)
		if appErr != nil {
			return appErr
		}

		post := &model.Post{
			UserId:    sysAdmin.Id,
			ChannelId: channel.Id,
			Message:   a.getDisableBotSysadminMessage(user, userBots),
			Type:      model.POST_SYSTEM_GENERIC,
		}

		_, appErr = a.CreatePost(post, channel, false)
		if appErr != nil {
			return appErr
		}
	}
	return nil
}

func (a *App) getDisableBotSysadminMessage(user *model.User, userBots model.BotList) string {
	disableBotsSetting := *a.Config().ServiceSettings.DisableBotsWhenOwnerIsDeactivated

	var printAllBots = true
	numBotsToPrint := len(userBots)

	if numBotsToPrint > 10 {
		numBotsToPrint = 10
		printAllBots = false
	}

	var message, botList string
	for _, bot := range userBots[:numBotsToPrint] {
		botList += fmt.Sprintf("* %v\n", bot.Username)
	}

	T := utils.GetUserTranslations(user.Locale)
	message = T("app.bot.get_disable_bot_sysadmin_message",
		map[string]interface{}{
			"UserName":           user.Username,
			"NumBots":            len(userBots),
			"BotNames":           botList,
			"disableBotsSetting": disableBotsSetting,
			"printAllBots":       printAllBots,
		})

	return message
}

// ConvertUserToBot converts a user to bot.
func (a *App) ConvertUserToBot(user *model.User) (*model.Bot, *model.AppError) {
	return a.Srv.Store.Bot().Save(model.BotFromUser(user))
}

// SetBotIconImageFromMultiPartFile sets LHS icon for a bot.
func (a *App) SetBotIconImageFromMultiPartFile(botUserId string, imageData *multipart.FileHeader) *model.AppError {
	file, err := imageData.Open()
	if err != nil {
		return model.NewAppError("SetBotIconImage", "api.bot.set_bot_icon_image.open.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	defer file.Close()

	file.Seek(0, 0)
	return a.SetBotIconImage(botUserId, file)
}

// SetBotIconImage sets LHS icon for a bot.
func (a *App) SetBotIconImage(botUserId string, file io.ReadSeeker) *model.AppError {
	bot, err := a.GetBot(botUserId, true)
	if err != nil {
		return err
	}

	if _, err := parseSVG(file); err != nil {
		return model.NewAppError("SetBotIconImage", "api.bot.set_bot_icon_image.parse.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	// Set icon
	file.Seek(0, 0)
	if _, err = a.WriteFile(file, getBotIconPath(botUserId)); err != nil {
		return model.NewAppError("SetBotIconImage", "api.bot.set_bot_icon_image.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	bot.LastIconUpdate = model.GetMillis()
	if _, err = a.Srv.Store.Bot().Update(bot); err != nil {
		return err
	}
	a.invalidateUserCacheAndPublish(botUserId)

	return nil
}

// DeleteBotIconImage deletes LHS icon for a bot.
func (a *App) DeleteBotIconImage(botUserId string) *model.AppError {
	bot, err := a.GetBot(botUserId, true)
	if err != nil {
		return err
	}

	// Delete icon
	if err = a.RemoveFile(getBotIconPath(botUserId)); err != nil {
		return model.NewAppError("DeleteBotIconImage", "api.bot.delete_bot_icon_image.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err = a.Srv.Store.User().UpdateLastPictureUpdate(botUserId); err != nil {
		mlog.Error(err.Error())
	}

	bot.LastIconUpdate = int64(0)
	if _, err = a.Srv.Store.Bot().Update(bot); err != nil {
		return err
	}

	a.invalidateUserCacheAndPublish(botUserId)

	return nil
}

// GetBotIconImage retrieves LHS icon for a bot.
func (a *App) GetBotIconImage(botUserId string) ([]byte, *model.AppError) {
	if _, err := a.GetBot(botUserId, true); err != nil {
		return nil, err
	}

	data, err := a.ReadFile(getBotIconPath(botUserId))
	if err != nil {
		return nil, model.NewAppError("GetBotIconImage", "api.bot.get_bot_icon_image.read.app_error", nil, err.Error(), http.StatusNotFound)
	}

	return data, nil
}

func getBotIconPath(botUserId string) string {
	return fmt.Sprintf("bots/%v/icon.svg", botUserId)
}
