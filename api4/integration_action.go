// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitAction() {
	api.BaseRoutes.Post.Handle("/actions/{action_id:[A-Za-z0-9]+}", api.ApiSessionRequired(doPostAction)).Methods("POST")

	api.BaseRoutes.ApiRoot.Handle("/actions/dialogs/open", api.ApiHandler(openDialog)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/actions/dialogs/submit", api.ApiSessionRequired(submitDialog)).Methods("POST")
}

func doPostAction(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	actionRequest := model.DoPostActionRequestFromJson(r.Body)
	if actionRequest == nil {
		actionRequest = &model.DoPostActionRequest{}
	}

	var cookie *model.PostActionCookie
	if actionRequest.Cookie != "" {
		cookie = &model.PostActionCookie{}
		cookieStr, err := model.DecryptPostActionCookie(actionRequest.Cookie, c.App.PostActionCookieSecret())
		if err != nil {
			c.Err = model.NewAppError("DoPostAction", "api.post.do_action.action_integration.app_error", nil, "err="+err.Error(), http.StatusBadRequest)
			return
		}
		err = json.Unmarshal([]byte(cookieStr), &cookie)
		if err != nil {
			c.Err = model.NewAppError("DoPostAction", "api.post.do_action.action_integration.app_error", nil, "err="+err.Error(), http.StatusBadRequest)
			return
		}
		if !c.App.SessionHasPermissionToChannel(c.App.Session, cookie.ChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannelByPost(c.App.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	var appErr *model.AppError
	resp := &model.PostActionAPIResponse{Status: "OK"}

	resp.TriggerId, appErr = c.App.DoPostActionWithCookie(c.Params.PostId, c.Params.ActionId, c.App.Session.UserId,
		actionRequest.SelectedOption, cookie)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, _ := json.Marshal(resp)
	w.Write(b)
}

func openDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	var dialog model.OpenDialogRequest
	err := json.NewDecoder(r.Body).Decode(&dialog)
	if err != nil {
		c.SetInvalidParam("dialog")
		return
	}

	if dialog.URL == "" {
		c.SetInvalidParam("url")
		return
	}

	if err := c.App.OpenInteractiveDialog(dialog); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func submitDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	var submit model.SubmitDialogRequest

	jsonErr := json.NewDecoder(r.Body).Decode(&submit)
	if jsonErr != nil {
		c.SetInvalidParam("dialog")
		return
	}

	if submit.URL == "" {
		c.SetInvalidParam("url")
		return
	}

	submit.UserId = c.App.Session.UserId

	if !c.App.SessionHasPermissionToChannel(c.App.Session, submit.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.App.Session, submit.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	resp, err := c.App.SubmitInteractiveDialog(submit)
	if err != nil {
		c.Err = err
		return
	}

	b, _ := json.Marshal(resp)

	w.Write(b)
}
