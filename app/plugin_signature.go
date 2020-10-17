// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"path/filepath"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/pkg/errors"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
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

var errMatched = model.NewAppError("", "", nil, "matched", http.StatusInternalServerError)

// VerifyPlugin checks that the given signature corresponds to the given plugin and matches a trusted certificate.
func (a *App) VerifyPlugin(plugin io.Reader, signatureFile io.Reader) *model.AppError {
	data, eee := ioutil.ReadAll(plugin)
	a.Log().Warn(fmt.Sprintf("<><> VerifyPlugin 1: read %v bytes, error: %v\n", len(data), eee))
	plugin = bytes.NewReader(data)

	sig, err := ioutil.ReadAll(signatureFile)
	if err != nil {
		return model.NewAppError("VerifyPlugin", "app.plugin.marketplace_plugins.signature_not_found.app_error", nil, "", http.StatusInternalServerError)
	}
	matcher := func(pk []byte) ccReaderFunc {
		return func(clone io.Reader) *model.AppError {
			return verifySignatureMismatch(bytes.NewReader(pk), clone, bytes.NewReader(sig))
		}
	}

	matchers := []ccReaderFunc{
		matcher(mattermostPluginPublicKey),
	}

	pkFiles, appErr := a.GetPluginPublicKeyFiles()
	if appErr != nil {
		return appErr
	}
	for _, file := range pkFiles {
		var data []byte
		data, appErr = a.GetPublicKey(file)
		if appErr != nil {
			mlog.Error("Unable to get public key for ", mlog.String("filename", file))
			continue
		}
		matchers = append(matchers, matcher(data))
	}

	appErr = runWithCCReader(plugin, matchers...)
	if appErr != errMatched {
		if appErr != nil {
			return appErr
		}
		return model.NewAppError("VerifyPlugin", "api.plugin.verify_plugin.app_error", nil, "signature did not match", http.StatusInternalServerError)
	}

	return nil
}

// verifySignatureMismatch is a wrapper to use with runWithCCREader,
// concurrently. It reverses the logic, returning a nil error when there's no
// match, and errMatched otherwise. Then, runWithCCReader can return a single
// errMatched "error" if one match was successful.
func verifySignatureMismatch(publicKey, signed, signatrue io.Reader) *model.AppError {
	err := verifySignature(publicKey, signed, signatrue)
	if err == nil {
		return errMatched
	}
	return nil
}

func verifySignature(publicKey, signed, signatrue io.Reader) error {
	data, eee := ioutil.ReadAll(signed)
	mlog.Warn(fmt.Sprintf("<><> verifySignature 1: read %v bytes, error: %v\n", len(data), eee))
	signed = bytes.NewReader(data)

	pk, err := decodeIfArmored(publicKey)
	if err != nil {
		return errors.Wrap(err, "can't decode public key")
	}
	s, err := decodeIfArmored(signatrue)
	if err != nil {
		return errors.Wrap(err, "can't decode signature")
	}
	return verifyBinarySignature(pk, signed, s)
}

func verifyBinarySignature(publicKey, signed, signature io.Reader) error {
	keyring, err := openpgp.ReadKeyRing(publicKey)
	if err != nil {
		return errors.Wrap(err, "can't read public key")
	}
	if _, err = openpgp.CheckDetachedSignature(keyring, signed, signature); err != nil {
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
