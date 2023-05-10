// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

func (api *API) InitAction() {
	api.BaseRoutes.Post.Handle("/actions/{action_id:[A-Za-z0-9]+}", api.APISessionRequired(doPostAction)).Methods("POST")

	api.BaseRoutes.APIRoot.Handle("/actions/dialogs/open", api.APIHandler(openDialog)).Methods("POST")
	api.BaseRoutes.APIRoot.Handle("/actions/dialogs/submit", api.APISessionRequired(submitDialog)).Methods("POST")
}

func doPostAction(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var actionRequest model.DoPostActionRequest
	err := json.NewDecoder(r.Body).Decode(&actionRequest)
	if err != nil {
		c.Logger.Warn("Error decoding the action request", mlog.Err(err))
	}

	var cookie *model.PostActionCookie
	if actionRequest.Cookie != "" {
		cookie = &model.PostActionCookie{}
		cookieStr := ""
		cookieStr, err = model.DecryptPostActionCookie(actionRequest.Cookie, c.App.PostActionCookieSecret())
		if err != nil {
			c.Err = model.NewAppError("DoPostAction", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			return
		}
		err = json.Unmarshal([]byte(cookieStr), &cookie)
		if err != nil {
			c.Err = model.NewAppError("DoPostAction", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			return
		}
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), cookie.ChannelId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}
	}

	var appErr *model.AppError
	resp := &model.PostActionAPIResponse{Status: "OK"}

	resp.TriggerId, appErr = c.App.DoPostActionWithCookie(c.AppContext, c.Params.PostId, c.Params.ActionId, c.AppContext.Session().UserId,
		actionRequest.SelectedOption, cookie)
	if appErr != nil {
		c.Err = appErr
		return
	}

	err = json.NewEncoder(w).Encode(resp)
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func openDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	var dialog model.OpenDialogRequest
	err := json.NewDecoder(r.Body).Decode(&dialog)
	if err != nil {
		c.SetInvalidParamWithErr("dialog", err)
		return
	}

	if dialog.URL == "" {
		c.SetInvalidParam("url")
		return
	}

	if appErr := c.App.OpenInteractiveDialog(dialog); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func submitDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	var submit model.SubmitDialogRequest

	jsonErr := json.NewDecoder(r.Body).Decode(&submit)
	if jsonErr != nil {
		c.SetInvalidParamWithErr("dialog", jsonErr)
		return
	}

	if submit.URL == "" {
		c.SetInvalidParam("url")
		return
	}

	submit.UserId = c.AppContext.Session().UserId

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), submit.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), submit.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	resp, err := c.App.SubmitInteractiveDialog(c.AppContext, submit)
	if err != nil {
		c.Err = err
		return
	}

	b, _ := json.Marshal(resp)

	w.Write(b)
}
