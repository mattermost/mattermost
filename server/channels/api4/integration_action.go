// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
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

// getStringValue safely converts an interface{} value to a string with logging for failures.
// It handles nil values gracefully and logs warnings when conversion fails.
func getStringValue(val any, fieldName string, logger *mlog.Logger) string {
	if val == nil {
		return ""
	}
	if str, ok := val.(string); ok {
		return str
	}
	logger.Warn("Failed to convert field to string",
		mlog.String("field", fieldName),
		mlog.String("type", fmt.Sprintf("%T", val)),
		mlog.Any("value", val))
	return ""
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
		channel, err := c.App.GetChannel(c.AppContext, cookie.ChannelId)
		if err != nil {
			c.Err = err
			return
		}
		if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannelContent) {
			c.SetPermissionError(model.PermissionReadChannelContent)
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
	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
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

// lookupDialog handles API requests for dynamic dialog element lookups.
// It validates the request URL for security, checks user permissions, and
// delegates to the app layer for the actual lookup operation.
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
	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
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
		mlog.String("selected_field", getStringValue(lookup.Submission["selected_field"], "selected_field", c.Logger)),
		mlog.String("query", getStringValue(lookup.Submission["query"], "query", c.Logger)),
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
