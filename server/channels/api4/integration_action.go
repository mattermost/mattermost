// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitAction() {
	api.BaseRoutes.Post.Handle("/actions/{action_id:[A-Za-z0-9]+}", api.APISessionRequired(doPostAction)).Methods(http.MethodPost)

	api.BaseRoutes.APIRoot.Handle("/actions/dialogs/open", api.APIHandler(openDialog)).Methods(http.MethodPost)
	api.BaseRoutes.APIRoot.Handle("/actions/dialogs/submit", api.APISessionRequired(submitDialog)).Methods(http.MethodPost)
	api.BaseRoutes.APIRoot.Handle("/actions/dialogs/lookup", api.APISessionRequired(lookupDialog)).Methods(http.MethodPost)
}

func doPostAction(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var actionRequest model.DoPostActionRequest
	err := json.NewDecoder(r.Body).Decode(&actionRequest)
	if err != nil && !errors.Is(err, io.EOF) {
		// Empty body is allowed for backward-compatibility with older clients.
		// Any other decode failure means the request cannot be trusted — in
		// particular, a wrong-type inline_context would otherwise fall through
		// as nil and silently execute the action without the caller's params.
		c.SetInvalidParamWithErr("action_request", err)
		return
	}

	if ctxErr := model.ValidateInlineContext(actionRequest.InlineContext); ctxErr != nil {
		c.Err = model.NewAppError("DoPostAction", "api.post.do_action.inline_context.app_error", nil, "", http.StatusBadRequest).Wrap(ctxErr)
		return
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
		channel, err := c.App.GetChannel(c.AppContext, cookie.ChannelId)
		if err != nil {
			c.Err = err
			return
		}
		if ok, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !ok {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	} else {
		if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), c.Params.PostId); !ok {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	}

	var appErr *model.AppError
	resp := &model.PostActionAPIResponse{Status: "OK"}

	resp.TriggerId, appErr = c.App.DoPostActionWithCookie(c.AppContext, c.Params.PostId, c.Params.ActionId, c.AppContext.Session().UserId,
		actionRequest.SelectedOption, cookie, actionRequest.InlineContext)
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

	if appErr := c.App.OpenInteractiveDialog(c.AppContext, dialog); appErr != nil {
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

	channel, err := c.App.GetChannel(c.AppContext, submit.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	if ok, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
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

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func lookupDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	var lookup model.SubmitDialogRequest

	jsonErr := json.NewDecoder(r.Body).Decode(&lookup)
	if jsonErr != nil {
		c.SetInvalidParamWithErr("dialog", jsonErr)
		return
	}

	if lookup.URL == "" {
		c.SetInvalidParam("url")
		return
	}

	// Validate URL for security
	if !model.IsValidLookupURL(lookup.URL) {
		c.SetInvalidParam("url")
		return
	}

	lookup.UserId = c.AppContext.Session().UserId

	channel, err := c.App.GetChannel(c.AppContext, lookup.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	if ok, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), lookup.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	c.Logger.Debug("Performing lookup dialog request",
		mlog.String("url", lookup.URL),
		mlog.String("user_id", lookup.UserId),
		mlog.String("channel_id", lookup.ChannelId),
		mlog.String("team_id", lookup.TeamId),
		mlog.Any("selected_field", lookup.Submission["selected_field"]),
		mlog.Any("query", lookup.Submission["query"]),
	)

	resp, err := c.App.LookupInteractiveDialog(c.AppContext, lookup)
	if err != nil {
		c.Logger.Error("Error performing lookup dialog", mlog.Err(err))
		c.Err = err
		return
	}

	b, _ := json.Marshal(resp)

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
