// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/utils"
)

var writeFilter func(c *Context, structField reflect.StructField) bool
var readFilter func(c *Context, structField reflect.StructField) bool
var permissionMap map[string]*model.Permission

type filterType string

const (
	FilterTypeWrite filterType = "write"
	FilterTypeRead  filterType = "read"
)

func (api *API) InitConfig() {
	api.BaseRoutes.APIRoot.Handle("/config", api.APISessionRequired(getConfig)).Methods("GET")
	api.BaseRoutes.APIRoot.Handle("/config", api.APISessionRequired(updateConfig)).Methods("PUT")
	api.BaseRoutes.APIRoot.Handle("/config/patch", api.APISessionRequired(patchConfig)).Methods("PUT")
	api.BaseRoutes.APIRoot.Handle("/config/reload", api.APISessionRequired(configReload)).Methods("POST")
	api.BaseRoutes.APIRoot.Handle("/config/client", api.APIHandler(getClientConfig, model.ScopeUnrestrictedAPI...)).Methods("GET")
	api.BaseRoutes.APIRoot.Handle("/config/environment", api.APISessionRequired(getEnvironmentConfig)).Methods("GET")
}

func init() {
	writeFilter = makeFilterConfigByPermission(FilterTypeWrite)
	readFilter = makeFilterConfigByPermission(FilterTypeRead)
	permissionMap = map[string]*model.Permission{}
	for _, p := range model.AllPermissions {
		permissionMap[p.Id] = p
	}
}

func getConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), model.SysconsoleReadPermissions) {
		c.SetPermissionError(model.SysconsoleReadPermissions...)
		return
	}

	auditRec := c.MakeAuditRecord("getConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)

	cfg, err := config.Merge(&model.Config{}, c.App.GetSanitizedConfig(), &utils.MergeConfig{
		StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
			return readFilter(c, structField)
		},
	})
	if err != nil {
		c.Err = model.NewAppError("getConfig", "api.config.get_config.restricted_merge.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if c.App.Channels().License() != nil && *c.App.Channels().License().Features.Cloud {
		js, jsonErr := cfg.ToJSONFiltered(model.ConfigAccessTagType, model.ConfigAccessTagCloudRestrictable)
		if jsonErr != nil {
			c.Err = model.NewAppError("getConfig", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
			return
		}
		w.Write(js)
		return
	}
	if err := json.NewEncoder(w).Encode(cfg); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func configReload(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("configReload", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReloadConfig) {
		c.SetPermissionError(model.PermissionReloadConfig)
		return
	}

	if !c.AppContext.Session().IsUnrestricted() && *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("configReload", "api.restricted_system_admin", nil, "", http.StatusBadRequest)
		return
	}

	if err := c.App.ReloadConfig(); err != nil {
		c.Err = model.NewAppError("configReload", "api.config.reload_config.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func updateConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	var cfg *model.Config
	err := json.NewDecoder(r.Body).Decode(&cfg)
	if err != nil || cfg == nil {
		c.SetInvalidParamWithErr("config", err)
		return
	}

	auditRec := c.MakeAuditRecord("updateConfig", audit.Fail)

	// auditRec.AddEventParameter("config", cfg)  // TODO We can do this but do we want to?
	defer c.LogAuditRec(auditRec)

	cfg.SetDefaults()

	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), model.SysconsoleWritePermissions) {
		c.SetPermissionError(model.SysconsoleWritePermissions...)
		return
	}

	appCfg := c.App.Config()
	if *appCfg.ServiceSettings.SiteURL != "" && *cfg.ServiceSettings.SiteURL == "" {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.clear_siteurl.app_error", nil, "", http.StatusBadRequest)
		return
	}

	cfg, err = config.Merge(appCfg, cfg, &utils.MergeConfig{
		StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
			return writeFilter(c, structField)
		},
	})
	if err != nil {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.restricted_merge.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// Do not allow plugin uploads to be toggled through the API
	*cfg.PluginSettings.EnableUploads = *appCfg.PluginSettings.EnableUploads

	// Do not allow certificates to be changed through the API
	// This shallow-copies the slice header. So be careful if there are concurrent
	// modifications to the slice.
	cfg.PluginSettings.SignaturePublicKeyFiles = appCfg.PluginSettings.SignaturePublicKeyFiles

	// Do not allow marketplace URL to be toggled through the API if EnableUploads are disabled.
	if cfg.PluginSettings.EnableUploads != nil && !*appCfg.PluginSettings.EnableUploads {
		*cfg.PluginSettings.MarketplaceURL = *appCfg.PluginSettings.MarketplaceURL
	}

	if cfg.PluginSettings.PluginStates[model.PluginIdFocalboard].Enable && cfg.FeatureFlags.BoardsProduct {
		c.Err = model.NewAppError("EnablePlugin", "app.plugin.product_mode.app_error", map[string]any{"Name": model.PluginIdFocalboard}, "", http.StatusInternalServerError)
		return
	}

	if appErr := c.App.CheckFreemiumLimitsForConfigSave(appCfg, cfg); appErr != nil {
		c.Err = appErr
		return
	}

	// There are some settings that cannot be changed in a cloud env
	if c.App.Channels().License() != nil && *c.App.Channels().License().Features.Cloud {
		// Both of them cannot be nil since cfg.SetDefaults is called earlier for cfg,
		// and appCfg is the existing earlier config and if it's nil, server sets a default value.
		if *appCfg.ComplianceSettings.Directory != *cfg.ComplianceSettings.Directory {
			c.Err = model.NewAppError("updateConfig", "api.config.update_config.not_allowed_security.app_error", map[string]any{"Name": "ComplianceSettings.Directory"}, "", http.StatusForbidden)
			return
		}
	}

	c.App.HandleMessageExportConfig(cfg, appCfg)

	if appErr := cfg.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	oldCfg, newCfg, appErr := c.App.SaveConfig(cfg, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	diffs, err := config.Diff(oldCfg, newCfg)
	if err != nil {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.diff.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.AddEventPriorState(&diffs)

	newCfg.Sanitize()

	cfg, err = config.Merge(&model.Config{}, newCfg, &utils.MergeConfig{
		StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
			return readFilter(c, structField)
		},
	})
	if err != nil {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.restricted_merge.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	//auditRec.AddEventResultState(cfg) // TODO we can do this too but do we want to? the config object is huge
	auditRec.AddEventObjectType("config")
	auditRec.Success()
	c.LogAudit("updateConfig")

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if c.App.Channels().License() != nil && *c.App.Channels().License().Features.Cloud {
		js, err := cfg.ToJSONFiltered(model.ConfigAccessTagType, model.ConfigAccessTagCloudRestrictable)
		if err != nil {
			c.Err = model.NewAppError("updateConfig", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
		w.Write(js)
		return
	}

	if err := json.NewEncoder(w).Encode(cfg); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getClientConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")

	if format == "" {
		c.Err = model.NewAppError("getClientConfig", "api.config.client.old_format.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if format != "old" {
		c.SetInvalidParam("format")
		return
	}

	var config map[string]string
	if c.AppContext.Session().UserId == "" {
		config = c.App.Srv().Platform().LimitedClientConfigWithComputed()
	} else {
		config = c.App.Srv().Platform().ClientConfigWithComputed()
	}

	w.Write([]byte(model.MapToJSON(config)))
}

func getEnvironmentConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	// Only return the environment variables for the subsections which the client is
	// allowed to see
	envConfig := c.App.GetEnvironmentConfig(func(structField reflect.StructField) bool {
		return readFilter(c, structField)
	})

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(model.StringInterfaceToJSON(envConfig)))
}

func patchConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	var cfg *model.Config
	err := json.NewDecoder(r.Body).Decode(&cfg)
	if err != nil || cfg == nil {
		c.SetInvalidParamWithErr("config", err)
		return
	}

	auditRec := c.MakeAuditRecord("patchConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), model.SysconsoleWritePermissions) {
		c.SetPermissionError(model.SysconsoleWritePermissions...)
		return
	}

	appCfg := c.App.Config()
	if *appCfg.ServiceSettings.SiteURL != "" && cfg.ServiceSettings.SiteURL != nil && *cfg.ServiceSettings.SiteURL == "" {
		c.Err = model.NewAppError("patchConfig", "api.config.update_config.clear_siteurl.app_error", nil, "", http.StatusBadRequest)
		return
	}

	filterFn := func(structField reflect.StructField, base, patch reflect.Value) bool {
		return writeFilter(c, structField)
	}

	// Do not allow plugin uploads to be toggled through the API
	if cfg.PluginSettings.EnableUploads != nil && *cfg.PluginSettings.EnableUploads != *appCfg.PluginSettings.EnableUploads {
		c.Err = model.NewAppError("patchConfig", "api.config.update_config.not_allowed_security.app_error", map[string]any{"Name": "PluginSettings.EnableUploads"}, "", http.StatusForbidden)
		return
	}

	// Do not allow marketplace URL to be toggled if plugin uploads are disabled.
	if cfg.PluginSettings.MarketplaceURL != nil && cfg.PluginSettings.EnableUploads != nil {
		// Breaking it down to 2 conditions to make it simple.
		if *cfg.PluginSettings.MarketplaceURL != *appCfg.PluginSettings.MarketplaceURL && !*cfg.PluginSettings.EnableUploads {
			c.Err = model.NewAppError("patchConfig", "api.config.update_config.not_allowed_security.app_error", map[string]any{"Name": "PluginSettings.MarketplaceURL"}, "", http.StatusForbidden)
			return
		}
	}

	if appErr := c.App.CheckFreemiumLimitsForConfigSave(appCfg, cfg); appErr != nil {
		c.Err = appErr
		return
	}

	// There are some settings that cannot be changed in a cloud env
	if c.App.Channels().License() != nil && *c.App.Channels().License().Features.Cloud {
		if cfg.ComplianceSettings.Directory != nil && *appCfg.ComplianceSettings.Directory != *cfg.ComplianceSettings.Directory {
			c.Err = model.NewAppError("patchConfig", "api.config.update_config.not_allowed_security.app_error", map[string]any{"Name": "ComplianceSettings.Directory"}, "", http.StatusForbidden)
			return
		}
	}

	if cfg.MessageExportSettings.EnableExport != nil {
		c.App.HandleMessageExportConfig(cfg, appCfg)
	}

	updatedCfg, err := config.Merge(appCfg, cfg, &utils.MergeConfig{
		StructFieldFilter: filterFn,
	})
	if err != nil {
		c.Err = model.NewAppError("patchConfig", "api.config.update_config.restricted_merge.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	appErr := updatedCfg.IsValid()
	if appErr != nil {
		c.Err = appErr
		return
	}

	oldCfg, newCfg, appErr := c.App.SaveConfig(updatedCfg, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	diffs, err := config.Diff(oldCfg, newCfg)
	if err != nil {
		c.Err = model.NewAppError("patchConfig", "api.config.patch_config.diff.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.AddEventPriorState(&diffs)

	newCfg.Sanitize()

	auditRec.Success()

	cfg, err = config.Merge(&model.Config{}, newCfg, &utils.MergeConfig{
		StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
			return readFilter(c, structField)
		},
	})
	if err != nil {
		c.Err = model.NewAppError("patchConfig", "api.config.patch_config.restricted_merge.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if c.App.Channels().License() != nil && *c.App.Channels().License().Features.Cloud {
		js, err := cfg.ToJSONFiltered(model.ConfigAccessTagType, model.ConfigAccessTagCloudRestrictable)
		if err != nil {
			c.Err = model.NewAppError("patchConfig", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
		w.Write(js)
		return
	}

	if err := json.NewEncoder(w).Encode(cfg); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func makeFilterConfigByPermission(accessType filterType) func(c *Context, structField reflect.StructField) bool {
	return func(c *Context, structField reflect.StructField) bool {
		if structField.Type.Kind() == reflect.Struct {
			return true
		}

		tagPermissions := strings.Split(structField.Tag.Get("access"), ",")

		// If there are no access tag values and the role has manage_system, no need to continue
		// checking permissions.
		if len(tagPermissions) == 0 {
			if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
				return true
			}
		}

		// one iteration for write_restrictable value, it could be anywhere in the order of values
		for _, val := range tagPermissions {
			tagValue := strings.TrimSpace(val)
			if tagValue == "" {
				continue
			}
			// ConfigAccessTagWriteRestrictable trumps all other permissions
			if tagValue == model.ConfigAccessTagWriteRestrictable || tagValue == model.ConfigAccessTagCloudRestrictable {
				if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin && accessType == FilterTypeWrite {
					return false
				}
				continue
			}
		}

		// another iteration for permissions checks of other tag values
		for _, val := range tagPermissions {
			tagValue := strings.TrimSpace(val)
			if tagValue == "" {
				continue
			}
			if tagValue == model.ConfigAccessTagWriteRestrictable {
				continue
			}
			if tagValue == model.ConfigAccessTagCloudRestrictable {
				continue
			}
			if tagValue == model.ConfigAccessTagAnySysConsoleRead && accessType == FilterTypeRead &&
				c.App.SessionHasPermissionToAny(*c.AppContext.Session(), model.SysconsoleReadPermissions) {
				return true
			}

			permissionID := fmt.Sprintf("sysconsole_%s_%s", accessType, tagValue)
			if permission, ok := permissionMap[permissionID]; ok {
				if c.App.SessionHasPermissionTo(*c.AppContext.Session(), permission) {
					return true
				}
			} else {
				mlog.Warn("Unrecognized config permissions tag value.", mlog.String("tag_value", permissionID))
			}
		}

		// with manage_system, default to allow, otherwise default not-allow
		return c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	}
}
