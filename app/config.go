// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/md5"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	ErrorTermsOfServiceNoRowsFound = "app.terms_of_service.get.no_rows.app_error"
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
	if s.configStore.IsReadOnly() {
		return
	}
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
	if err := s.configStore.Load(); err != nil {
		return err
	}
	return nil
}

func (a *App) ReloadConfig() error {
	return a.Srv().ReloadConfig()
}

func (a *App) ClientConfig() map[string]string {
	return a.Srv().clientConfig.Load().(map[string]string)
}

func (a *App) ClientConfigHash() string {
	return a.Srv().ClientConfigHash()
}

func (a *App) LimitedClientConfig() map[string]string {
	return a.Srv().limitedClientConfig.Load().(map[string]string)
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

// ensurePostActionCookieSecret ensures that the key for encrypting PostActionCookie exists
// and future calls to PostActionCookieSecret will always return a valid key, same on all
// servers in the cluster
func (s *Server) ensurePostActionCookieSecret() error {
	if s.postActionCookieSecret != nil {
		return nil
	}

	var secret *model.SystemPostActionCookieSecret

	value, err := s.Store.System().GetByName(model.SYSTEM_POST_ACTION_COOKIE_SECRET)
	if err == nil {
		if err := json.Unmarshal([]byte(value.Value), &secret); err != nil {
			return err
		}
	}

	// If we don't already have a key, try to generate one.
	if secret == nil {
		newSecret := &model.SystemPostActionCookieSecret{
			Secret: make([]byte, 32),
		}
		_, err := rand.Reader.Read(newSecret.Secret)
		if err != nil {
			return err
		}

		system := &model.System{
			Name: model.SYSTEM_POST_ACTION_COOKIE_SECRET,
		}
		v, err := json.Marshal(newSecret)
		if err != nil {
			return err
		}
		system.Value = string(v)
		// If we were able to save the key, use it, otherwise log the error.
		if err = s.Store.System().Save(system); err != nil {
			mlog.Warn("Failed to save PostActionCookieSecret", mlog.Err(err))
		} else {
			secret = newSecret
		}
	}

	// If we weren't able to save a new key above, another server must have beat us to it. Get the
	// key from the database, and if that fails, error out.
	if secret == nil {
		value, err := s.Store.System().GetByName(model.SYSTEM_POST_ACTION_COOKIE_SECRET)
		if err != nil {
			return err
		}

		if err := json.Unmarshal([]byte(value.Value), &secret); err != nil {
			return err
		}
	}

	s.postActionCookieSecret = secret.Secret
	return nil
}

// ensureAsymmetricSigningKey ensures that an asymmetric signing key exists and future calls to
// AsymmetricSigningKey will always return a valid signing key.
func (s *Server) ensureAsymmetricSigningKey() error {
	if s.AsymmetricSigningKey() != nil {
		return nil
	}

	var key *model.SystemAsymmetricSigningKey

	value, err := s.Store.System().GetByName(model.SYSTEM_ASYMMETRIC_SIGNING_KEY)
	if err == nil {
		if err := json.Unmarshal([]byte(value.Value), &key); err != nil {
			return err
		}
	}

	// If we don't already have a key, try to generate one.
	if key == nil {
		newECDSAKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return err
		}
		newKey := &model.SystemAsymmetricSigningKey{
			ECDSAKey: &model.SystemECDSAKey{
				Curve: "P-256",
				X:     newECDSAKey.X,
				Y:     newECDSAKey.Y,
				D:     newECDSAKey.D,
			},
		}
		system := &model.System{
			Name: model.SYSTEM_ASYMMETRIC_SIGNING_KEY,
		}
		v, err := json.Marshal(newKey)
		if err != nil {
			return err
		}
		system.Value = string(v)
		// If we were able to save the key, use it, otherwise log the error.
		if err = s.Store.System().Save(system); err != nil {
			mlog.Warn("Failed to save AsymmetricSigningKey", mlog.Err(err))
		} else {
			key = newKey
		}
	}

	// If we weren't able to save a new key above, another server must have beat us to it. Get the
	// key from the database, and if that fails, error out.
	if key == nil {
		value, err := s.Store.System().GetByName(model.SYSTEM_ASYMMETRIC_SIGNING_KEY)
		if err != nil {
			return err
		}

		if err := json.Unmarshal([]byte(value.Value), &key); err != nil {
			return err
		}
	}

	var curve elliptic.Curve
	switch key.ECDSAKey.Curve {
	case "P-256":
		curve = elliptic.P256()
	default:
		return fmt.Errorf("unknown curve: " + key.ECDSAKey.Curve)
	}
	s.asymmetricSigningKey.Store(&ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{
			Curve: curve,
			X:     key.ECDSAKey.X,
			Y:     key.ECDSAKey.Y,
		},
		D: key.ECDSAKey.D,
	})
	s.regenerateClientConfig()
	return nil
}

func (s *Server) ensureInstallationDate() error {
	_, appErr := s.getSystemInstallDate()
	if appErr == nil {
		return nil
	}

	installDate, nErr := s.Store.User().InferSystemInstallDate()
	var installationDate int64
	if nErr == nil && installDate > 0 {
		installationDate = installDate
	} else {
		installationDate = utils.MillisFromTime(time.Now())
	}

	if err := s.Store.System().SaveOrUpdate(&model.System{
		Name:  model.SYSTEM_INSTALLATION_DATE_KEY,
		Value: strconv.FormatInt(installationDate, 10),
	}); err != nil {
		return err
	}
	return nil
}

func (s *Server) ensureFirstServerRunTimestamp() error {
	_, appErr := s.getFirstServerRunTimestamp()
	if appErr == nil {
		return nil
	}

	if err := s.Store.System().SaveOrUpdate(&model.System{
		Name:  model.SYSTEM_FIRST_SERVER_RUN_TIMESTAMP_KEY,
		Value: strconv.FormatInt(utils.MillisFromTime(time.Now()), 10),
	}); err != nil {
		return err
	}
	return nil
}

// AsymmetricSigningKey will return a private key that can be used for asymmetric signing.
func (s *Server) AsymmetricSigningKey() *ecdsa.PrivateKey {
	if key := s.asymmetricSigningKey.Load(); key != nil {
		return key.(*ecdsa.PrivateKey)
	}
	return nil
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

func (s *Server) regenerateClientConfig() {
	clientConfig := config.GenerateClientConfig(s.Config(), s.TelemetryId(), s.License())
	limitedClientConfig := config.GenerateLimitedClientConfig(s.Config(), s.TelemetryId(), s.License())

	if clientConfig["EnableCustomTermsOfService"] == "true" {
		termsOfService, err := s.Store.TermsOfService().GetLatest(true)
		if err != nil {
			mlog.Err(err)
		} else {
			clientConfig["CustomTermsOfServiceId"] = termsOfService.Id
			limitedClientConfig["CustomTermsOfServiceId"] = termsOfService.Id
		}
	}

	if key := s.AsymmetricSigningKey(); key != nil {
		der, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
		clientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
		limitedClientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
	}

	clientConfigJSON, _ := json.Marshal(clientConfig)
	s.clientConfig.Store(clientConfig)
	s.limitedClientConfig.Store(limitedClientConfig)
	s.clientConfigHash.Store(fmt.Sprintf("%x", md5.Sum(clientConfigJSON)))
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
	for k, v := range s.clientConfig.Load().(map[string]string) {
		respCfg[k] = v
	}

	// These properties are not configurable, but nevertheless represent configuration expected
	// by the client.
	respCfg["NoAccounts"] = strconv.FormatBool(s.IsFirstUserAccount())
	respCfg["MaxPostSize"] = strconv.Itoa(s.MaxPostSize())
	respCfg["UpgradedFromTE"] = strconv.FormatBool(s.isUpgradedFromTE())
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
func (s *Server) SaveConfig(newCfg *model.Config, sendConfigChangeClusterMessage bool) *model.AppError {
	oldCfg, err := s.configStore.Set(newCfg)
	if errors.Cause(err) == config.ErrReadOnlyConfiguration {
		return model.NewAppError("saveConfig", "ent.cluster.save_config.error", nil, err.Error(), http.StatusForbidden)
	} else if err != nil {
		return model.NewAppError("saveConfig", "app.save_config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if s.Metrics != nil {
		if *s.Config().MetricsSettings.Enable {
			s.Metrics.StartServer()
		} else {
			s.Metrics.StopServer()
		}
	}

	if s.Cluster != nil {
		newCfg = s.configStore.RemoveEnvironmentOverrides(newCfg)
		oldCfg = s.configStore.RemoveEnvironmentOverrides(oldCfg)
		err := s.Cluster.ConfigChanged(oldCfg, newCfg, sendConfigChangeClusterMessage)
		if err != nil {
			return err
		}
	}

	return nil
}

// SaveConfig replaces the active configuration, optionally notifying cluster peers.
func (a *App) SaveConfig(newCfg *model.Config, sendConfigChangeClusterMessage bool) *model.AppError {
	return a.Srv().SaveConfig(newCfg, sendConfigChangeClusterMessage)
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
