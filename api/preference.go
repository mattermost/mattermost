// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"net/http"
	"github.com/mattermost/platform/i18n"
)

func InitPreference(r *mux.Router) {
	l4g.Debug("Initializing preference api routes")

	sr := r.PathPrefix("/preferences").Subrouter()
	sr.Handle("/", ApiUserRequired(getAllPreferences)).Methods("GET")
	sr.Handle("/save", ApiUserRequired(savePreferences)).Methods("POST")
	sr.Handle("/{category:[A-Za-z0-9_]+}", ApiUserRequired(getPreferenceCategory)).Methods("GET")
	sr.Handle("/{category:[A-Za-z0-9_]+}/{name:[A-Za-z0-9_]+}", ApiUserRequired(getPreference)).Methods("GET")
}

func getAllPreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if result := <-Srv.Store.Preference().GetAll(c.Session.UserId, T); result.Err != nil {
		c.Err = result.Err
	} else {
		data := result.Data.(model.Preferences)

		w.Write([]byte(data.ToJson()))
	}
}

func savePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	preferences, err := model.PreferencesFromJson(r.Body)
	if err != nil {
		c.Err = model.NewAppError("savePreferences", "Unable to decode preferences from request", err.Error())
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	for _, preference := range preferences {
		if c.Session.UserId != preference.UserId {
			c.Err = model.NewAppError("savePreferences", "Unable to set preferences for other user", "session.user_id="+c.Session.UserId+", preference.user_id="+preference.UserId)
			c.Err.StatusCode = http.StatusUnauthorized
			return
		}
	}

	if result := <-Srv.Store.Preference().Save(&preferences, T); result.Err != nil {
		c.Err = result.Err
		return
	}

	w.Write([]byte("true"))
}

func getPreferenceCategory(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	params := mux.Vars(r)
	category := params["category"]

	if result := <-Srv.Store.Preference().GetCategory(c.Session.UserId, category, T); result.Err != nil {
		c.Err = result.Err
	} else {
		data := result.Data.(model.Preferences)

		w.Write([]byte(data.ToJson()))
	}
}

func getPreference(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	params := mux.Vars(r)
	category := params["category"]
	name := params["name"]

	if result := <-Srv.Store.Preference().Get(c.Session.UserId, category, name, T); result.Err != nil {
		c.Err = result.Err
	} else {
		data := result.Data.(model.Preference)
		w.Write([]byte(data.ToJson()))
	}
}
