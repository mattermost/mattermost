// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
)

// VerifyPluginWithSignatures verifies that at least one signature corresponds to some public key.
func (a *App) VerifyPluginWithSignatures(plugin io.ReadSeeker, signatures []io.ReadSeeker) *model.AppError {
	for _, signature := range signatures {
		plugin.Seek(0, 0)
		appErr := a.VerifyPlugin(plugin, signature)
		if appErr == nil {
			return nil
		}
	}
	return model.NewAppError("VerifyPluginWithSignatures", "api.plugin.install.verify_plugin.app_error", nil, "", http.StatusInternalServerError)
}

// VerifyPlugin checks that the given signature corresponds to the given plugin and matches a trusted certificate.
func (a *App) VerifyPlugin(plugin, signature io.ReadSeeker) *model.AppError {
	if err := verifySignature(bytes.NewReader(mattermostPublicKey), plugin, signature); err == nil {
		return nil
	}
	publicKeys, appErr := a.GetPluginPublicKeys()
	if appErr != nil {
		return appErr
	}
	for _, pk := range publicKeys {
		pkBytes, appErr := a.GetPublicKey(pk)
		if appErr != nil {
			mlog.Error("Unable to get public key for ", mlog.String("filename", pk))
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
