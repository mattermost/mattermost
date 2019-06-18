// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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
	"runtime/debug"
	"strconv"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	ERROR_TERMS_OF_SERVICE_NO_ROWS_FOUND = "store.sql_terms_of_service_store.get.no_rows.app_error"
)

func (s *Server) Config() *model.Config {
	return s.configStore.Get()
}

func (a *App) Config() *model.Config {
	return a.Srv.Config()
}

func (s *Server) EnvironmentConfig() map[string]interface{} {
	return s.configStore.GetEnvironmentOverrides()
}

func (a *App) EnvironmentConfig() map[string]interface{} {
	return a.Srv.EnvironmentConfig()
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
	a.Srv.UpdateConfig(f)
}

func (s *Server) ReloadConfig() error {
	debug.FreeOSMemory()
	if err := s.configStore.Load(); err != nil {
		return err
	}
	return nil
}

func (a *App) ReloadConfig() error {
	return a.Srv.ReloadConfig()
}

func (a *App) ClientConfig() map[string]string {
	return a.Srv.clientConfig
}

func (a *App) ClientConfigHash() string {
	return a.Srv.clientConfigHash
}

func (a *App) LimitedClientConfig() map[string]string {
	return a.Srv.limitedClientConfig
}

// Registers a function with a given to be called when the config is reloaded and may have changed. The function
// will be called with two arguments: the old config and the new config. AddConfigListener returns a unique ID
// for the listener that can later be used to remove it.
func (s *Server) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return s.configStore.AddListener(listener)
}

func (a *App) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return a.Srv.AddConfigListener(listener)
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func (s *Server) RemoveConfigListener(id string) {
	s.configStore.RemoveListener(id)
}

func (a *App) RemoveConfigListener(id string) {
	a.Srv.RemoveConfigListener(id)
}

// ensurePostActionCookieSecret ensures that the key for encrypting PostActionCookie exists
// and future calls to PostAcrionCookieSecret will always return a valid key, same on all
// servers in the cluster
func (a *App) ensurePostActionCookieSecret() error {
	if a.Srv.postActionCookieSecret != nil {
		return nil
	}

	var secret *model.SystemPostActionCookieSecret

	value, err := a.Srv.Store.System().GetByName(model.SYSTEM_POST_ACTION_COOKIE_SECRET)
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
		if err = a.Srv.Store.System().Save(system); err == nil {
			// If we were able to save the key, use it, otherwise ignore the error.
			secret = newSecret
		}
	}

	// If we weren't able to save a new key above, another server must have beat us to it. Get the
	// key from the database, and if that fails, error out.
	if secret == nil {
		value, err := a.Srv.Store.System().GetByName(model.SYSTEM_POST_ACTION_COOKIE_SECRET)
		if err != nil {
			return err
		}

		if err := json.Unmarshal([]byte(value.Value), &secret); err != nil {
			return err
		}
	}

	a.Srv.postActionCookieSecret = secret.Secret
	return nil
}

// EnsureAsymmetricSigningKey ensures that an asymmetric signing key exists and future calls to
// AsymmetricSigningKey will always return a valid signing key.
func (a *App) ensureAsymmetricSigningKey() error {
	if a.Srv.asymmetricSigningKey != nil {
		return nil
	}

	var key *model.SystemAsymmetricSigningKey

	value, err := a.Srv.Store.System().GetByName(model.SYSTEM_ASYMMETRIC_SIGNING_KEY)
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
		if err = a.Srv.Store.System().Save(system); err == nil {
			// If we were able to save the key, use it, otherwise ignore the error.
			key = newKey
		}
	}

	// If we weren't able to save a new key above, another server must have beat us to it. Get the
	// key from the database, and if that fails, error out.
	if key == nil {
		value, err := a.Srv.Store.System().GetByName(model.SYSTEM_ASYMMETRIC_SIGNING_KEY)
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
	a.Srv.asymmetricSigningKey = &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{
			Curve: curve,
			X:     key.ECDSAKey.X,
			Y:     key.ECDSAKey.Y,
		},
		D: key.ECDSAKey.D,
	}
	a.regenerateClientConfig()
	return nil
}

func (a *App) ensureInstallationDate() error {
	_, err := a.getSystemInstallDate()
	if err == nil {
		return nil
	}

	result := <-a.Srv.Store.User().InferSystemInstallDate()
	var installationDate int64
	if result.Err == nil && result.Data.(int64) > 0 {
		installationDate = result.Data.(int64)
	} else {
		installationDate = utils.MillisFromTime(time.Now())
	}

	err = a.Srv.Store.System().SaveOrUpdate(&model.System{
		Name:  model.SYSTEM_INSTALLATION_DATE_KEY,
		Value: strconv.FormatInt(installationDate, 10),
	})
	if err != nil {
		return err
	}
	return nil
}

// AsymmetricSigningKey will return a private key that can be used for asymmetric signing.
func (s *Server) AsymmetricSigningKey() *ecdsa.PrivateKey {
	return s.asymmetricSigningKey
}

func (a *App) AsymmetricSigningKey() *ecdsa.PrivateKey {
	return a.Srv.AsymmetricSigningKey()
}

func (s *Server) PostActionCookieSecret() []byte {
	return s.postActionCookieSecret
}

func (a *App) PostActionCookieSecret() []byte {
	return a.Srv.PostActionCookieSecret()
}

func (a *App) regenerateClientConfig() {
	clientConfig := config.GenerateClientConfig(a.Config(), a.DiagnosticId(), a.License())
	limitedClientConfig := config.GenerateLimitedClientConfig(a.Config(), a.DiagnosticId(), a.License())

	if clientConfig["EnableCustomTermsOfService"] == "true" {
		termsOfService, err := a.GetLatestTermsOfService()
		if err != nil {
			mlog.Err(err)
		} else {
			clientConfig["CustomTermsOfServiceId"] = termsOfService.Id
			limitedClientConfig["CustomTermsOfServiceId"] = termsOfService.Id
		}
	}

	if key := a.AsymmetricSigningKey(); key != nil {
		der, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
		clientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
		limitedClientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
	}

	clientConfigJSON, _ := json.Marshal(clientConfig)
	a.Srv.clientConfig = clientConfig
	a.Srv.limitedClientConfig = limitedClientConfig
	a.Srv.clientConfigHash = fmt.Sprintf("%x", md5.Sum(clientConfigJSON))
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
func (a *App) ClientConfigWithComputed() map[string]string {
	respCfg := map[string]string{}
	for k, v := range a.ClientConfig() {
		respCfg[k] = v
	}

	// These properties are not configurable, but nevertheless represent configuration expected
	// by the client.
	respCfg["NoAccounts"] = strconv.FormatBool(a.IsFirstUserAccount())
	respCfg["MaxPostSize"] = strconv.Itoa(a.MaxPostSize())
	respCfg["InstallationDate"] = ""
	if installationDate, err := a.getSystemInstallDate(); err == nil {
		respCfg["InstallationDate"] = strconv.FormatInt(installationDate, 10)
	}

	return respCfg
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
	data, err := a.Srv.configStore.GetFile(name)
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
	oldCfg, err := a.Srv.configStore.Set(newCfg)
	if errors.Cause(err) == config.ErrReadOnlyConfiguration {
		return model.NewAppError("saveConfig", "ent.cluster.save_config.error", nil, err.Error(), http.StatusForbidden)
	} else if err != nil {
		return model.NewAppError("saveConfig", "app.save_config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if a.Metrics != nil {
		if *a.Config().MetricsSettings.Enable {
			a.Metrics.StartServer()
		} else {
			a.Metrics.StopServer()
		}
	}

	if a.Cluster != nil {
		err := a.Cluster.ConfigChanged(oldCfg, newCfg, sendConfigChangeClusterMessage)
		if err != nil {
			return err
		}
	}

	return nil
}
