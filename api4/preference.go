// // Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// // See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitPreference() {
	l4g.Debug(utils.T("api.preference.init.debug"))

	BaseRoutes.Preferences.Handle("", ApiSessionRequired(getPreferences)).Methods("GET")
	BaseRoutes.Preferences.Handle("", ApiSessionRequired(updatePreferences)).Methods("PUT")
	BaseRoutes.Preferences.Handle("/delete", ApiSessionRequired(deletePreferences)).Methods("POST")
	BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}", ApiSessionRequired(getPreferencesByCategory)).Methods("GET")
	BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}/name/{preference_name:[A-Za-z0-9_]+}", ApiSessionRequired(getPreferenceByCategoryAndName)).Methods("GET")
}

func getPreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if preferences, err := app.GetPreferencesForUser(c.Params.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(preferences.ToJson()))
		return
	}
}

func getPreferencesByCategory(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireCategory()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if preferences, err := app.GetPreferenceByCategoryForUser(c.Params.UserId, c.Params.Category); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(preferences.ToJson()))
		return
	}
}

func getPreferenceByCategoryAndName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireCategory().RequirePreferenceName()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if preferences, err := app.GetPreferenceByCategoryAndNameForUser(c.Params.UserId, c.Params.Category, c.Params.PreferenceName); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(preferences.ToJson()))
		return
	}
}

func updatePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	preferences, err := model.PreferencesFromJson(r.Body)
	if err != nil {
		c.SetInvalidParam("preferences")
		return
	}

	if err := app.UpdatePreferences(c.Params.UserId, preferences); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func deletePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	preferences, err := model.PreferencesFromJson(r.Body)
	if err != nil {
		c.SetInvalidParam("preferences")
		return
	}

	if err := app.DeletePreferences(c.Params.UserId, preferences); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
