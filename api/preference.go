// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
)

func InitPreference(r *mux.Router) {
	l4g.Debug(utils.T("api.preference.init.debug"))

	sr := r.PathPrefix("/preferences").Subrouter()
	sr.Handle("/", ApiUserRequired(getAllPreferences)).Methods("GET")
	sr.Handle("/save", ApiUserRequired(savePreferences)).Methods("POST")
	sr.Handle("/{category:[A-Za-z0-9_]+}", ApiUserRequired(getPreferenceCategory)).Methods("GET")
	sr.Handle("/{category:[A-Za-z0-9_]+}/{name:[A-Za-z0-9_]+}", ApiUserRequired(getPreference)).Methods("GET")
}

func getAllPreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	if result := <-Srv.Store.Preference().GetAll(c.Session.UserId); result.Err != nil {
		c.Err = result.Err
	} else {
		data := result.Data.(model.Preferences)

		w.Write([]byte(data.ToJson()))
	}
}

func savePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	preferences, err := model.PreferencesFromJson(r.Body)
	if err != nil {
		c.Err = model.NewLocAppError("savePreferences", "api.preference.save_preferences.decode.app_error", nil, err.Error())
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	for _, preference := range preferences {
		if c.Session.UserId != preference.UserId {
			c.Err = model.NewLocAppError("savePreferences", "api.preference.save_preferences.set.app_error", nil,
				c.T("api.preference.save_preferences.set_details.app_error",
					map[string]interface{}{"SessionUserId": c.Session.UserId, "PreferenceUserId": preference.UserId}))
			c.Err.StatusCode = http.StatusUnauthorized
			return
		}
	}

	if result := <-Srv.Store.Preference().Save(&preferences); result.Err != nil {
		c.Err = result.Err
		return
	}

	w.Write([]byte("true"))
}

func getPreferenceCategory(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	category := params["category"]

	if result := <-Srv.Store.Preference().GetCategory(c.Session.UserId, category); result.Err != nil {
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

	if result := <-Srv.Store.Preference().Get(c.Session.UserId, category, name); result.Err != nil {
		c.Err = result.Err
	} else {
		data := result.Data.(model.Preference)
		w.Write([]byte(data.ToJson()))
	}
}
