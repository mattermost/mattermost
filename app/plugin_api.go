// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"

	"github.com/mattermost/mattermost-server/plugin"
)

type PluginAPI struct {
	id            string
	app           *App
	keyValueStore *PluginKeyValueStore
}

type PluginKeyValueStore struct {
	id  string
	app *App
}

func (api *PluginAPI) LoadPluginConfiguration(dest interface{}) error {
	if b, err := json.Marshal(api.app.Config().PluginSettings.Plugins[api.id]); err != nil {
		return err
	} else {
		return json.Unmarshal(b, dest)
	}
}

func (api *PluginAPI) RegisterCommand(command *model.Command) error {
	return api.app.RegisterPluginCommand(api.id, command)
}

func (api *PluginAPI) UnregisterCommand(teamId, trigger string) error {
	api.app.UnregisterPluginCommand(api.id, teamId, trigger)
	return nil
}

func (api *PluginAPI) CreateTeam(team *model.Team) (*model.Team, *model.AppError) {
	return api.app.CreateTeam(team)
}

func (api *PluginAPI) DeleteTeam(teamId string) *model.AppError {
	return api.app.SoftDeleteTeam(teamId)
}

func (api *PluginAPI) GetTeam(teamId string) (*model.Team, *model.AppError) {
	return api.app.GetTeam(teamId)
}

func (api *PluginAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	return api.app.GetTeamByName(name)
}

func (api *PluginAPI) UpdateTeam(team *model.Team) (*model.Team, *model.AppError) {
	return api.app.UpdateTeam(team)
}

func (api *PluginAPI) CreateUser(user *model.User) (*model.User, *model.AppError) {
	return api.app.CreateUser(user)
}

func (api *PluginAPI) DeleteUser(userId string) *model.AppError {
	user, err := api.app.GetUser(userId)
	if err != nil {
		return err
	}
	_, err = api.app.UpdateActive(user, false)
	return err
}

func (api *PluginAPI) GetUser(userId string) (*model.User, *model.AppError) {
	return api.app.GetUser(userId)
}

func (api *PluginAPI) GetUserByEmail(email string) (*model.User, *model.AppError) {
	return api.app.GetUserByEmail(email)
}

func (api *PluginAPI) GetUserByUsername(name string) (*model.User, *model.AppError) {
	return api.app.GetUserByUsername(name)
}

func (api *PluginAPI) UpdateUser(user *model.User) (*model.User, *model.AppError) {
	return api.app.UpdateUser(user, true)
}

func (api *PluginAPI) CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	return api.app.CreateChannel(channel, false)
}

func (api *PluginAPI) DeleteChannel(channelId string) *model.AppError {
	channel, err := api.app.GetChannel(channelId)
	if err != nil {
		return err
	}
	return api.app.DeleteChannel(channel, "")
}

func (api *PluginAPI) GetChannel(channelId string) (*model.Channel, *model.AppError) {
	return api.app.GetChannel(channelId)
}

func (api *PluginAPI) GetChannelByName(name, teamId string) (*model.Channel, *model.AppError) {
	return api.app.GetChannelByName(name, teamId)
}

func (api *PluginAPI) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	return api.app.GetDirectChannel(userId1, userId2)
}

func (api *PluginAPI) GetGroupChannel(userIds []string) (*model.Channel, *model.AppError) {
	return api.app.CreateGroupChannel(userIds, "")
}

func (api *PluginAPI) UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	return api.app.UpdateChannel(channel)
}

func (api *PluginAPI) AddChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	// For now, don't allow overriding these via the plugin API.
	userRequestorId := ""
	postRootId := ""

	channel, err := api.GetChannel(channelId)
	if err != nil {
		return nil, err
	}

	return api.app.AddChannelMember(userId, channel, userRequestorId, postRootId)
}

func (api *PluginAPI) GetChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	return api.app.GetChannelMember(channelId, userId)
}

func (api *PluginAPI) UpdateChannelMemberRoles(channelId, userId, newRoles string) (*model.ChannelMember, *model.AppError) {
	return api.app.UpdateChannelMemberRoles(channelId, userId, newRoles)
}

func (api *PluginAPI) UpdateChannelMemberNotifications(channelId, userId string, notifications map[string]string) (*model.ChannelMember, *model.AppError) {
	return api.app.UpdateChannelMemberNotifyProps(notifications, channelId, userId)
}

func (api *PluginAPI) DeleteChannelMember(channelId, userId string) *model.AppError {
	return api.app.LeaveChannel(channelId, userId)
}

func (api *PluginAPI) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	return api.app.CreatePostMissingChannel(post, true)
}

func (api *PluginAPI) DeletePost(postId string) *model.AppError {
	_, err := api.app.DeletePost(postId)
	return err
}

func (api *PluginAPI) GetPost(postId string) (*model.Post, *model.AppError) {
	return api.app.GetSinglePost(postId)
}

func (api *PluginAPI) UpdatePost(post *model.Post) (*model.Post, *model.AppError) {
	return api.app.UpdatePost(post, false)
}

func (api *PluginAPI) KeyValueStore() plugin.KeyValueStore {
	return api.keyValueStore
}

func (s *PluginKeyValueStore) Set(key string, value []byte) *model.AppError {
	return s.app.SetPluginKey(s.id, key, value)
}

func (s *PluginKeyValueStore) Get(key string) ([]byte, *model.AppError) {
	return s.app.GetPluginKey(s.id, key)
}

func (s *PluginKeyValueStore) Delete(key string) *model.AppError {
	return s.app.DeletePluginKey(s.id, key)
}

type BuiltInPluginAPI struct {
	id     string
	router *mux.Router
	app    *App
}

func (api *BuiltInPluginAPI) LoadPluginConfiguration(dest interface{}) error {
	if b, err := json.Marshal(api.app.Config().PluginSettings.Plugins[api.id]); err != nil {
		return err
	} else {
		return json.Unmarshal(b, dest)
	}
}

func (api *BuiltInPluginAPI) PluginRouter() *mux.Router {
	return api.router
}

func (api *BuiltInPluginAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	return api.app.GetTeamByName(name)
}

func (api *BuiltInPluginAPI) GetUserByName(name string) (*model.User, *model.AppError) {
	return api.app.GetUserByUsername(name)
}

func (api *BuiltInPluginAPI) GetChannelByName(teamId, name string) (*model.Channel, *model.AppError) {
	return api.app.GetChannelByName(name, teamId)
}

func (api *BuiltInPluginAPI) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	return api.app.GetDirectChannel(userId1, userId2)
}

func (api *BuiltInPluginAPI) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	return api.app.CreatePostMissingChannel(post, true)
}

func (api *BuiltInPluginAPI) GetLdapUserAttributes(userId string, attributes []string) (map[string]string, *model.AppError) {
	if api.app.Ldap == nil {
		return nil, model.NewAppError("GetLdapUserAttributes", "ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	user, err := api.app.GetUser(userId)
	if err != nil {
		return nil, err
	}

	if user.AuthData == nil {
		return map[string]string{}, nil
	}

	return api.app.Ldap.GetUserAttributes(*user.AuthData, attributes)
}

func (api *BuiltInPluginAPI) GetSessionFromRequest(r *http.Request) (*model.Session, *model.AppError) {
	token := ""
	isTokenFromQueryString := false

	// Attempt to parse token out of the header
	authHeader := r.Header.Get(model.HEADER_AUTH)
	if len(authHeader) > 6 && strings.ToUpper(authHeader[0:6]) == model.HEADER_BEARER {
		// Default session token
		token = authHeader[7:]

	} else if len(authHeader) > 5 && strings.ToLower(authHeader[0:5]) == model.HEADER_TOKEN {
		// OAuth token
		token = authHeader[6:]
	}

	// Attempt to parse the token from the cookie
	if len(token) == 0 {
		if cookie, err := r.Cookie(model.SESSION_COOKIE_TOKEN); err == nil {
			token = cookie.Value

			if r.Header.Get(model.HEADER_REQUESTED_WITH) != model.HEADER_REQUESTED_WITH_XML {
				return nil, model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token+" Appears to be a CSRF attempt", http.StatusUnauthorized)
			}
		}
	}

	// Attempt to parse token out of the query string
	if len(token) == 0 {
		token = r.URL.Query().Get("access_token")
		isTokenFromQueryString = true
	}

	if len(token) == 0 {
		return nil, model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token, http.StatusUnauthorized)
	}

	session, err := api.app.GetSession(token)

	if err != nil {
		return nil, model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token, http.StatusUnauthorized)
	} else if !session.IsOAuth && isTokenFromQueryString {
		return nil, model.NewAppError("ServeHTTP", "api.context.token_provided.app_error", nil, "token="+token, http.StatusUnauthorized)
	}

	return session, nil
}

func (api *BuiltInPluginAPI) I18n(id string, r *http.Request) string {
	if r != nil {
		f, _ := utils.GetTranslationsAndLocale(nil, r)
		return f(id)
	}
	f, _ := utils.GetTranslationsBySystemLocale()
	return f(id)
}
