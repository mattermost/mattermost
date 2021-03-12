// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"path/filepath"

	"github.com/pkg/errors"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/utils"
)

// GetPluginPublicKeyFiles returns all public keys listed in the config.
func (a *App) GetPluginPublicKeyFiles() ([]string, *model.AppError) {
	return a.Config().PluginSettings.SignaturePublicKeyFiles, nil
}

// GetPublicKey will return the actual public key saved in the `name` file.
func (a *App) GetPublicKey(name string) ([]byte, *model.AppError) {
	data, err := a.Srv().configStore.GetFile(name)
	if err != nil {
		return nil, model.NewAppError("GetPublicKey", "app.plugin.get_public_key.get_file.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return data, nil
}

// AddPublicKey will add plugin public key to the config. Overwrites the previous file
func (a *App) AddPublicKey(name string, key io.Reader) *model.AppError {
	if model.IsSamlFile(&a.Config().SamlSettings, name) {
		return model.NewAppError("AddPublicKey", "app.plugin.modify_saml.app_error", nil, "", http.StatusInternalServerError)
	}
	data, err := ioutil.ReadAll(key)
	if err != nil {
		return model.NewAppError("AddPublicKey", "app.plugin.write_file.read.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	err = a.Srv().configStore.SetFile(name, data)
	if err != nil {
		return model.NewAppError("AddPublicKey", "app.plugin.write_file.saving.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		if !utils.StringInSlice(name, cfg.PluginSettings.SignaturePublicKeyFiles) {
			cfg.PluginSettings.SignaturePublicKeyFiles = append(cfg.PluginSettings.SignaturePublicKeyFiles, name)
		}
	})

	return nil
}

// DeletePublicKey will delete plugin public key from the config.
func (a *App) DeletePublicKey(name string) *model.AppError {
	if model.IsSamlFile(&a.Config().SamlSettings, name) {
		return model.NewAppError("AddPublicKey", "app.plugin.modify_saml.app_error", nil, "", http.StatusInternalServerError)
	}
	filename := filepath.Base(name)
	if err := a.Srv().configStore.RemoveFile(filename); err != nil {
		return model.NewAppError("DeletePublicKey", "app.plugin.delete_public_key.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.SignaturePublicKeyFiles = utils.RemoveStringFromSlice(filename, cfg.PluginSettings.SignaturePublicKeyFiles)
	})

	return nil
}

// VerifyPlugin checks that the given signature corresponds to the given plugin and matches a trusted certificate.
func (a *App) VerifyPlugin(plugin, signature io.ReadSeeker) *model.AppError {
	if err := verifySignature(bytes.NewReader(mattermostPluginPublicKey), plugin, signature); err == nil {
		return nil
	}
	publicKeys, appErr := a.GetPluginPublicKeyFiles()
	if appErr != nil {
		return appErr
	}
	for _, pk := range publicKeys {
		pkBytes, appErr := a.GetPublicKey(pk)
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

func verifySignature(publicKey, message, signatrue io.Reader) error {
	pk, err := decodeIfArmored(publicKey)
	if err != nil {
		return errors.Wrap(err, "can't decode public key")
	}
	s, err := decodeIfArmored(signatrue)
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
	readBytes, err := ioutil.ReadAll(reader)
	if err != nil {
		return nil, errors.Wrap(err, "can't read the file")
	}
	block, err := armor.Decode(bytes.NewReader(readBytes))
	if err != nil {
		return bytes.NewReader(readBytes), nil
	}
	return block.Body, nil
}
