// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/md5"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

// ServiceConfig is used to initialize the PlatformService.
// The mandatory fields will be checked during the initialization of the service.
type ServiceConfig struct {
	// Mandatory fields
	ConfigStore *config.Store
	Store       store.Store
	// Optional fields
	Cluster einterfaces.ClusterInterface
}

// ensure the config wrapper implements `product.ConfigService`
var _ product.ConfigService = (*PlatformService)(nil)

func (ps *PlatformService) Config() *model.Config {
	return ps.configStore.Get()
}

// Registers a function with a given listener to be called when the config is reloaded and may have changed. The function
// will be called with two arguments: the old config and the new config. AddConfigListener returns a unique ID
// for the listener that can later be used to remove it.
func (ps *PlatformService) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return ps.configStore.AddListener(listener)
}

func (ps *PlatformService) RemoveConfigListener(id string) {
	ps.configStore.RemoveListener(id)
}

func (ps *PlatformService) UpdateConfig(f func(*model.Config)) {
	if ps.configStore.IsReadOnly() {
		return
	}
	old := ps.Config()
	updated := old.Clone()
	f(updated)
	if _, _, err := ps.configStore.Set(updated); err != nil {
		ps.logger.Error("Failed to update config", mlog.Err(err))
	}
}

// SaveConfig replaces the active configuration, optionally notifying cluster peers.
// It returns both the previous and current configs.
func (ps *PlatformService) SaveConfig(newCfg *model.Config, sendConfigChangeClusterMessage bool) (*model.Config, *model.Config, *model.AppError) {
	oldCfg, newCfg, err := ps.configStore.Set(newCfg)
	if errors.Is(err, config.ErrReadOnlyConfiguration) {
		return nil, nil, model.NewAppError("saveConfig", "ent.cluster.save_config.error", nil, "", http.StatusForbidden).Wrap(err)
	} else if err != nil {
		return nil, nil, model.NewAppError("saveConfig", "app.save_config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if ps.clusterIFace != nil {
		err := ps.clusterIFace.ConfigChanged(ps.configStore.RemoveEnvironmentOverrides(oldCfg),
			ps.configStore.RemoveEnvironmentOverrides(newCfg), sendConfigChangeClusterMessage)
		if err != nil {
			return nil, nil, err
		}
	}

	return oldCfg, newCfg, nil
}

func (ps *PlatformService) ReloadConfig() error {
	if err := ps.configStore.Load(); err != nil {
		return err
	}
	return nil
}

func (ps *PlatformService) GetEnvironmentOverridesWithFilter(filter func(reflect.StructField) bool) map[string]interface{} {
	return ps.configStore.GetEnvironmentOverridesWithFilter(filter)
}

func (ps *PlatformService) GetEnvironmentOverrides() map[string]interface{} {
	return ps.configStore.GetEnvironmentOverrides()
}

func (ps *PlatformService) DescribeConfig() string {
	return ps.configStore.String()
}

func (ps *PlatformService) CleanUpConfig() error {
	return ps.configStore.CleanUp()
}

// ConfigureLogger applies the specified configuration to a logger.
func (ps *PlatformService) ConfigureLogger(name string, logger *mlog.Logger, logSettings *model.LogSettings, getPath func(string) string) error {
	// Advanced logging is E20 only, however logging must be initialized before the license
	// file is loaded.  If no valid E20 license exists then advanced logging will be
	// shutdown once license is loaded/checked.
	var err error
	dsn := *logSettings.AdvancedLoggingConfig
	var logConfigSrc config.LogConfigSrc
	if dsn != "" {
		logConfigSrc, err = config.NewLogConfigSrc(dsn, ps.configStore)
		if err != nil {
			return fmt.Errorf("invalid config source for %s, %w", name, err)
		}
		ps.logger.Info("Loaded configuration for "+name, mlog.String("source", dsn))
	}

	cfg, err := config.MloggerConfigFromLoggerConfig(logSettings, logConfigSrc, getPath)
	if err != nil {
		return fmt.Errorf("invalid config source for %s, %w", name, err)
	}

	if err := logger.ConfigureTargets(cfg, nil); err != nil {
		return fmt.Errorf("invalid config for %s, %w", name, err)
	}
	return nil
}

func (ps *PlatformService) GetConfigStore() *config.Store {
	return ps.configStore
}

func (ps *PlatformService) GetConfigFile(name string) ([]byte, error) {
	return ps.configStore.GetFile(name)
}

func (ps *PlatformService) SetConfigFile(name string, data []byte) error {
	return ps.configStore.SetFile(name, data)
}

func (ps *PlatformService) RemoveConfigFile(name string) error {
	return ps.configStore.RemoveFile(name)
}

func (ps *PlatformService) HasConfigFile(name string) (bool, error) {
	return ps.configStore.HasFile(name)
}

func (ps *PlatformService) SetConfigReadOnlyFF(readOnly bool) {
	ps.configStore.SetReadOnlyFF(readOnly)
}

func (ps *PlatformService) ClientConfigHash() string {
	return ps.clientConfigHash.Load().(string)
}

func (ps *PlatformService) regenerateClientConfig() {
	clientConfig := config.GenerateClientConfig(ps.Config(), ps.telemetryId, ps.License())
	limitedClientConfig := config.GenerateLimitedClientConfig(ps.Config(), ps.telemetryId, ps.License())

	if clientConfig["EnableCustomTermsOfService"] == "true" {
		termsOfService, err := ps.Store.TermsOfService().GetLatest(true)
		if err != nil {
			mlog.Err(err)
		} else {
			clientConfig["CustomTermsOfServiceId"] = termsOfService.Id
			limitedClientConfig["CustomTermsOfServiceId"] = termsOfService.Id
		}
	}

	if key := ps.AsymmetricSigningKey(); key != nil {
		der, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
		clientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
		limitedClientConfig["AsymmetricSigningPublicKey"] = base64.StdEncoding.EncodeToString(der)
	}

	clientConfigJSON, _ := json.Marshal(clientConfig)
	ps.clientConfig.Store(clientConfig)
	ps.limitedClientConfig.Store(limitedClientConfig)
	ps.clientConfigHash.Store(fmt.Sprintf("%x", md5.Sum(clientConfigJSON)))
}

// AsymmetricSigningKey will return a private key that can be used for asymmetric signing.
func (ps *PlatformService) AsymmetricSigningKey() *ecdsa.PrivateKey {
	if key := ps.asymmetricSigningKey.Load(); key != nil {
		return key.(*ecdsa.PrivateKey)
	}
	return nil
}

// EnsureAsymmetricSigningKey ensures that an asymmetric signing key exists and future calls to
// AsymmetricSigningKey will always return a valid signing key.
func (ps *PlatformService) EnsureAsymmetricSigningKey() error {
	if ps.AsymmetricSigningKey() != nil {
		return nil
	}

	var key *model.SystemAsymmetricSigningKey

	value, err := ps.Store.System().GetByName(model.SystemAsymmetricSigningKeyKey)
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
			Name: model.SystemAsymmetricSigningKeyKey,
		}
		v, err := json.Marshal(newKey)
		if err != nil {
			return err
		}
		system.Value = string(v)
		// If we were able to save the key, use it, otherwise log the error.
		if err = ps.Store.System().Save(system); err != nil {
			mlog.Warn("Failed to save AsymmetricSigningKey", mlog.Err(err))
		} else {
			key = newKey
		}
	}

	// If we weren't able to save a new key above, another server must have beat us to it. Get the
	// key from the database, and if that fails, error out.
	if key == nil {
		value, err := ps.Store.System().GetByName(model.SystemAsymmetricSigningKeyKey)
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
	ps.asymmetricSigningKey.Store(&ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{
			Curve: curve,
			X:     key.ECDSAKey.X,
			Y:     key.ECDSAKey.Y,
		},
		D: key.ECDSAKey.D,
	})
	ps.regenerateClientConfig()
	return nil
}

// LimitedClientConfigWithComputed gets the configuration in a format suitable for sending to the client.
func (ps *PlatformService) LimitedClientConfigWithComputed() map[string]string {
	respCfg := map[string]string{}
	for k, v := range ps.LimitedClientConfig() {
		respCfg[k] = v
	}

	// These properties are not configurable, but nevertheless represent configuration expected
	// by the client.
	respCfg["NoAccounts"] = strconv.FormatBool(ps.IsFirstUserAccount())

	return respCfg
}

// ClientConfigWithComputed gets the configuration in a format suitable for sending to the client.
func (ps *PlatformService) ClientConfigWithComputed() map[string]string {
	respCfg := map[string]string{}
	for k, v := range ps.clientConfig.Load().(map[string]string) {
		respCfg[k] = v
	}

	// These properties are not configurable, but nevertheless represent configuration expected
	// by the client.
	respCfg["NoAccounts"] = strconv.FormatBool(ps.IsFirstUserAccount())
	respCfg["MaxPostSize"] = strconv.Itoa(ps.MaxPostSize())
	respCfg["UpgradedFromTE"] = strconv.FormatBool(ps.isUpgradedFromTE())
	respCfg["InstallationDate"] = ""
	if installationDate, err := ps.GetSystemInstallDate(); err == nil {
		respCfg["InstallationDate"] = strconv.FormatInt(installationDate, 10)
	}
	if ver, err := ps.Store.GetDBSchemaVersion(); err != nil {
		mlog.Error("Could not get the schema version", mlog.Err(err))
	} else {
		respCfg["SchemaVersion"] = strconv.Itoa(ver)
	}

	return respCfg
}

func (ps *PlatformService) LimitedClientConfig() map[string]string {
	return ps.limitedClientConfig.Load().(map[string]string)
}

func (ps *PlatformService) IsFirstUserAccount() bool {
	if shouldFetch, ok := ps.fetchUserCountForFirstUserAccountCheck.Load().(bool); ok && shouldFetch {
		count, err := ps.Store.User().Count(model.UserCountOptions{IncludeDeleted: true})
		if err != nil {
			return false
		}
		// Avoid calling the user count query in future if we get a count > 0
		if count > 0 {
			ps.fetchUserCountForFirstUserAccountCheck.Store(false)
			return false
		}
		return true
	}

	return false
}

func (ps *PlatformService) MaxPostSize() int {
	maxPostSize := ps.Store.Post().GetMaxPostSize()
	if maxPostSize == 0 {
		return model.PostMessageMaxRunesV1
	}

	return maxPostSize
}

func (ps *PlatformService) isUpgradedFromTE() bool {
	val, err := ps.Store.System().GetByName(model.SystemUpgradedFromTeId)
	if err != nil {
		return false
	}
	return val.Value == "true"
}

func (ps *PlatformService) GetSystemInstallDate() (int64, *model.AppError) {
	systemData, err := ps.Store.System().GetByName(model.SystemInstallationDateKey)
	if err != nil {
		return 0, model.NewAppError("getSystemInstallDate", "app.system.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	value, err := strconv.ParseInt(systemData.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("getSystemInstallDate", "app.system_install_date.parse_int.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return value, nil
}

func (ps *PlatformService) ClientConfig() map[string]string {
	return ps.clientConfig.Load().(map[string]string)

}
