// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (api *API) InitEncryption() {
	api.BaseRoutes.Encryption.Handle("/status", api.APISessionRequired(getEncryptionStatus)).Methods(http.MethodGet)
	api.BaseRoutes.Encryption.Handle("/publickey", api.APISessionRequired(getMyPublicKey)).Methods(http.MethodGet)
	api.BaseRoutes.Encryption.Handle("/publickey", api.APISessionRequired(registerPublicKey)).Methods(http.MethodPost)
	api.BaseRoutes.Encryption.Handle("/publickeys", api.APISessionRequired(getPublicKeysByUserIds)).Methods(http.MethodPost)
	api.BaseRoutes.Encryption.Handle("/channel/{channel_id:[A-Za-z0-9]+}/keys", api.APISessionRequired(getChannelMemberKeys)).Methods(http.MethodGet)

	// Admin endpoints
	api.BaseRoutes.Encryption.Handle("/admin/keys", api.APISessionRequired(adminGetAllKeys)).Methods(http.MethodGet)
	api.BaseRoutes.Encryption.Handle("/admin/keys", api.APISessionRequired(adminDeleteAllKeys)).Methods(http.MethodDelete)
	api.BaseRoutes.Encryption.Handle("/admin/keys/orphaned", api.APISessionRequired(adminDeleteOrphanedKeys)).Methods(http.MethodDelete)
	api.BaseRoutes.Encryption.Handle("/admin/keys/session/{session_id:[A-Za-z0-9]+}", api.APISessionRequired(adminDeleteSessionKey)).Methods(http.MethodDelete)
	api.BaseRoutes.Encryption.Handle("/admin/keys/{user_id:[A-Za-z0-9]+}", api.APISessionRequired(adminDeleteUserKeys)).Methods(http.MethodDelete)
}

// getEncryptionStatus returns the encryption status for the current session
func getEncryptionStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	config := c.App.Config()
	sessionId := c.AppContext.Session().Id

	// Check if encryption is enabled
	enabled := config.FeatureFlags.Encryption

	// Check if user can encrypt
	canEncrypt := enabled

	// Check if current session has a key registered
	hasKey := false
	_, err := c.App.Srv().Store().EncryptionSessionKey().GetBySession(sessionId)
	if err == nil {
		hasKey = true
	}

	status := &model.EncryptionStatus{
		Enabled:    enabled,
		CanEncrypt: canEncrypt,
		HasKey:     hasKey,
		SessionId:  sessionId,
	}

	if err := json.NewEncoder(w).Encode(status); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getMyPublicKey returns the current session's public encryption key
func getMyPublicKey(c *Context, w http.ResponseWriter, r *http.Request) {
	sessionId := c.AppContext.Session().Id
	userId := c.AppContext.Session().UserId

	key, err := c.App.Srv().Store().EncryptionSessionKey().GetBySession(sessionId)
	if err != nil {
		// Return empty key if not found (not an error)
		if _, ok := err.(*store.ErrNotFound); ok {
			response := &model.EncryptionPublicKey{
				UserId:    userId,
				SessionId: sessionId,
				PublicKey: "",
			}
			if err := json.NewEncoder(w).Encode(response); err != nil {
				c.Logger.Warn("Error while writing response", mlog.Err(err))
			}
			return
		}
		c.Err = model.NewAppError("getMyPublicKey", "api.encryption.get_key.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	response := &model.EncryptionPublicKey{
		UserId:    key.UserId,
		SessionId: key.SessionId,
		PublicKey: key.PublicKey,
		CreateAt:  key.CreateAt,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// registerPublicKey registers or updates the current session's public encryption key
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

	sessionId := c.AppContext.Session().Id
	userId := c.AppContext.Session().UserId

	// Check if encryption is enabled
	config := c.App.Config()
	if !config.FeatureFlags.Encryption {
		c.Err = model.NewAppError("registerPublicKey", "api.encryption.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Save the public key for this session
	sessionKey := &model.EncryptionSessionKey{
		SessionId: sessionId,
		UserId:    userId,
		PublicKey: req.PublicKey,
	}

	if err := c.App.Srv().Store().EncryptionSessionKey().Save(sessionKey); err != nil {
		c.Err = model.NewAppError("registerPublicKey", "api.encryption.save_key.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	response := &model.EncryptionPublicKey{
		UserId:    userId,
		SessionId: sessionId,
		PublicKey: req.PublicKey,
		CreateAt:  sessionKey.CreateAt,
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getPublicKeysByUserIds returns public keys for the specified user IDs
// Returns ALL keys for each user (one per active session)
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

	// Get all keys for the specified users
	sessionKeys, err := c.App.Srv().Store().EncryptionSessionKey().GetByUsers(req.UserIds)
	if err != nil {
		c.Err = model.NewAppError("getPublicKeysByUserIds", "api.encryption.get_keys.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// Convert to response format
	keys := make([]*model.EncryptionPublicKey, 0, len(sessionKeys))
	for _, sk := range sessionKeys {
		keys = append(keys, &model.EncryptionPublicKey{
			UserId:    sk.UserId,
			SessionId: sk.SessionId,
			PublicKey: sk.PublicKey,
			CreateAt:  sk.CreateAt,
		})
	}

	if err := json.NewEncoder(w).Encode(keys); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getChannelMemberKeys returns public keys for all members of a channel
// Returns ALL keys for each user (one per active session)
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

	// Collect all user IDs
	userIds := make([]string, 0, len(members))
	for _, member := range members {
		userIds = append(userIds, member.UserId)
	}

	// Get all keys for channel members
	sessionKeys, storeErr := c.App.Srv().Store().EncryptionSessionKey().GetByUsers(userIds)
	if storeErr != nil {
		c.Err = model.NewAppError("getChannelMemberKeys", "api.encryption.get_keys.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		return
	}

	// Convert to response format
	keys := make([]*model.EncryptionPublicKey, 0, len(sessionKeys))
	for _, sk := range sessionKeys {
		keys = append(keys, &model.EncryptionPublicKey{
			UserId:    sk.UserId,
			SessionId: sk.SessionId,
			PublicKey: sk.PublicKey,
			CreateAt:  sk.CreateAt,
		})
	}

	if err := json.NewEncoder(w).Encode(keys); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// adminGetAllKeys returns all encryption keys with user info (admin only)
func adminGetAllKeys(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check admin permission
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	// Get all keys
	keys, err := c.App.Srv().Store().EncryptionSessionKey().GetAll()
	if err != nil {
		c.Err = model.NewAppError("adminGetAllKeys", "api.encryption.admin_get_keys.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// Get stats
	stats, err := c.App.Srv().Store().EncryptionSessionKey().GetStats()
	if err != nil {
		c.Err = model.NewAppError("adminGetAllKeys", "api.encryption.admin_get_stats.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	response := &model.EncryptionKeysResponse{
		Keys:  keys,
		Stats: stats,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// adminDeleteAllKeys removes all encryption keys (admin only)
func adminDeleteAllKeys(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check admin permission
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if err := c.App.Srv().Store().EncryptionSessionKey().DeleteAll(); err != nil {
		c.Err = model.NewAppError("adminDeleteAllKeys", "api.encryption.admin_delete_keys.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	ReturnStatusOK(w)
}

// adminDeleteUserKeys removes all encryption keys for a specific user (admin only)
func adminDeleteUserKeys(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	// Check admin permission
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	userId := c.Params.UserId

	if err := c.App.Srv().Store().EncryptionSessionKey().DeleteByUser(userId); err != nil {
		c.Err = model.NewAppError("adminDeleteUserKeys", "api.encryption.admin_delete_user_keys.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	ReturnStatusOK(w)
}

// adminDeleteOrphanedKeys removes encryption keys for sessions that no longer exist or are expired (admin only)
func adminDeleteOrphanedKeys(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check admin permission
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	deleted, err := c.App.Srv().Store().EncryptionSessionKey().DeleteOrphaned()
	if err != nil {
		c.Err = model.NewAppError("adminDeleteOrphanedKeys", "api.encryption.admin_delete_orphaned_keys.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	c.Logger.Info("Deleted orphaned encryption keys", mlog.Int("count", int(deleted)))
	ReturnStatusOK(w)
}

// adminDeleteSessionKey removes a specific encryption session key (admin only)
func adminDeleteSessionKey(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireSessionId()
	if c.Err != nil {
		return
	}

	// Check admin permission
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	sessionId := c.Params.SessionId

	if err := c.App.Srv().Store().EncryptionSessionKey().DeleteBySession(sessionId); err != nil {
		c.Err = model.NewAppError("adminDeleteSessionKey", "api.encryption.admin_delete_session_key.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	c.Logger.Info("Deleted encryption session key", mlog.String("session_id", sessionId))
	ReturnStatusOK(w)
}
