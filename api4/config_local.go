// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitConfigLocal() {
	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiLocal(getConfig)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiLocal(localUpdateConfig)).Methods("PUT")
}

func localUpdateConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("config")
		return
	}

	auditRec := c.MakeAuditRecord("localUpdateConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)

	cfg.SetDefaults()

	appCfg := c.App.Config()

	// Do not allow plugin uploads to be toggled through the API
	cfg.PluginSettings.EnableUploads = appCfg.PluginSettings.EnableUploads

	// Do not allow certificates to be changed through the API
	cfg.PluginSettings.SignaturePublicKeyFiles = appCfg.PluginSettings.SignaturePublicKeyFiles

	c.App.HandleMessageExportConfig(cfg, appCfg)

	err := cfg.IsValid()
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.SaveConfig(cfg, true)
	if err != nil {
		c.Err = err
		return
	}

	cfg = c.App.GetSanitizedConfig()

	auditRec.Success()
	c.LogAudit("updateConfig")

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}
