// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"encoding/json"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"net/http"
)

func InitPreference(r *mux.Router) {
	l4g.Debug("Initializing preference api routes")

	sr := r.PathPrefix("/preferences").Subrouter()
	sr.Handle("/set", ApiAppHandler(setPreferences)).Methods("POST")
	sr.Handle("/{category:[A-Za-z0-9_]+}/{name:[A-Za-z0-9_]+}", ApiAppHandler(getPreferencesByName)).Methods("GET")
}

func setPreferences(c *Context, w http.ResponseWriter, r *http.Request) {
	var preferences []*model.Preference

	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&preferences); err != nil {
		c.Err = model.NewAppError("setPreferences", "Unable to decode preferences from request", err.Error())
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	for _, preference := range preferences {
		if c.Session.UserId != preference.UserId {
			c.Err = model.NewAppError("setPreferences", "Unable to set preferences for other user", "session.user_id="+c.Session.UserId+", preference.user_id="+preference.UserId)
			c.Err.StatusCode = http.StatusUnauthorized
			return
		}
	}

	if result := <-Srv.Store.Preference().SaveOrUpdate(preferences...); result.Err != nil {
		c.Err = result.Err
		return
	}

	w.Write([]byte("true"))
}

func getPreferencesByName(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	category := params["category"]
	name := params["name"]

	if result := <-Srv.Store.Preference().GetByName(c.Session.UserId, category, name); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		data := result.Data.([]*model.Preference)

		if len(data) == 0 {
			if category == model.PREFERENCE_CATEGORY_DIRECT_CHANNELS && name == model.PREFERENCE_NAME_SHOW {
				// add direct channels for a user that existed before preferences were added
				data = addDirectChannels(c.Session.UserId, c.Session.TeamId)
			}
		}

		w.Write([]byte(model.PreferenceListToJson(data)))
	}
}

func addDirectChannels(userId, teamId string) []*model.Preference {
	var profiles map[string]*model.User
	if result := <-Srv.Store.User().GetProfiles(teamId); result.Err != nil {
		l4g.Error("Failed to add direct channel preferences for user user_id=%s, team_id=%s, err=%v", userId, teamId, result.Err.Error())
		return []*model.Preference{}
	} else {
		profiles = result.Data.(map[string]*model.User)
	}

	var preferences []*model.Preference

	for id := range profiles {
		if id == userId {
			continue
		}

		profile := profiles[id]

		preference := &model.Preference{
			UserId:   userId,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNELS,
			Name:     model.PREFERENCE_NAME_SHOW,
			AltId:    profile.Id,
			Value:    "true",
		}

		if result := <-Srv.Store.Preference().Save(preference); result.Err != nil {
			l4g.Error("Failed to add direct channel preferences for user user_id=%s, alt_id=%s, team_id=%s, err=%v", userId, profile.Id, teamId, result.Err.Error())
			continue
		}

		preferences = append(preferences, preference)

		if len(preferences) >= 10 {
			break
		}
	}

	return preferences
}
