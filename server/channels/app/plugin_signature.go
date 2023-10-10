// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"net/http"
	"path/filepath"

	"github.com/pkg/errors"
	"golang.org/x/crypto/openpgp"       //nolint:staticcheck
	"golang.org/x/crypto/openpgp/armor" //nolint:staticcheck

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	pUtils "github.com/mattermost/mattermost/server/public/utils"

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

// AddPublicKey will add plugin public key to the config. Overwrites the previous file
func (a *App) AddPublicKey(name string, key io.Reader) *model.AppError {
	if isSamlFile(&a.Config().SamlSettings, name) {
		return model.NewAppError("AddPublicKey", "app.plugin.modify_saml.app_error", nil, "", http.StatusInternalServerError)
	}
	data, err := io.ReadAll(key)
	if err != nil {
		return model.NewAppError("AddPublicKey", "app.plugin.write_file.read.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	err = a.Srv().platform.SetConfigFile(name, data)
	if err != nil {
		return model.NewAppError("AddPublicKey", "app.plugin.write_file.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		if !pUtils.Contains(cfg.PluginSettings.SignaturePublicKeyFiles, name) {
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

// VerifyPlugin checks that the given signature corresponds to the given plugin and matches a trusted certificate.
func (a *App) VerifyPlugin(plugin, signature io.ReadSeeker) *model.AppError {
	return a.ch.verifyPlugin(plugin, signature)
}

func (ch *Channels) verifyPlugin(plugin, signature io.ReadSeeker) *model.AppError {
	if err := verifySignature(bytes.NewReader(mattermostPluginPublicKey), plugin, signature); err == nil {
		return nil
	}
	publicKeys := ch.cfgSvc.Config().PluginSettings.SignaturePublicKeyFiles
	for _, pk := range publicKeys {
		pkBytes, appErr := ch.srv.getPublicKey(pk)
		if appErr != nil {
			mlog.Warn("Unable to get public key for ", mlog.String("filename", pk))
			continue
		}
		publicKey := bytes.NewReader(pkBytes)
		plugin.Seek(0, 0)
		signature.Seek(0, 0)
		if err := verifySignature(publicKey, plugin, signature); err == nil {
			return nil
		}
	}
	return model.NewAppError("VerifyPlugin", "api.plugin.verify_plugin.app_error", nil, "", http.StatusInternalServerError)
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
