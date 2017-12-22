// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitPreference() {
	api.BaseRoutes.Preferences.Handle("/", api.ApiUserRequired(getAllPreferences)).Methods("GET")
	api.BaseRoutes.Preferences.Handle("/save", api.ApiUserRequired(savePreferences)).Methods("POST")
	api.BaseRoutes.Preferences.Handle("/delete", api.ApiUserRequired(deletePreferences)).Methods("POST")
	api.BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}", api.ApiUserRequired(getPreferenceCategory)).Methods("GET")
	api.BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}/{name:[A-Za-z0-9_]+}", api.ApiUserRequired(getPreference)).Methods("GET")
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
