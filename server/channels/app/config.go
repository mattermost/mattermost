// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/json"
	"net/url"
	"reflect"
	"strconv"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mail"
)

const (
	ErrorTermsOfServiceNoRowsFound = "app.terms_of_service.get.no_rows.app_error"
)

func (s *Server) Config() *model.Config {
	return s.platform.Config()
}

func (a *App) Config() *model.Config {
	return a.ch.cfgSvc.Config()
}

func (a *App) EnvironmentConfig(filter func(reflect.StructField) bool) map[string]any {
	return a.Srv().platform.GetEnvironmentOverridesWithFilter(filter)
}

func (a *App) UpdateConfig(f func(*model.Config)) {
	a.Srv().platform.UpdateConfig(f)
}

func (a *App) IsConfigReadOnly() bool {
	return a.Srv().platform.IsConfigReadOnly()
}

func (a *App) ReloadConfig() error {
	return a.Srv().platform.ReloadConfig()
}

func (a *App) ClientConfig() map[string]string {
	return a.ch.srv.platform.ClientConfig()
}

func (a *App) ClientConfigHash() string {
	return a.ch.ClientConfigHash()
}

func (a *App) LimitedClientConfig() map[string]string {
	return a.ch.srv.platform.LimitedClientConfig()
}

func (a *App) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return a.Srv().platform.AddConfigListener(listener)
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func (a *App) RemoveConfigListener(id string) {
	a.Srv().platform.RemoveConfigListener(id)
}

// ensurePostActionCookieSecret ensures that the key for encrypting PostActionCookie exists
// and future calls to PostActionCookieSecret will always return a valid key, same on all
// servers in the cluster
func (ch *Channels) ensurePostActionCookieSecret() error {
	if ch.postActionCookieSecret != nil {
		return nil
	}

	var secret *model.SystemPostActionCookieSecret

	value, err := ch.srv.Store().System().GetByName(model.SystemPostActionCookieSecretKey)
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
			Name: model.SystemPostActionCookieSecretKey,
		}
		v, err := json.Marshal(newSecret)
		if err != nil {
			return err
		}
		system.Value = string(v)
		// If we were able to save the key, use it, otherwise log the error.
		if err = ch.srv.Store().System().Save(system); err != nil {
			mlog.Warn("Failed to save PostActionCookieSecret", mlog.Err(err))
		} else {
			secret = newSecret
		}
	}

	// If we weren't able to save a new key above, another server must have beat us to it. Get the
	// key from the database, and if that fails, error out.
	if secret == nil {
		value, err := ch.srv.Store().System().GetByName(model.SystemPostActionCookieSecretKey)
		if err != nil {
			return err
		}

		if err := json.Unmarshal([]byte(value.Value), &secret); err != nil {
			return err
		}
	}

	ch.postActionCookieSecret = secret.Secret
	return nil
}

func (s *Server) ensureInstallationDate() error {
	_, appErr := s.platform.GetSystemInstallDate()
	if appErr == nil {
		return nil
	}

	installDate, nErr := s.Store().User().InferSystemInstallDate()
	var installationDate int64
	if nErr == nil && installDate > 0 {
		installationDate = installDate
	} else {
		installationDate = utils.MillisFromTime(time.Now())
	}

	if err := s.Store().System().SaveOrUpdate(&model.System{
		Name:  model.SystemInstallationDateKey,
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

	if err := s.Store().System().SaveOrUpdate(&model.System{
		Name:  model.SystemFirstServerRunTimestampKey,
		Value: strconv.FormatInt(utils.MillisFromTime(time.Now()), 10),
	}); err != nil {
		return err
	}
	return nil
}

// AsymmetricSigningKey will return a private key that can be used for asymmetric signing.
func (ch *Channels) AsymmetricSigningKey() *ecdsa.PrivateKey {
	return ch.srv.platform.AsymmetricSigningKey()
}

func (a *App) AsymmetricSigningKey() *ecdsa.PrivateKey {
	return a.ch.AsymmetricSigningKey()
}

func (ch *Channels) PostActionCookieSecret() []byte {
	return ch.postActionCookieSecret
}

func (a *App) PostActionCookieSecret() []byte {
	return a.ch.PostActionCookieSecret()
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

// GetConfigFile proxies access to the given configuration file to the underlying config store.
func (a *App) GetConfigFile(name string) ([]byte, error) {
	data, err := a.Srv().platform.GetConfigFile(name)
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
// If filter is not nil and returns false for a struct field, that field will be omitted.
func (a *App) GetEnvironmentConfig(filter func(reflect.StructField) bool) map[string]any {
	return a.EnvironmentConfig(filter)
}

// SaveConfig replaces the active configuration, optionally notifying cluster peers.
func (a *App) SaveConfig(newCfg *model.Config, sendConfigChangeClusterMessage bool) (*model.Config, *model.Config, *model.AppError) {
	return a.Srv().platform.SaveConfig(newCfg, sendConfigChangeClusterMessage)
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

func (s *Server) MailServiceConfig() *mail.SMTPConfig {
	emailSettings := s.platform.Config().EmailSettings
	hostname := utils.GetHostnameFromSiteURL(*s.platform.Config().ServiceSettings.SiteURL)
	cfg := mail.SMTPConfig{
		Hostname:                          hostname,
		ConnectionSecurity:                *emailSettings.ConnectionSecurity,
		SkipServerCertificateVerification: *emailSettings.SkipServerCertificateVerification,
		ServerName:                        *emailSettings.SMTPServer,
		Server:                            *emailSettings.SMTPServer,
		Port:                              *emailSettings.SMTPPort,
		ServerTimeout:                     *emailSettings.SMTPServerTimeout,
		Username:                          *emailSettings.SMTPUsername,
		Password:                          *emailSettings.SMTPPassword,
		EnableSMTPAuth:                    *emailSettings.EnableSMTPAuth,
		SendEmailNotifications:            *emailSettings.SendEmailNotifications,
		FeedbackName:                      *emailSettings.FeedbackName,
		FeedbackEmail:                     *emailSettings.FeedbackEmail,
		ReplyToAddress:                    *emailSettings.ReplyToAddress,
	}
	return &cfg
}
