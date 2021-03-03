// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitBot() {
	api.BaseRoutes.Bots.Handle("", api.ApiSessionRequired(createBot)).Methods("POST")
	api.BaseRoutes.Bot.Handle("", api.ApiSessionRequired(patchBot)).Methods("PUT")
	api.BaseRoutes.Bot.Handle("", api.ApiSessionRequired(getBot)).Methods("GET")
	api.BaseRoutes.Bots.Handle("", api.ApiSessionRequired(getBots)).Methods("GET")
	api.BaseRoutes.Bot.Handle("/disable", api.ApiSessionRequired(disableBot)).Methods("POST")
	api.BaseRoutes.Bot.Handle("/enable", api.ApiSessionRequired(enableBot)).Methods("POST")
	api.BaseRoutes.Bot.Handle("/convert_to_user", api.ApiSessionRequired(convertBotToUser)).Methods("POST")
	api.BaseRoutes.Bot.Handle("/assign/{user_id:[A-Za-z0-9]+}", api.ApiSessionRequired(assignBot)).Methods("POST")

	api.BaseRoutes.Bot.Handle("/icon", api.ApiSessionRequiredTrustRequester(getBotIconImage)).Methods("GET")
	api.BaseRoutes.Bot.Handle("/icon", api.ApiSessionRequired(setBotIconImage)).Methods("POST")
	api.BaseRoutes.Bot.Handle("/icon", api.ApiSessionRequired(deleteBotIconImage)).Methods("DELETE")
}

func createBot(c *Context, w http.ResponseWriter, r *http.Request) {
	botPatch := model.BotPatchFromJson(r.Body)
	if botPatch == nil {
		c.SetInvalidParam("bot")
		return
	}

	bot := &model.Bot{
		OwnerId: c.App.Session().UserId,
	}
	bot.Patch(botPatch)

	auditRec := c.MakeAuditRecord("createBot", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("bot", bot)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_CREATE_BOT) {
		c.SetPermissionError(model.PERMISSION_CREATE_BOT)
		return
	}

	if user, err := c.App.GetUser(c.App.Session().UserId); err == nil {
		if user.IsBot {
			c.SetPermissionError(model.PERMISSION_CREATE_BOT)
			return
		}
	}

	if !*c.App.Config().ServiceSettings.EnableBotAccountCreation {
		c.Err = model.NewAppError("createBot", "api.bot.create_disabled", nil, "", http.StatusForbidden)
		return
	}

	createdBot, err := c.App.CreateBot(bot)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("bot", createdBot) // overwrite meta

	w.WriteHeader(http.StatusCreated)
	w.Write(createdBot.ToJson())
}

func patchBot(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	botPatch := model.BotPatchFromJson(r.Body)
	if botPatch == nil {
		c.SetInvalidParam("bot")
		return
	}

	auditRec := c.MakeAuditRecord("patchBot", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("bot_id", botUserId)

	if err := c.App.SessionHasPermissionToManageBot(*c.App.Session(), botUserId); err != nil {
		c.Err = err
		return
	}

	updatedBot, err := c.App.PatchBot(botUserId, botPatch)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("bot", updatedBot)

	w.Write(updatedBot.ToJson())
}

func getBot(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))

	bot, appErr := c.App.GetBot(botUserId, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_READ_OTHERS_BOTS) {
		// Allow access to any bot.
	} else if bot.OwnerId == c.App.Session().UserId {
		if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_READ_BOTS) {
			// Pretend like the bot doesn't exist at all to avoid revealing that the
			// user is a bot. It's kind of silly in this case, sine we created the bot,
			// but we don't have read bot permissions.
			c.Err = model.MakeBotNotFoundError(botUserId)
			return
		}
	} else {
		// Pretend like the bot doesn't exist at all, to avoid revealing that the
		// user is a bot.
		c.Err = model.MakeBotNotFoundError(botUserId)
		return
	}

	if c.HandleEtag(bot.Etag(), "Get Bot", w, r) {
		return
	}

	w.Write(bot.ToJson())
}

func getBots(c *Context, w http.ResponseWriter, r *http.Request) {
	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	onlyOrphaned, _ := strconv.ParseBool(r.URL.Query().Get("only_orphaned"))

	var OwnerId string
	if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_READ_OTHERS_BOTS) {
		// Get bots created by any user.
		OwnerId = ""
	} else if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_READ_BOTS) {
		// Only get bots created by this user.
		OwnerId = c.App.Session().UserId
	} else {
		c.SetPermissionError(model.PERMISSION_READ_BOTS)
		return
	}

	bots, appErr := c.App.GetBots(&model.BotGetOptions{
		Page:           c.Params.Page,
		PerPage:        c.Params.PerPage,
		OwnerId:        OwnerId,
		IncludeDeleted: includeDeleted,
		OnlyOrphaned:   onlyOrphaned,
	})
	if appErr != nil {
		c.Err = appErr
		return
	}

	if c.HandleEtag(bots.Etag(), "Get Bots", w, r) {
		return
	}

	w.Write(bots.ToJson())
}

func disableBot(c *Context, w http.ResponseWriter, _ *http.Request) {
	updateBotActive(c, w, false)
}

func enableBot(c *Context, w http.ResponseWriter, _ *http.Request) {
	updateBotActive(c, w, true)
}

func updateBotActive(c *Context, w http.ResponseWriter, active bool) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	auditRec := c.MakeAuditRecord("updateBotActive", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("bot_id", botUserId)
	auditRec.AddMeta("enable", active)

	if err := c.App.SessionHasPermissionToManageBot(*c.App.Session(), botUserId); err != nil {
		c.Err = err
		return
	}

	bot, err := c.App.UpdateBotActive(botUserId, active)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("bot", bot)

	w.Write(bot.ToJson())
}

func assignBot(c *Context, w http.ResponseWriter, _ *http.Request) {
	c.RequireUserId()
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId
	userId := c.Params.UserId

	auditRec := c.MakeAuditRecord("assignBot", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("bot_id", botUserId)
	auditRec.AddMeta("assign_user_id", userId)

	if err := c.App.SessionHasPermissionToManageBot(*c.App.Session(), botUserId); err != nil {
		c.Err = err
		return
	}

	if user, err := c.App.GetUser(userId); err == nil {
		if user.IsBot {
			c.SetPermissionError(model.PERMISSION_ASSIGN_BOT)
			return
		}
	}

	bot, err := c.App.UpdateBotOwner(botUserId, userId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("bot", bot)

	w.Write(bot.ToJson())
}

func getBotIconImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	canSee, err := c.App.UserCanSeeOtherUser(c.App.Session().UserId, botUserId)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	img, err := c.App.GetBotIconImage(botUserId)
	if err != nil {
		c.Err = err
		return
	}

	user, err := c.App.GetUser(botUserId)
	if err != nil {
		c.Err = err
		return
	}

	etag := strconv.FormatInt(user.LastPictureUpdate, 10)
	if c.HandleEtag(etag, "Get Icon Image", w, r) {
		return
	}

	w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, private", 24*60*60)) // 24 hrs
	w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Write(img)
}

func setBotIconImage(c *Context, w http.ResponseWriter, r *http.Request) {
	defer io.Copy(ioutil.Discard, r.Body)

	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	auditRec := c.MakeAuditRecord("setBotIconImage", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("bot_id", botUserId)

	if err := c.App.SessionHasPermissionToManageBot(*c.App.Session(), botUserId); err != nil {
		c.Err = err
		return
	}

	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("setBotIconImage", "api.bot.set_bot_icon_image.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewAppError("setBotIconImage", "api.bot.set_bot_icon_image.parse.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm
	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewAppError("setBotIconImage", "api.bot.set_bot_icon_image.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(imageArray) <= 0 {
		c.Err = model.NewAppError("setBotIconImage", "api.bot.set_bot_icon_image.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	imageData := imageArray[0]
	if err := c.App.SetBotIconImageFromMultiPartFile(botUserId, imageData); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func deleteBotIconImage(c *Context, w http.ResponseWriter, r *http.Request) {
	defer io.Copy(ioutil.Discard, r.Body)

	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	auditRec := c.MakeAuditRecord("deleteBotIconImage", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("bot_id", botUserId)

	if err := c.App.SessionHasPermissionToManageBot(*c.App.Session(), botUserId); err != nil {
		c.Err = err
		return
	}

	if err := c.App.DeleteBotIconImage(botUserId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func convertBotToUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}

	bot, err := c.App.GetBot(c.Params.BotUserId, false)
	if err != nil {
		c.Err = err
		return
	}

	userPatch := model.UserPatchFromJson(r.Body)
	if userPatch == nil || userPatch.Password == nil || *userPatch.Password == "" {
		c.SetInvalidParam("userPatch")
		return
	}

	systemAdmin, _ := strconv.ParseBool(r.URL.Query().Get("set_system_admin"))

	auditRec := c.MakeAuditRecord("convertBotToUser", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("bot", bot)
	auditRec.AddMeta("userPatch", userPatch)
	auditRec.AddMeta("set_system_admin", systemAdmin)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	user, err := c.App.ConvertBotToUser(bot, userPatch, systemAdmin)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("convertedTo", user)

	w.Write([]byte(user.ToJson()))
}
