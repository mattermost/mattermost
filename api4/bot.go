// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitBot() {
	api.BaseRoutes.Bots.Handle("", api.ApiHandler(createBot)).Methods("POST")
	api.BaseRoutes.Bot.Handle("", api.ApiSessionRequired(patchBot)).Methods("PUT")
	api.BaseRoutes.Bot.Handle("", api.ApiSessionRequired(getBot)).Methods("GET")
	api.BaseRoutes.Bots.Handle("", api.ApiSessionRequired(getBots)).Methods("GET")
	api.BaseRoutes.Bot.Handle("/disable", api.ApiSessionRequired(disableBot)).Methods("POST")
}

func sessionHasPermissionToManageBot(c *Context, userId string) *model.AppError {
	existingBot, err := c.App.GetBot(c.Params.UserId, true)
	if err != nil {
		return err
	}

	if existingBot.CreatorId == c.App.Session.UserId {
		if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_BOTS) {
			return c.MakePermissionError(model.PERMISSION_MANAGE_BOTS)
		}
	} else {
		if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_OTHERS_BOTS) {
			return c.MakePermissionError(model.PERMISSION_MANAGE_OTHERS_BOTS)
		}
	}

	return nil
}

func createBot(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_CREATE_BOT) {
		c.SetPermissionError(model.PERMISSION_CREATE_BOT)
		return
	}

	botPatch := model.BotPatchFromJson(r.Body)
	if botPatch == nil {
		c.SetInvalidParam("bot")
		return
	}

	bot := &model.Bot{
		CreatorId: c.App.Session.UserId,
	}
	bot.Patch(botPatch)

	createdBot, err := c.App.CreateBot(bot)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write(createdBot.ToJson())
}

func patchBot(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if err := sessionHasPermissionToManageBot(c, c.Params.UserId); err != nil {
		c.Err = err
		return
	}

	botPatch := model.BotPatchFromJson(r.Body)
	if botPatch == nil {
		c.SetInvalidParam("bot")
		return
	}

	updatedBot, err := c.App.PatchBot(c.Params.UserId, botPatch)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(updatedBot.ToJson())
}

func getBot(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_READ_BOTS) {
		c.SetPermissionError(model.PERMISSION_READ_BOTS)
		return
	}

	c.RequireUserId()
	if c.Err != nil {
		return
	}

	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	bot, err := c.App.GetBot(c.Params.UserId, includeDeleted)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(bot.ToJson())
}

func getBots(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_READ_BOTS) {
		c.SetPermissionError(model.PERMISSION_READ_BOTS)
		return
	}

	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	bots, err := c.App.GetBots(c.Params.Page, c.Params.PerPage, includeDeleted)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(model.BotListToJson(bots))
}

func disableBot(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if err := sessionHasPermissionToManageBot(c, c.Params.UserId); err != nil {
		c.Err = err
		return
	}

	bot, err := c.App.DisableBot(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(bot.ToJson())
}
