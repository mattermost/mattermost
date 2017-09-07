// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func InitPreference() {
	l4g.Debug(utils.T("api.preference.init.debug"))

	BaseRoutes.Preferences.Handle("/", ApiUserRequired(getAllPreferences)).Methods("GET")
	BaseRoutes.Preferences.Handle("/save", ApiUserRequired(savePreferences)).Methods("POST")
	BaseRoutes.Preferences.Handle("/delete", ApiUserRequired(deletePreferences)).Methods("POST")
	BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}", ApiUserRequired(getPreferenceCategory)).Methods("GET")
	BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}/{name:[A-Za-z0-9_]+}", ApiUserRequired(getPreference)).Methods("GET")
}

func getAllPreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	if result := <-c.App.Srv.Store.Preference().GetAll(c.Session.UserId); result.Err != nil {
		c.Err = result.Err
	} else {
		data := result.Data.(model.Preferences)

		w.Write([]byte(data.ToJson()))
	}
}

func savePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	preferences, err := model.PreferencesFromJson(r.Body)
	if err != nil {
		c.Err = model.NewAppError("savePreferences", "api.preference.save_preferences.decode.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	if err := c.App.UpdatePreferences(c.Session.UserId, preferences); err != nil {
		c.Err = err
		return
	}

	w.Write([]byte("true"))
}

func getPreferenceCategory(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	category := params["category"]

	if result := <-c.App.Srv.Store.Preference().GetCategory(c.Session.UserId, category); result.Err != nil {
		c.Err = result.Err
	} else {
		data := result.Data.(model.Preferences)

		w.Write([]byte(data.ToJson()))
	}
}

func getPreference(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	category := params["category"]
	name := params["name"]

	if result := <-c.App.Srv.Store.Preference().Get(c.Session.UserId, category, name); result.Err != nil {
		c.Err = result.Err
	} else {
		data := result.Data.(model.Preference)
		w.Write([]byte(data.ToJson()))
	}
}

func deletePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	preferences, err := model.PreferencesFromJson(r.Body)
	if err != nil {
		c.Err = model.NewAppError("savePreferences", "api.preference.delete_preferences.decode.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	if err := c.App.DeletePreferences(c.Session.UserId, preferences); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
