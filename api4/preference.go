// // Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
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
	if preferences, err := app.GetPreferencesForUser(c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(preferences.ToJson()))
		return
	}
}

func getPreferencesByCategory(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireCategory()
	if c.Err != nil {
		return
	}

	if preferences, err := app.GetPreferenceByCategoryForUser(c.Session.UserId, c.Params.Category); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(preferences.ToJson()))
		return
	}
}

func getPreferenceByCategoryAndName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireCategory().RequirePreferenceName()
	if c.Err != nil {
		return
	}

	if preferences, err := app.GetPreferenceByCategoryAndNameForUser(c.Session.UserId, c.Params.Category, c.Params.PreferenceName); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(preferences.ToJson()))
		return
	}
}

func updatePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	preferences, err := model.PreferencesFromJson(r.Body)
	if err != nil {
		c.SetInvalidParam("preferences")
		return
	}

	for _, preference := range preferences {
		if c.Session.UserId != preference.UserId {
			c.Err = model.NewAppError("savePreferences", "api.preference.update_preferences.set.app_error", nil,
				c.T("api.preference.update_preferences.set_details.app_error",
					map[string]interface{}{"SessionUserId": c.Session.UserId, "PreferenceUserId": preference.UserId}),
				http.StatusForbidden)
			return
		}
	}

	if _, err := app.UpdatePreferences(preferences); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func deletePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	preferences, err := model.PreferencesFromJson(r.Body)
	if err != nil {
		c.SetInvalidParam("preferences")
		return
	}

	for _, preference := range preferences {
		if c.Session.UserId != preference.UserId {
			c.Err = model.NewAppError("deletePreferences", "api.preference.delete_preferences.delete.app_error", nil,
				c.T("api.preference.delete_preferences.delete.app_error",
					map[string]interface{}{"SessionUserId": c.Session.UserId, "PreferenceUserId": preference.UserId}),
				http.StatusForbidden)
			return
		}
	}

	if _, err := app.DeletePreferences(c.Session.UserId, preferences); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
