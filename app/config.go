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

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	ERROR_SERVICE_TERMS_NO_ROWS_FOUND = "store.sql_service_terms_store.get.no_rows.app_error"
)

func (a *App) Config() *model.Config {
	if cfg := a.config.Load(); cfg != nil {
		return cfg.(*model.Config)
	}
	return &model.Config{}
}

func (a *App) EnvironmentConfig() map[string]interface{} {
	if a.envConfig != nil {
		return a.envConfig
	}
	return map[string]interface{}{}
}

func (a *App) UpdateConfig(f func(*model.Config)) {
	old := a.Config()
	updated := old.Clone()
	f(updated)
	a.config.Store(updated)

	a.InvokeConfigListeners(old, updated)
}

func (a *App) PersistConfig() {
	utils.SaveConfig(a.ConfigFileName(), a.Config())
}

func (a *App) LoadConfig(configFile string) *model.AppError {
	old := a.Config()

	cfg, configPath, envConfig, err := utils.LoadConfig(configFile)
	if err != nil {
		return err
	}
	*cfg.ServiceSettings.SiteURL = strings.TrimRight(*cfg.ServiceSettings.SiteURL, "/")
	a.config.Store(cfg)

	a.configFile = configPath
	a.envConfig = envConfig
	a.siteURL = *cfg.ServiceSettings.SiteURL

	a.InvokeConfigListeners(old, cfg)
	return nil
}

func (a *App) ReloadConfig() *model.AppError {
	debug.FreeOSMemory()
	if err := a.LoadConfig(a.configFile); err != nil {
		return err
	}

	// start/restart email batching job if necessary
	a.InitEmailBatching()
	return nil
}

func (a *App) ConfigFileName() string {
	return a.configFile
}

func (a *App) ClientConfig() map[string]string {
	return a.clientConfig
}

func (a *App) ClientConfigHash() string {
	return a.clientConfigHash
}

func (a *App) LimitedClientConfig() map[string]string {
	return a.limitedClientConfig
}

func (a *App) EnableConfigWatch() {
	if a.configWatcher == nil && !a.disableConfigWatch {
		configWatcher, err := utils.NewConfigWatcher(a.ConfigFileName(), func() {
			a.ReloadConfig()
		})
		if err != nil {
			mlog.Error(fmt.Sprint(err))
		}
		a.configWatcher = configWatcher
	}
}

func (a *App) DisableConfigWatch() {
	if a.configWatcher != nil {
		a.configWatcher.Close()
		a.configWatcher = nil
	}
}

// Registers a function with a given to be called when the config is reloaded and may have changed. The function
// will be called with two arguments: the old config and the new config. AddConfigListener returns a unique ID
// for the listener that can later be used to remove it.
func (a *App) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	id := model.NewId()
	a.configListeners[id] = listener
	return id
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func (a *App) RemoveConfigListener(id string) {
	delete(a.configListeners, id)
}

func (a *App) InvokeConfigListeners(old, current *model.Config) {
	for _, listener := range a.configListeners {
		listener(old, current)
	}
}

// EnsureAsymmetricSigningKey ensures that an asymmetric signing key exists and future calls to
// AsymmetricSigningKey will always return a valid signing key.
func (a *App) ensureAsymmetricSigningKey() error {
	if a.asymmetricSigningKey != nil {
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
	a.asymmetricSigningKey = &ecdsa.PrivateKey{
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
func (a *App) AsymmetricSigningKey() *ecdsa.PrivateKey {
	return a.asymmetricSigningKey
}

func (a *App) regenerateClientConfig() {
	a.clientConfig = utils.GenerateClientConfig(a.Config(), a.DiagnosticId(), a.License())

	if a.clientConfig["EnableCustomServiceTerms"] == "true" {
		serviceTerms, err := a.GetLatestServiceTerms()
		if err != nil {
			mlog.Err(err)
		} else {
			a.clientConfig["CustomServiceTermsId"] = serviceTerms.Id
		}
	}

	a.limitedClientConfig = utils.GenerateLimitedClientConfig(a.Config(), a.DiagnosticId(), a.License())

	if key := a.AsymmetricSigningKey(); key != nil {
		der, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
		a.clientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
		a.limitedClientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
	}

	clientConfigJSON, _ := json.Marshal(a.clientConfig)
	a.clientConfigHash = fmt.Sprintf("%x", md5.Sum(clientConfigJSON))
}

func (a *App) Desanitize(cfg *model.Config) {
	actual := a.Config()

	if cfg.LdapSettings.BindPassword != nil && *cfg.LdapSettings.BindPassword == model.FAKE_SETTING {
		*cfg.LdapSettings.BindPassword = *actual.LdapSettings.BindPassword
	}

	if *cfg.FileSettings.PublicLinkSalt == model.FAKE_SETTING {
		*cfg.FileSettings.PublicLinkSalt = *actual.FileSettings.PublicLinkSalt
	}
	if cfg.FileSettings.AmazonS3SecretAccessKey == model.FAKE_SETTING {
		cfg.FileSettings.AmazonS3SecretAccessKey = actual.FileSettings.AmazonS3SecretAccessKey
	}

	if cfg.EmailSettings.InviteSalt == model.FAKE_SETTING {
		cfg.EmailSettings.InviteSalt = actual.EmailSettings.InviteSalt
	}
	if cfg.EmailSettings.SMTPPassword == model.FAKE_SETTING {
		cfg.EmailSettings.SMTPPassword = actual.EmailSettings.SMTPPassword
	}

	if cfg.GitLabSettings.Secret == model.FAKE_SETTING {
		cfg.GitLabSettings.Secret = actual.GitLabSettings.Secret
	}

	if *cfg.SqlSettings.DataSource == model.FAKE_SETTING {
		*cfg.SqlSettings.DataSource = *actual.SqlSettings.DataSource
	}
	if cfg.SqlSettings.AtRestEncryptKey == model.FAKE_SETTING {
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
	return a.siteURL
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
