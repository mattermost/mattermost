// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

const maxUpdatePreferences = 100

func (api *API) InitPreference() {
	api.BaseRoutes.Preferences.Handle("", api.APISessionRequired(getPreferences)).Methods(http.MethodGet)
	api.BaseRoutes.Preferences.Handle("", api.APISessionRequired(updatePreferences)).Methods(http.MethodPut)
	api.BaseRoutes.Preferences.Handle("/delete", api.APISessionRequired(deletePreferences)).Methods(http.MethodPost)
	api.BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}", api.APISessionRequired(getPreferencesByCategory)).Methods(http.MethodGet)
	api.BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}/name/{preference_name:[A-Za-z0-9_]+}", api.APISessionRequired(getPreferenceByCategoryAndName)).Methods(http.MethodGet)
}

func getPreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	preferences, err := c.App.GetPreferencesForUser(c.AppContext, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(preferences); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPreferencesByCategory(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireCategory()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	preferences, err := c.App.GetPreferenceByCategoryForUser(c.AppContext, c.Params.UserId, c.Params.Category)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(preferences); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPreferenceByCategoryAndName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireCategory().RequirePreferenceName()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	preferences, err := c.App.GetPreferenceByCategoryAndNameForUser(c.AppContext, c.Params.UserId, c.Params.Category, c.Params.PreferenceName)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(preferences); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updatePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("updatePreferences", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	var preferences model.Preferences
	err := model.StructFromJSONLimited(r.Body, &preferences)
	if err != nil {
		c.SetInvalidParamWithErr("preferences", err)
		return
	} else if len(preferences) == 0 || len(preferences) > maxUpdatePreferences {
		c.SetInvalidParam("preferences")
		return
	}

	var sanitizedPreferences model.Preferences
	channelMap := make(map[string]*model.Channel)

	for _, pref := range preferences {
		if pref.Category == model.PreferenceCategoryFlaggedPost {
			post, err := c.App.GetSinglePost(c.AppContext, pref.Name, false)
			if err != nil {
				c.SetInvalidParam("preference.name")
				return
			}

			channel, ok := channelMap[post.ChannelId]
			if !ok {
				channel, err = c.App.GetChannel(c.AppContext, post.ChannelId)
				if err != nil {
					c.Err = err
					return
				}
			}

			if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
				c.SetPermissionError(model.PermissionReadChannelContent)
				return
			}
		}

		sanitizedPreferences = append(sanitizedPreferences, pref)
	}

	if err := c.App.UpdatePreferences(c.AppContext, c.Params.UserId, sanitizedPreferences); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func deletePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deletePreferences", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	var preferences model.Preferences
	err := model.StructFromJSONLimited(r.Body, &preferences)
	if err != nil {
		c.SetInvalidParamWithErr("preferences", err)
		return
	} else if len(preferences) == 0 || len(preferences) > maxUpdatePreferences {
		c.SetInvalidParam("preferences")
		return
	}

	if err := c.App.DeletePreferences(c.AppContext, c.Params.UserId, preferences); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
