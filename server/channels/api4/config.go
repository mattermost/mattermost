// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/config"
)

var (
	writeFilter   func(c *Context, structField reflect.StructField) bool
	readFilter    func(c *Context, structField reflect.StructField) bool
	permissionMap map[string]*model.Permission
)

type filterType string

const (
	FilterTypeWrite filterType = "write"
	FilterTypeRead  filterType = "read"
)

func (api *API) InitConfig() {
	api.BaseRoutes.APIRoot.Handle("/config", api.APISessionRequired(getConfig)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/config", api.APISessionRequired(updateConfig)).Methods(http.MethodPut)
	api.BaseRoutes.APIRoot.Handle("/config/patch", api.APISessionRequired(patchConfig)).Methods(http.MethodPut)
	api.BaseRoutes.APIRoot.Handle("/config/reload", api.APISessionRequired(configReload)).Methods(http.MethodPost)
	api.BaseRoutes.APIRoot.Handle("/config/client", api.APIHandler(getClientConfig)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/config/environment", api.APISessionRequired(getEnvironmentConfig)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/config/history", api.APISessionRequired(getConfigHistory)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/config/history/{config_id:[A-Za-z0-9]+}", api.APISessionRequired(getHistoricalConfig)).Methods(http.MethodGet)
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

	auditRec := c.MakeAuditRecord(model.AuditEventGetConfig, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	cfg, err := config.Merge(&model.Config{}, c.App.GetSanitizedConfig(), &utils.MergeConfig{
		StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
			return readFilter(c, structField)
		},
	})
	if err != nil {
		c.Err = model.NewAppError("getConfig", "api.config.get_config.restricted_merge.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	filterMasked, _ := strconv.ParseBool(r.URL.Query().Get("remove_masked"))
	filterDefaults, _ := strconv.ParseBool(r.URL.Query().Get("remove_defaults"))
	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	filterOpts := model.ConfigFilterOptions{
		GetConfigOptions: model.GetConfigOptions{
			RemoveDefaults: filterDefaults,
			RemoveMasked:   filterMasked,
		},
	}
	if c.App.Channels().License().IsCloud() {
		filterOpts.TagFilters = append(filterOpts.TagFilters, model.FilterTag{
			TagType: model.ConfigAccessTagType,
			TagName: model.ConfigAccessTagCloudRestrictable,
		})
	}
	m, err := model.FilterConfig(cfg, filterOpts)
	if err != nil {
		c.Err = model.NewAppError("getConfig", "api.filter_config_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(m); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func configReload(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord(model.AuditEventConfigReload, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToAndNotRestrictedAdmin(*c.AppContext.Session(), model.PermissionReloadConfig) {
		c.SetPermissionError(model.PermissionReloadConfig)
		return
	}

	if err := c.App.ReloadConfig(); err != nil {
		c.Err = model.NewAppError("configReload", "api.config.reload_config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateConfig, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	cfg.SetDefaults()

	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), model.SysconsoleWritePermissions) {
		c.SetPermissionError(model.SysconsoleWritePermissions...)
		return
	}

	appCfg := c.App.Config()

	// Preserve the existing configs of plugins that getConfig doesn't show, such as those that
	// aren't installed, or all of them when plugins are disabled, unless they are present.
	shownCfg := appCfg.Clone()
	c.App.SanitizedConfig(shownCfg)
	for id, storedSettings := range appCfg.PluginSettings.Plugins {
		_, shown := shownCfg.PluginSettings.Plugins[id]
		if _, present := cfg.PluginSettings.Plugins[id]; !present && !shown {
			cfg.PluginSettings.Plugins[id] = storedSettings
		}
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

	// Checked after the merge, which keeps the current Site URL for a user who may not change it,
	// such as one who can't read it either and so sent none.
	if *appCfg.ServiceSettings.SiteURL != "" && *cfg.ServiceSettings.SiteURL == "" {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.clear_siteurl.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Do not allow plugin uploads to be toggled through the API
	*cfg.PluginSettings.EnableUploads = *appCfg.PluginSettings.EnableUploads

	// Do not allow certificates to be changed through the API
	// This shallow-copies the slice header. So be careful if there are concurrent
	// modifications to the slice.
	cfg.PluginSettings.SignaturePublicKeyFiles = appCfg.PluginSettings.SignaturePublicKeyFiles

	// Do not allow import directory to be changed through the API
	*cfg.ImportSettings.Directory = *appCfg.ImportSettings.Directory

	// Do not allow marketplace URL to be toggled through the API if EnableUploads are disabled.
	if cfg.PluginSettings.EnableUploads != nil && !*appCfg.PluginSettings.EnableUploads {
		*cfg.PluginSettings.MarketplaceURL = *appCfg.PluginSettings.MarketplaceURL
	}

	// There are some settings that cannot be changed in a cloud env
	if c.App.Channels().License().IsCloud() {
		// Both of them cannot be nil since cfg.SetDefaults is called earlier for cfg,
		// and appCfg is the existing earlier config and if it's nil, server sets a default value.
		if *appCfg.ComplianceSettings.Directory != *cfg.ComplianceSettings.Directory {
			c.Err = model.NewAppError("updateConfig", "api.config.update_config.not_allowed_security.app_error", map[string]any{"Name": "ComplianceSettings.Directory"}, "", http.StatusForbidden)
			return
		}
	}

	// if ES autocomplete was enabled, we need to make sure that index has been checked.
	// we need to stop enabling ES autocomplete otherwise.
	if !*appCfg.ElasticsearchSettings.EnableAutocomplete && *cfg.ElasticsearchSettings.EnableAutocomplete {
		if !c.App.SearchEngine().ElasticsearchEngine.IsAutocompletionEnabled() {
			c.Err = model.NewAppError("updateConfig", "api.config.update.elasticsearch.autocomplete_cannot_be_enabled_error", nil, "", http.StatusBadRequest)
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

	// If the config for default server locale has changed, reinitialize the server's translations.
	if oldCfg.LocalizationSettings.DefaultServerLocale != newCfg.LocalizationSettings.DefaultServerLocale {
		s := newCfg.LocalizationSettings
		if err = i18n.InitTranslations(*s.DefaultServerLocale, *s.DefaultClientLocale); err != nil {
			c.Err = model.NewAppError("updateConfig", "api.config.update_config.translations.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
	}

	diffs, err := config.Diff(oldCfg, newCfg)
	if err != nil {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.diff.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.AddEventPriorState(&diffs)

	c.App.SanitizedConfig(newCfg)

	cfg, err = config.Merge(&model.Config{}, newCfg, &utils.MergeConfig{
		StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
			return readFilter(c, structField)
		},
	})
	if err != nil {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.restricted_merge.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// auditRec.AddEventResultState(cfg) // TODO we can do this too but do we want to? the config object is huge
	auditRec.AddEventObjectType("config")
	auditRec.Success()
	c.LogAudit("updateConfig")

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if c.App.Channels().License().IsCloud() {
		js, err := cfg.ToJSONFiltered(model.ConfigAccessTagType, model.ConfigAccessTagCloudRestrictable)
		if err != nil {
			c.Err = model.NewAppError("updateConfig", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
		if _, err := w.Write(js); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	if err := json.NewEncoder(w).Encode(cfg); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getClientConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	var config map[string]string
	if c.AppContext.Session().UserId == "" {
		config = c.App.Srv().Platform().LimitedClientConfigWithComputed()
	} else {
		config = c.App.Srv().Platform().ClientConfigWithComputed()
	}

	if err := json.NewEncoder(w).Encode(config); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getEnvironmentConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	// Only return the environment variables for the subsections which the client is
	// allowed to see
	envConfig := c.App.GetEnvironmentConfig(func(structField reflect.StructField) bool {
		return readFilter(c, structField)
	})

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if _, err := w.Write([]byte(model.StringInterfaceToJSON(envConfig))); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	var cfg *model.Config
	err := json.NewDecoder(r.Body).Decode(&cfg)
	if err != nil || cfg == nil {
		c.SetInvalidParamWithErr("config", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPatchConfig, model.AuditStatusFail)
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

	// Do not allow certificates to be changed through the API. Mirror the full
	// update endpoint by silently preserving the existing value rather than
	// rejecting the request.
	cfg.PluginSettings.SignaturePublicKeyFiles = appCfg.PluginSettings.SignaturePublicKeyFiles

	// Do not allow import directory to be changed through the API
	if cfg.ImportSettings.Directory != nil && *cfg.ImportSettings.Directory != *appCfg.ImportSettings.Directory {
		c.Err = model.NewAppError("patchConfig", "api.config.update_config.not_allowed_security.app_error", map[string]any{"Name": "ImportSettings.Directory"}, "", http.StatusForbidden)
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

	// There are some settings that cannot be changed in a cloud env
	if c.App.Channels().License().IsCloud() {
		if cfg.ComplianceSettings.Directory != nil && *appCfg.ComplianceSettings.Directory != *cfg.ComplianceSettings.Directory {
			c.Err = model.NewAppError("patchConfig", "api.config.update_config.not_allowed_security.app_error", map[string]any{"Name": "ComplianceSettings.Directory"}, "", http.StatusForbidden)
			return
		}
	}

	if cfg.MessageExportSettings.EnableExport != nil {
		c.App.HandleMessageExportConfig(cfg, appCfg)
	}

	// Preserve the existing configs for those not present in the patch.
	if cfg.PluginSettings.Plugins != nil {
		for id, storedSettings := range appCfg.PluginSettings.Plugins {
			if _, present := cfg.PluginSettings.Plugins[id]; !present {
				cfg.PluginSettings.Plugins[id] = storedSettings
			}
		}
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

	c.App.SanitizedConfig(newCfg)

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
	if c.App.Channels().License().IsCloud() {
		js, err := cfg.ToJSONFiltered(model.ConfigAccessTagType, model.ConfigAccessTagCloudRestrictable)
		if err != nil {
			c.Err = model.NewAppError("patchConfig", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
		if _, err := w.Write(js); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	if err := json.NewEncoder(w).Encode(cfg); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getConfigHistory lists the saved configurations, newest first, each with the settings
// that changed from the configuration saved before it. Only settings the session may
// read are compared, and sensitive values are masked even in local mode.
func getConfigHistory(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), model.SysconsoleReadPermissions) {
		c.SetPermissionError(model.SysconsoleReadPermissions...)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetConfigHistory, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	// The oldest entry on the page is compared with the one saved before it, so fetch one more.
	history, appErr := c.App.GetConfigHistory(c.Params.Page*c.Params.PerPage, c.Params.PerPage+1)
	if appErr != nil {
		c.Err = appErr
		return
	}

	readableConfig := newReadableConfigFilter(c)
	sanitize := c.App.ConfigSanitizer()
	entries := make([]*model.ConfigHistoryEntry, len(history))
	var newer *model.Config
	for i, saved := range history {
		entries[i] = saved.ConfigHistoryEntry
		if saved.LoadErr != nil {
			// Listed without its changes, or those of the configuration saved after it.
			c.Logger.Warn("Failed to load a saved configuration", mlog.String("config_id", saved.Id), mlog.Err(saved.LoadErr))
			newer = nil
			continue
		}

		cfg, appErr := readableConfig(saved.Config)
		if appErr != nil {
			c.Err = appErr
			return
		}

		if newer != nil {
			diffs, err := config.SanitizedDiff(cfg, newer, sanitize)
			if err != nil {
				c.Err = model.NewAppError("getConfigHistory", "api.config.get_config_history.diff.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
				return
			}
			entries[i-1].Changes = diffs.ToConfigChanges()
		}
		newer = cfg
	}

	if len(entries) > c.Params.PerPage {
		entries = entries[:c.Params.PerPage]
	}

	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if err := json.NewEncoder(w).Encode(entries); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getHistoricalConfig returns a saved configuration filtered the way getConfig filters the
// active one. Like localGetConfig, local mode returns it unfiltered and unsanitized.
func getHistoricalConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), model.SysconsoleReadPermissions) {
		c.SetPermissionError(model.SysconsoleReadPermissions...)
		return
	}

	configID := mux.Vars(r)["config_id"]
	if !model.IsValidId(configID) {
		c.SetInvalidURLParam("config_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetHistoricalConfig, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "config_id", configID)

	cfg, appErr := c.App.GetHistoricalConfig(configID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !c.AppContext.Session().IsUnrestricted() {
		c.App.SanitizedConfig(cfg)
	}
	cfg, appErr = newReadableConfigFilter(c)(cfg)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if err := json.NewEncoder(w).Encode(cfg); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// newReadableConfigFilter returns a function that copies a config with only the settings the
// session may read, using the same filters as getConfig. It does not sanitize. readFilter's
// answer depends only on a field's type and tags, so it is cached across calls: a config has
// over a thousand settings, and each answer can take several permission checks.
func newReadableConfigFilter(c *Context) func(*model.Config) (*model.Config, *model.AppError) {
	type fieldKey struct {
		typ reflect.Type
		tag reflect.StructTag
	}
	readable := map[fieldKey]bool{}
	mergeConfig := &utils.MergeConfig{
		StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value) bool {
			key := fieldKey{structField.Type, structField.Tag}
			allowed, ok := readable[key]
			if !ok {
				allowed = readFilter(c, structField)
				readable[key] = allowed
			}
			return allowed
		},
	}
	filterCloudRestricted := !c.AppContext.Session().IsUnrestricted() && c.App.Channels().License().IsCloud()

	return func(cfg *model.Config) (*model.Config, *model.AppError) {
		filtered, err := config.Merge(&model.Config{}, cfg, mergeConfig)
		if err != nil {
			return nil, model.NewAppError("readableConfig", "api.config.get_config.restricted_merge.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if !filterCloudRestricted {
			return filtered, nil
		}

		js, err := filtered.ToJSONFiltered(model.ConfigAccessTagType, model.ConfigAccessTagCloudRestrictable)
		if err != nil {
			return nil, model.NewAppError("readableConfig", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		var cloudFiltered *model.Config
		if err := json.Unmarshal(js, &cloudFiltered); err != nil {
			return nil, model.NewAppError("readableConfig", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		return cloudFiltered, nil
	}
}

func makeFilterConfigByPermission(accessType filterType) func(c *Context, structField reflect.StructField) bool {
	return func(c *Context, structField reflect.StructField) bool {
		if structField.Type.Kind() == reflect.Struct {
			return true
		}

		tagPermissions := strings.Split(structField.Tag.Get("access"), ",")

		if c.AppContext.Session().IsUnrestricted() {
			return true
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
				c.Logger.Warn("Unrecognized config permissions tag value.", mlog.String("tag_value", permissionID))
			}
		}

		// with manage_system, default to allow, otherwise default not-allow
		return c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	}
}
