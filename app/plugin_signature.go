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

var armoredSignatureHeaders = [...]string{
	"BEGIN PGP MESSAGE",
	"BEGIN PGP PUBLIC KEY BLOCK",
	"BEGIN PGP SIGNATURE",
	"BEGIN PGP SIGNED MESSAGE",
	"BEGIN PGP ARMORED FILE", /* gnupg extension */
	"BEGIN PGP PRIVATE KEY BLOCK",
	"BEGIN PGP SECRET KEY BLOCK", /* only used by pgp2 */
}

// VerifyPlugin checks that the given signature corresponds to the given plugin and matches a trusted certificate.
func (a *App) VerifyPlugin(plugin, signature io.Reader) *model.AppError {
	if verifySignature(bytes.NewReader(mattermostPublicKey), plugin, signature) == nil {
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
		if verifySignature(publicKey, plugin, signature) == nil {
			return nil
		}
	}
	return model.NewAppError("VerifyPlugin", "api.plugin.verify_plugin.app_error", nil, "", http.StatusInternalServerError)
}

func verifySignature(publicKey, message, sig io.Reader) error {
	pk, err := decodeIfArmored(publicKey)
	if err != nil {
		return errors.Wrap(err, "can't decode public key")
	}
	s, err := decodeIfArmored(sig)
	if err != nil {
		return errors.Wrap(err, "can't decode signature")
	}
	return verifyNotArmoredSignature(pk, message, s)
}

func verifyNotArmoredSignature(publicKey, signedFile, signature io.Reader) error {
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
