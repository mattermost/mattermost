// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/ecdsa"
	"net/http"
	"net/url"
	"runtime/debug"
	"strconv"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	ERROR_TERMS_OF_SERVICE_NO_ROWS_FOUND = "store.sql_terms_of_service_store.get.no_rows.app_error"
)

func (s *Server) Config() *model.Config {
	return s.configStore.Get()
}

func (a *App) Config() *model.Config {
	return a.Srv().Config()
}

func (s *Server) EnvironmentConfig() map[string]interface{} {
	return s.configStore.GetEnvironmentOverrides()
}

func (a *App) EnvironmentConfig() map[string]interface{} {
	return a.Srv().EnvironmentConfig()
}

func (s *Server) UpdateConfig(f func(*model.Config)) {
	old := s.Config()
	updated := old.Clone()
	f(updated)
	if _, err := s.configStore.Set(updated); err != nil {
		mlog.Error("Failed to update config", mlog.Err(err))
	}
}

func (a *App) UpdateConfig(f func(*model.Config)) {
	a.Srv().UpdateConfig(f)
}

func (s *Server) ReloadConfig() error {
	debug.FreeOSMemory()
	if err := s.configStore.Load(); err != nil {
		return err
	}
	return nil
}

func (a *App) ReloadConfig() error {
	return a.Srv().ReloadConfig()
}

func (a *App) ClientConfig() map[string]string {
	return a.Srv().clientConfig
}

func (a *App) ClientConfigHash() string {
	return a.Srv().clientConfigHash
}

func (a *App) LimitedClientConfig() map[string]string {
	return a.Srv().limitedClientConfig
}

// Registers a function with a given listener to be called when the config is reloaded and may have changed. The function
// will be called with two arguments: the old config and the new config. AddConfigListener returns a unique ID
// for the listener that can later be used to remove it.
func (s *Server) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return s.configStore.AddListener(listener)
}

func (a *App) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return a.Srv().AddConfigListener(listener)
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func (s *Server) RemoveConfigListener(id string) {
	s.configStore.RemoveListener(id)
}

func (a *App) RemoveConfigListener(id string) {
	a.Srv().RemoveConfigListener(id)
}

// AsymmetricSigningKey will return a private key that can be used for asymmetric signing.
func (s *Server) AsymmetricSigningKey() *ecdsa.PrivateKey {
	return s.asymmetricSigningKey
}

func (a *App) AsymmetricSigningKey() *ecdsa.PrivateKey {
	return a.Srv().AsymmetricSigningKey()
}

func (s *Server) PostActionCookieSecret() []byte {
	return s.postActionCookieSecret
}

func (a *App) PostActionCookieSecret() []byte {
	return a.Srv().PostActionCookieSecret()
}

func (a *App) GetCookieDomain() string {
	if *a.Config().ServiceSettings.AllowCookiesForSubdomains {
		if siteURL, err := url.Parse(*a.Config().ServiceSettings.SiteURL); err == nil {
			return siteURL.Hostname()
		}
	}
	return ""
}

func (a *App) GetSiteURL() string {
	return *a.Config().ServiceSettings.SiteURL
}

// ClientConfigWithComputed gets the configuration in a format suitable for sending to the client.
func (s *Server) ClientConfigWithComputed() map[string]string {
	respCfg := map[string]string{}
	for k, v := range s.clientConfig {
		respCfg[k] = v
	}

	// These properties are not configurable, but nevertheless represent configuration expected
	// by the client.
	respCfg["NoAccounts"] = strconv.FormatBool(s.IsFirstUserAccount())
	respCfg["MaxPostSize"] = strconv.Itoa(s.MaxPostSize())
	respCfg["InstallationDate"] = ""
	if installationDate, err := s.getSystemInstallDate(); err == nil {
		respCfg["InstallationDate"] = strconv.FormatInt(installationDate, 10)
	}

	return respCfg
}

// ClientConfigWithComputed gets the configuration in a format suitable for sending to the client.
func (a *App) ClientConfigWithComputed() map[string]string {
	return a.Srv().ClientConfigWithComputed()
}

// LimitedClientConfigWithComputed gets the configuration in a format suitable for sending to the client.
func (a *App) LimitedClientConfigWithComputed() map[string]string {
	respCfg := map[string]string{}
	for k, v := range a.LimitedClientConfig() {
		respCfg[k] = v
	}

	// These properties are not configurable, but nevertheless represent configuration expected
	// by the client.
	respCfg["NoAccounts"] = strconv.FormatBool(a.IsFirstUserAccount())

	return respCfg
}

// GetConfigFile proxies access to the given configuration file to the underlying config store.
func (a *App) GetConfigFile(name string) ([]byte, error) {
	data, err := a.Srv().configStore.GetFile(name)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get config file %s", name)
	}

	return data, nil
}

// GetSanitizedConfig gets the configuration for a system admin without any secrets.
func (a *App) GetSanitizedConfig() *model.Config {
	cfg := a.Config().Clone()
	cfg.Sanitize()

	return cfg
}

// GetEnvironmentConfig returns a map of configuration keys whose values have been overridden by an environment variable.
func (a *App) GetEnvironmentConfig() map[string]interface{} {
	return a.EnvironmentConfig()
}

// SaveConfig replaces the active configuration, optionally notifying cluster peers.
func (a *App) SaveConfig(newCfg *model.Config, sendConfigChangeClusterMessage bool) *model.AppError {
	oldCfg, err := a.Srv().configStore.Set(newCfg)
	if errors.Cause(err) == config.ErrReadOnlyConfiguration {
		return model.NewAppError("saveConfig", "ent.cluster.save_config.error", nil, err.Error(), http.StatusForbidden)
	} else if err != nil {
		return model.NewAppError("saveConfig", "app.save_config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if a.Metrics() != nil {
		if *a.Config().MetricsSettings.Enable {
			a.Metrics().StartServer()
		} else {
			a.Metrics().StopServer()
		}
	}

	if a.Cluster() != nil {
		newCfg = a.Srv().configStore.RemoveEnvironmentOverrides(newCfg)
		oldCfg = a.Srv().configStore.RemoveEnvironmentOverrides(oldCfg)
		err := a.Cluster().ConfigChanged(oldCfg, newCfg, sendConfigChangeClusterMessage)
		if err != nil {
			return err
		}
	}

	return nil
}

func (a *App) HandleMessageExportConfig(cfg *model.Config, appCfg *model.Config) {
	// If the Message Export feature has been toggled in the System Console, rewrite the ExportFromTimestamp field to an
	// appropriate value. The rewriting occurs here to ensure it doesn't affect values written to the config file
	// directly and not through the System Console UI.
	if *cfg.MessageExportSettings.EnableExport != *appCfg.MessageExportSettings.EnableExport {
		if *cfg.MessageExportSettings.EnableExport && *cfg.MessageExportSettings.ExportFromTimestamp == int64(0) {
			// When the feature is toggled on, use the current timestamp as the start time for future exports.
			cfg.MessageExportSettings.ExportFromTimestamp = model.NewInt64(model.GetMillis())
		} else if !*cfg.MessageExportSettings.EnableExport {
			// When the feature is disabled, reset the timestamp so that the timestamp will be set if
			// the feature is re-enabled from the System Console in future.
			cfg.MessageExportSettings.ExportFromTimestamp = model.NewInt64(0)
		}
	}
}
