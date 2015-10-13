// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"net/http"
)

func InitPreference(r *mux.Router) {
	l4g.Debug("Initializing preference api routes")

	sr := r.PathPrefix("/preferences").Subrouter()
	sr.Handle("/save", ApiAppHandler(savePreferences)).Methods("POST")
	sr.Handle("/{category:[A-Za-z0-9_]+}", ApiAppHandler(getPreferenceCategory)).Methods("GET")
	sr.Handle("/{category:[A-Za-z0-9_]+}/{name:[A-Za-z0-9_]+}", ApiAppHandler(getPreference)).Methods("GET")
}

func savePreferences(c *Context, w http.ResponseWriter, r *http.Request) {
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

		if len(data) == 0 {
			if category == model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW {
				// add direct channels for a user that existed before preferences were added
				data = addDirectChannels(c.Session.UserId, c.Session.TeamId)
			}
		}

		w.Write([]byte(data.ToJson()))
	}
}

func addDirectChannels(userId, teamId string) model.Preferences {
	var profiles map[string]*model.User
	if result := <-Srv.Store.User().GetProfiles(teamId); result.Err != nil {
		l4g.Error("Failed to add direct channel preferences for user user_id=%s, team_id=%s, err=%v", userId, teamId, result.Err.Error())
		return model.Preferences{}
	} else {
		profiles = result.Data.(map[string]*model.User)
	}

	var preferences model.Preferences

	for id := range profiles {
		if id == userId {
			continue
		}

		profile := profiles[id]

		preference := model.Preference{
			UserId:   userId,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     profile.Id,
			Value:    "true",
		}

		preferences = append(preferences, preference)

		if len(preferences) >= 10 {
			break
		}
	}

	if result := <-Srv.Store.Preference().Save(&preferences); result.Err != nil {
		l4g.Error("Failed to add direct channel preferences for user user_id=%s, eam_id=%s, err=%v", userId, teamId, result.Err.Error())
		return model.Preferences{}
	} else {
		return preferences
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
