// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitChannelAutoArchive() {
	// GET  /api/v4/channels/auto-archive/config   — retrieve current settings
	api.BaseRoutes.Channels.Handle("/auto-archive/config", api.APISessionRequired(getChannelAutoArchiveConfig)).Methods(http.MethodGet)

	// PUT  /api/v4/channels/auto-archive/config   — update settings (system admin only)
	api.BaseRoutes.Channels.Handle("/auto-archive/config", api.APISessionRequired(updateChannelAutoArchiveConfig)).Methods(http.MethodPut)

	// POST /api/v4/channels/auto-archive/run      — trigger an immediate archive sweep (system admin only)
	api.BaseRoutes.Channels.Handle("/auto-archive/run", api.APISessionRequired(triggerChannelAutoArchiveRun)).Methods(http.MethodPost)
}

// getChannelAutoArchiveConfig returns the current ChannelSettings auto-archive
// configuration. Requires system admin permissions.
func getChannelAutoArchiveConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadSiteChannels) {
		c.SetPermissionError(model.PermissionSysconsoleReadSiteChannels)
		return
	}

	cfg := c.App.Config()
	settings := cfg.ChannelSettings

	if err := json.NewEncoder(w).Encode(settings); err != nil {
		c.Logger.Warn("Failed to encode ChannelSettings response", mlog.Err(err))
	}
}

// updateChannelAutoArchiveConfig replaces the ChannelSettings auto-archive
// configuration. Requires system admin permissions.
//
// Request body: model.ChannelSettings (JSON)
// Response: updated model.ChannelSettings (JSON)
func updateChannelAutoArchiveConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteSiteChannels) {
		c.SetPermissionError(model.PermissionSysconsoleWriteSiteChannels)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventChannelAutoArchiveConfigUpdate, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	var newSettings model.ChannelSettings
	if err := json.NewDecoder(r.Body).Decode(&newSettings); err != nil {
		c.SetInvalidParamWithErr("channel_settings", err)
		return
	}

	if appErr := newSettings.isValid(); appErr != nil {
		c.Err = appErr
		return
	}

	cfg := c.App.Config().Clone()
	cfg.ChannelSettings = newSettings

	if _, _, appErr := c.App.SaveConfig(cfg, true); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("auto-archive config updated")

	if err := json.NewEncoder(w).Encode(newSettings); err != nil {
		c.Logger.Warn("Failed to encode updated ChannelSettings response", mlog.Err(err))
	}
}

// triggerChannelAutoArchiveRun starts an immediate archive sweep outside the
// normal scheduled job cadence. Useful for testing or one-off admin operations.
// Requires system admin permissions.
//
// Response 200: { "channels_archived": <int> }
func triggerChannelAutoArchiveRun(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventChannelAutoArchive, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	count, appErr := c.App.RunChannelAutoArchive(c.AppContext)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(map[string]any{"channels_archived": count})
	auditRec.Success()

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]int{"channels_archived": count}); err != nil {
		c.Logger.Warn("Failed to encode triggerChannelAutoArchiveRun response", mlog.Err(err))
	}
}
