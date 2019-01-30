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
	"net/url"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	ERROR_TERMS_OF_SERVICE_NO_ROWS_FOUND = "store.sql_terms_of_service_store.get.no_rows.app_error"
)

func (s *Server) Config() *model.Config {
	if cfg := s.config.Load(); cfg != nil {
		return cfg.(*model.Config)
	}
	return &model.Config{}
}

func (a *App) Config() *model.Config {
	return a.Srv.Config()
}

func (s *Server) EnvironmentConfig() map[string]interface{} {
	if s.envConfig != nil {
		return s.envConfig
	}
	return map[string]interface{}{}
}

func (a *App) EnvironmentConfig() map[string]interface{} {
	return a.Srv.EnvironmentConfig()
}

func (s *Server) UpdateConfig(f func(*model.Config)) {
	old := s.Config()
	updated := old.Clone()
	f(updated)
	s.config.Store(updated)

	s.InvokeConfigListeners(old, updated)
}

func (a *App) UpdateConfig(f func(*model.Config)) {
	a.Srv.UpdateConfig(f)
}

func (a *App) PersistConfig() {
	config.SaveConfig(a.ConfigFileName(), a.Config())
}

func (s *Server) LoadConfig(configFile string) *model.AppError {
	old := s.Config()

	cfg, configPath, envConfig, err := config.LoadConfig(configFile)
	if err != nil {
		return err
	}
	*cfg.ServiceSettings.SiteURL = strings.TrimRight(*cfg.ServiceSettings.SiteURL, "/")
	s.config.Store(cfg)

	s.configFile = configPath
	s.envConfig = envConfig

	s.InvokeConfigListeners(old, cfg)
	return nil
}

func (a *App) LoadConfig(configFile string) *model.AppError {
	return a.Srv.LoadConfig(configFile)
}

func (s *Server) ReloadConfig() *model.AppError {
	debug.FreeOSMemory()
	if err := s.LoadConfig(s.configFile); err != nil {
		return err
	}
	return nil
}

func (a *App) ReloadConfig() *model.AppError {
	return a.Srv.ReloadConfig()
}

func (a *App) ConfigFileName() string {
	return a.Srv.configFile
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

func (s *Server) EnableConfigWatch() {
	if s.configWatcher == nil && !s.disableConfigWatch {
		configWatcher, err := config.NewConfigWatcher(s.configFile, func() {
			s.ReloadConfig()
		})
		if err != nil {
			mlog.Error(fmt.Sprint(err))
		}
		s.configWatcher = configWatcher
	}
}

func (a *App) EnableConfigWatch() {
	a.Srv.EnableConfigWatch()
}

func (s *Server) DisableConfigWatch() {
	if s.configWatcher != nil {
		s.configWatcher.Close()
		s.configWatcher = nil
	}
}

func (a *App) DisableConfigWatch() {
	a.Srv.DisableConfigWatch()
}

// Registers a function with a given to be called when the config is reloaded and may have changed. The function
// will be called with two arguments: the old config and the new config. AddConfigListener returns a unique ID
// for the listener that can later be used to remove it.
func (s *Server) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	id := model.NewId()
	s.configListeners[id] = listener
	return id
}

func (a *App) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return a.Srv.AddConfigListener(listener)
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func (s *Server) RemoveConfigListener(id string) {
	delete(s.configListeners, id)
}

func (a *App) RemoveConfigListener(id string) {
	a.Srv.RemoveConfigListener(id)
}

func (s *Server) InvokeConfigListeners(old, current *model.Config) {
	for _, listener := range s.configListeners {
		listener(old, current)
	}
}

// EnsureAsymmetricSigningKey ensures that an asymmetric signing key exists and future calls to
// AsymmetricSigningKey will always return a valid signing key.
func (a *App) ensureAsymmetricSigningKey() error {
	if a.Srv.asymmetricSigningKey != nil {
		return nil
	}

	var key *model.SystemAsymmetricSigningKey

	result := <-a.Srv.Store.System().GetByName(model.SYSTEM_ASYMMETRIC_SIGNING_KEY)
	if result.Err == nil {
		if err := json.Unmarshal([]byte(result.Data.(*model.System).Value), &key); err != nil {
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
		if result = <-a.Srv.Store.System().Save(system); result.Err == nil {
			// If we were able to save the key, use it, otherwise ignore the error.
			key = newKey
		}
	}

	// If we weren't able to save a new key above, another server must have beat us to it. Get the
	// key from the database, and if that fails, error out.
	if key == nil {
		result := <-a.Srv.Store.System().GetByName(model.SYSTEM_ASYMMETRIC_SIGNING_KEY)
		if result.Err != nil {
			return result.Err
		}

		if err := json.Unmarshal([]byte(result.Data.(*model.System).Value), &key); err != nil {
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

	result = <-a.Srv.Store.System().SaveOrUpdate(&model.System{
		Name:  model.SYSTEM_INSTALLATION_DATE_KEY,
		Value: strconv.FormatInt(installationDate, 10),
	})
	if result.Err != nil {
		return result.Err
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

func (a *App) regenerateClientConfig() {
	a.Srv.clientConfig = config.GenerateClientConfig(a.Config(), a.DiagnosticId(), a.License())
	a.Srv.limitedClientConfig = config.GenerateLimitedClientConfig(a.Config(), a.DiagnosticId(), a.License())

	if a.Srv.clientConfig["EnableCustomTermsOfService"] == "true" {
		termsOfService, err := a.GetLatestTermsOfService()
		if err != nil {
			mlog.Err(err)
		} else {
			a.Srv.clientConfig["CustomTermsOfServiceId"] = termsOfService.Id
			a.Srv.limitedClientConfig["CustomTermsOfServiceId"] = termsOfService.Id
		}
	}

	if key := a.AsymmetricSigningKey(); key != nil {
		der, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
		a.Srv.clientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
		a.Srv.limitedClientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
	}

	clientConfigJSON, _ := json.Marshal(a.Srv.clientConfig)
	a.Srv.clientConfigHash = fmt.Sprintf("%x", md5.Sum(clientConfigJSON))
}

func (a *App) Desanitize(cfg *model.Config) {
	actual := a.Config()

	if cfg.LdapSettings.BindPassword != nil && *cfg.LdapSettings.BindPassword == model.FAKE_SETTING {
		*cfg.LdapSettings.BindPassword = *actual.LdapSettings.BindPassword
	}

	if *cfg.FileSettings.PublicLinkSalt == model.FAKE_SETTING {
		*cfg.FileSettings.PublicLinkSalt = *actual.FileSettings.PublicLinkSalt
	}
	if *cfg.FileSettings.AmazonS3SecretAccessKey == model.FAKE_SETTING {
		cfg.FileSettings.AmazonS3SecretAccessKey = actual.FileSettings.AmazonS3SecretAccessKey
	}

	if *cfg.EmailSettings.InviteSalt == model.FAKE_SETTING {
		cfg.EmailSettings.InviteSalt = actual.EmailSettings.InviteSalt
	}
	if *cfg.EmailSettings.SMTPPassword == model.FAKE_SETTING {
		cfg.EmailSettings.SMTPPassword = actual.EmailSettings.SMTPPassword
	}

	if *cfg.GitLabSettings.Secret == model.FAKE_SETTING {
		*cfg.GitLabSettings.Secret = *actual.GitLabSettings.Secret
	}

	if *cfg.SqlSettings.DataSource == model.FAKE_SETTING {
		*cfg.SqlSettings.DataSource = *actual.SqlSettings.DataSource
	}
	if *cfg.SqlSettings.AtRestEncryptKey == model.FAKE_SETTING {
		cfg.SqlSettings.AtRestEncryptKey = actual.SqlSettings.AtRestEncryptKey
	}

	if *cfg.ElasticsearchSettings.Password == model.FAKE_SETTING {
		*cfg.ElasticsearchSettings.Password = *actual.ElasticsearchSettings.Password
	}

	for i := range cfg.SqlSettings.DataSourceReplicas {
		cfg.SqlSettings.DataSourceReplicas[i] = actual.SqlSettings.DataSourceReplicas[i]
	}

	for i := range cfg.SqlSettings.DataSourceSearchReplicas {
		cfg.SqlSettings.DataSourceSearchReplicas[i] = actual.SqlSettings.DataSourceSearchReplicas[i]
	}
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
