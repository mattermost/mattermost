// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitEncryption() {
	api.BaseRoutes.Encryption.Handle("/status", api.APISessionRequired(getEncryptionStatus)).Methods(http.MethodGet)
	api.BaseRoutes.Encryption.Handle("/publickey", api.APISessionRequired(getMyPublicKey)).Methods(http.MethodGet)
	api.BaseRoutes.Encryption.Handle("/publickey", api.APISessionRequired(registerPublicKey)).Methods(http.MethodPost)
	api.BaseRoutes.Encryption.Handle("/publickeys", api.APISessionRequired(getPublicKeysByUserIds)).Methods(http.MethodPost)
	api.BaseRoutes.Encryption.Handle("/channel/{channel_id:[A-Za-z0-9]+}/keys", api.APISessionRequired(getChannelMemberKeys)).Methods(http.MethodGet)
}

// getEncryptionStatus returns the encryption status for the current user
func getEncryptionStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	config := c.App.Config()
	userId := c.AppContext.Session().UserId

	// Check if encryption is enabled
	enabled := config.MattermostExtendedSettings.EnableEncryption != nil && *config.MattermostExtendedSettings.EnableEncryption

	// Check if user can encrypt (admin mode check)
	canEncrypt := enabled
	if enabled && config.MattermostExtendedSettings.AdminModeOnly != nil && *config.MattermostExtendedSettings.AdminModeOnly {
		// Check if user is admin
		user, err := c.App.GetUser(userId)
		if err != nil {
			c.Err = err
			return
		}
		canEncrypt = user.IsSystemAdmin()
	}

	// Check if user has a public key registered
	hasKey := false
	preferences, err := c.App.GetPreferencesForUser(c.AppContext, userId)
	if err == nil {
		for _, pref := range preferences {
			if pref.Category == model.PreferenceCategoryEncryption && pref.Name == model.PreferenceNamePublicKey {
				hasKey = pref.Value != ""
				break
			}
		}
	}

	status := &model.EncryptionStatus{
		Enabled:    enabled,
		CanEncrypt: canEncrypt,
		HasKey:     hasKey,
	}

	if err := json.NewEncoder(w).Encode(status); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getMyPublicKey returns the current user's public encryption key
func getMyPublicKey(c *Context, w http.ResponseWriter, r *http.Request) {
	userId := c.AppContext.Session().UserId

	preferences, err := c.App.GetPreferencesForUser(c.AppContext, userId)
	if err != nil {
		c.Err = err
		return
	}

	var publicKey string
	for _, pref := range preferences {
		if pref.Category == model.PreferenceCategoryEncryption && pref.Name == model.PreferenceNamePublicKey {
			publicKey = pref.Value
			break
		}
	}

	response := &model.EncryptionPublicKey{
		UserId:    userId,
		PublicKey: publicKey,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// registerPublicKey registers or updates the current user's public encryption key
func registerPublicKey(c *Context, w http.ResponseWriter, r *http.Request) {
	var req model.EncryptionPublicKeyRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&req); jsonErr != nil {
		c.SetInvalidParamWithErr("public_key", jsonErr)
		return
	}

	if appErr := req.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	userId := c.AppContext.Session().UserId

	// Check if encryption is enabled
	config := c.App.Config()
	if config.MattermostExtendedSettings.EnableEncryption == nil || !*config.MattermostExtendedSettings.EnableEncryption {
		c.Err = model.NewAppError("registerPublicKey", "api.encryption.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check admin mode
	if config.MattermostExtendedSettings.AdminModeOnly != nil && *config.MattermostExtendedSettings.AdminModeOnly {
		user, err := c.App.GetUser(userId)
		if err != nil {
			c.Err = err
			return
		}
		if !user.IsSystemAdmin() {
			c.Err = model.NewAppError("registerPublicKey", "api.encryption.admin_only", nil, "", http.StatusForbidden)
			return
		}
	}

	// Save the public key as a preference
	preference := model.Preference{
		UserId:   userId,
		Category: model.PreferenceCategoryEncryption,
		Name:     model.PreferenceNamePublicKey,
		Value:    req.PublicKey,
	}

	if err := c.App.UpdatePreferences(c.AppContext, userId, model.Preferences{preference}); err != nil {
		c.Err = err
		return
	}

	response := &model.EncryptionPublicKey{
		UserId:    userId,
		PublicKey: req.PublicKey,
		CreateAt:  model.GetMillis(),
		UpdateAt:  model.GetMillis(),
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getPublicKeysByUserIds returns public keys for the specified user IDs
func getPublicKeysByUserIds(c *Context, w http.ResponseWriter, r *http.Request) {
	var req model.EncryptionPublicKeysRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&req); jsonErr != nil {
		c.SetInvalidParamWithErr("user_ids", jsonErr)
		return
	}

	if appErr := req.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	// Get preferences for all users
	keys := make([]*model.EncryptionPublicKey, 0, len(req.UserIds))

	for _, userId := range req.UserIds {
		preferences, err := c.App.GetPreferencesForUser(c.AppContext, userId)
		if err != nil {
			// Skip users that don't exist or have errors
			continue
		}

		for _, pref := range preferences {
			if pref.Category == model.PreferenceCategoryEncryption && pref.Name == model.PreferenceNamePublicKey && pref.Value != "" {
				keys = append(keys, &model.EncryptionPublicKey{
					UserId:    userId,
					PublicKey: pref.Value,
				})
				break
			}
		}
	}

	if err := json.NewEncoder(w).Encode(keys); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getChannelMemberKeys returns public keys for all members of a channel
func getChannelMemberKeys(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channelId := c.Params.ChannelId

	// Check if user has access to the channel
	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	// Get channel members
	members, err := c.App.GetChannelMembersPage(c.AppContext, channelId, 0, 10000)
	if err != nil {
		c.Err = err
		return
	}

	// Get public keys for all members
	keys := make([]*model.EncryptionPublicKey, 0, len(members))

	for _, member := range members {
		preferences, prefErr := c.App.GetPreferencesForUser(c.AppContext, member.UserId)
		if prefErr != nil {
			continue
		}

		for _, pref := range preferences {
			if pref.Category == model.PreferenceCategoryEncryption && pref.Name == model.PreferenceNamePublicKey && pref.Value != "" {
				keys = append(keys, &model.EncryptionPublicKey{
					UserId:    member.UserId,
					PublicKey: pref.Value,
				})
				break
			}
		}
	}

	if err := json.NewEncoder(w).Encode(keys); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
