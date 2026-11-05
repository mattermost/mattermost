// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"slices"

	"github.com/pkg/errors"
	"golang.org/x/crypto/openpgp"       //nolint:staticcheck
	"golang.org/x/crypto/openpgp/armor" //nolint:staticcheck

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"

	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// GetPublicKey will return the actual public key saved in the `name` file.
func (a *App) GetPublicKey(name string) ([]byte, *model.AppError) {
	return a.Srv().getPublicKey(name)
}

func (s *Server) getPublicKey(name string) ([]byte, *model.AppError) {
	data, err := s.platform.GetConfigFile(name)
	if err != nil {
		return nil, model.NewAppError("GetPublicKey", "app.plugin.get_public_key.get_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return data, nil
}

var validPublicKeyName = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.\-]*$`)

// IsPluginPublicKeyFile reports whether name is one of the configured plugin signature public keys.
func (a *App) IsPluginPublicKeyFile(name string) bool {
	return slices.Contains(a.Config().PluginSettings.SignaturePublicKeyFiles, name)
}

// AddPublicKey will add plugin public key to the config. It never overwrites an existing file.
func (a *App) AddPublicKey(name string, key io.Reader) *model.AppError {
	if isSamlFile(&a.Config().SamlSettings, name) {
		return model.NewAppError("AddPublicKey", "app.plugin.modify_saml.app_error", nil, "", http.StatusInternalServerError)
	}
	if !validPublicKeyName.MatchString(name) {
		return model.NewAppError("AddPublicKey", "app.plugin.add_public_key.invalid_name.app_error", map[string]any{"Name": name}, "", http.StatusBadRequest)
	}
	exists, err := a.Srv().platform.HasConfigFile(name)
	if err != nil {
		return model.NewAppError("AddPublicKey", "app.plugin.write_file.read.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if exists {
		return model.NewAppError("AddPublicKey", "app.plugin.add_public_key.file_exists.app_error", map[string]any{"Name": name}, "", http.StatusConflict)
	}
	data, err := io.ReadAll(key)
	if err != nil {
		return model.NewAppError("AddPublicKey", "app.plugin.write_file.read.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err = validatePublicKey(data); err != nil {
		return model.NewAppError("AddPublicKey", "app.plugin.add_public_key.invalid_key.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	err = a.Srv().platform.SetConfigFile(name, data)
	if err != nil {
		return model.NewAppError("AddPublicKey", "app.plugin.write_file.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		if !slices.Contains(cfg.PluginSettings.SignaturePublicKeyFiles, name) {
			cfg.PluginSettings.SignaturePublicKeyFiles = append(cfg.PluginSettings.SignaturePublicKeyFiles, name)
		}
	})

	return nil
}

// DeletePublicKey will delete plugin public key from the config.
func (a *App) DeletePublicKey(name string) *model.AppError {
	if isSamlFile(&a.Config().SamlSettings, name) {
		return model.NewAppError("AddPublicKey", "app.plugin.modify_saml.app_error", nil, "", http.StatusInternalServerError)
	}
	filename := filepath.Base(name)
	if err := a.Srv().platform.RemoveConfigFile(filename); err != nil {
		return model.NewAppError("DeletePublicKey", "app.plugin.delete_public_key.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.SignaturePublicKeyFiles = utils.RemoveStringFromSlice(filename, cfg.PluginSettings.SignaturePublicKeyFiles)
	})

	return nil
}

func (ch *Channels) verifyPlugin(logger *mlog.Logger, plugin, signature io.ReadSeeker) *model.AppError {
	// First try verifying using the hard-coded public key.
	if err := verifySignature(bytes.NewReader(mattermostPluginPublicKey), plugin, signature); err == nil {
		logger.Debug("Plugin signature verified using hard-coded public key")
		return nil
	}

	// Next, if enabled, try verifying using the hard-coded MFI public key.
	if ch.srv.Config().FeatureFlags.EnableMFIPluginSignaturePublicKey {
		if _, err := plugin.Seek(0, io.SeekStart); err != nil {
			logger.Warn("Unable to seek in plugin reader for MFI public key")
		} else if _, err := signature.Seek(0, io.SeekStart); err != nil {
			logger.Warn("Unable to seek in signature reader for MFI public key")
		} else if err := verifySignature(bytes.NewReader(mfiPluginPublicKey), plugin, signature); err == nil {
			logger.Debug("Plugin signature verified using hard-coded MFI public key")
			return nil
		}
	}

	// If that fails, try any of the admin-configured public keys.
	publicKeys := ch.srv.Config().PluginSettings.SignaturePublicKeyFiles
	for _, pk := range publicKeys {
		pkBytes, appErr := ch.srv.getPublicKey(pk)
		if appErr != nil {
			logger.Warn("Unable to read configured signature public key file", mlog.String("public_key_path", pk))
			continue
		}
		publicKey := bytes.NewReader(pkBytes)
		if _, err := plugin.Seek(0, io.SeekStart); err != nil {
			logger.Warn("Unable to seek in public key reader for ", mlog.String("public_key_path", pk))
			continue
		}
		if _, err := signature.Seek(0, io.SeekStart); err != nil {
			logger.Warn("Unable to seek in signature for public key ", mlog.String("public_key_path", pk))
			continue
		}
		if err := verifySignature(publicKey, plugin, signature); err == nil {
			logger.Debug("Plugin signature verified using configured public key", mlog.String("public_key_path", pk))
			return nil
		}
	}

	return model.NewAppError("VerifyPlugin", "api.plugin.verify_plugin.app_error", nil, "", http.StatusInternalServerError)
}

func validatePublicKey(data []byte) error {
	pk, err := decodeIfArmored(bytes.NewReader(data))
	if err != nil {
		return errors.Wrap(err, "can't decode public key")
	}
	keyring, err := openpgp.ReadKeyRing(pk)
	if err != nil {
		return errors.Wrap(err, "can't read public key")
	}
	if len(keyring) == 0 {
		return errors.New("no public keys found")
	}
	for _, entity := range keyring {
		if entity.PrivateKey != nil {
			return errors.New("refusing to store a private key")
		}
	}
	return nil
}

func verifySignature(publicKey, message, signature io.Reader) error {
	pk, err := decodeIfArmored(publicKey)
	if err != nil {
		return errors.Wrap(err, "can't decode public key")
	}
	s, err := decodeIfArmored(signature)
	if err != nil {
		return errors.Wrap(err, "can't decode signature")
	}
	return verifyBinarySignature(pk, message, s)
}

func verifyBinarySignature(publicKey, signedFile, signature io.Reader) error {
	keyring, err := openpgp.ReadKeyRing(publicKey)
	if err != nil {
		return errors.Wrap(err, "can't read public key")
	}
	if _, err = openpgp.CheckDetachedSignature(keyring, signedFile, signature); err != nil {
		return errors.Wrap(err, "error while checking the signature")
	}
	return nil
}

func decodeIfArmored(reader io.Reader) (io.Reader, error) {
	readBytes, err := io.ReadAll(reader)
	if err != nil {
		return nil, errors.Wrap(err, "can't read the file")
	}
	block, err := armor.Decode(bytes.NewReader(readBytes))
	if err != nil {
		return bytes.NewReader(readBytes), nil
	}
	return block.Body, nil
}

// isSamlFile checks if filename is a SAML file.
func isSamlFile(saml *model.SamlSettings, filename string) bool {
	return filename == *saml.PublicCertificateFile || filename == *saml.PrivateKeyFile || filename == *saml.IdpCertificateFile
}
