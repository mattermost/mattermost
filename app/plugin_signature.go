// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"strings"

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

// VerifyPlugin gets two files a plugin bundle and a signature.
// Method verifies that plugin was signed using a private key which
// pairs with one of the public keys stored on MM server.
// VerifyPlugin returns nil if plugin was signed correctly.
func (a *App) VerifyPlugin(plugin, signature io.Reader) *model.AppError {
	publicKeys, appErr := a.GetPluginPublicKeys()
	if appErr != nil {
		return appErr
	}
	for _, pk := range publicKeys {
		pkBytes, appErr := a.GetPublicKey(pk)
		if appErr != nil {
			mlog.Error("Unable to get public key for ", mlog.String("filename", pk))
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
	armored, err := isArmoredReader(bufio.NewReader(bytes.NewReader(readBytes)))
	if err != nil {
		return nil, errors.Wrap(err, "unable to check reader")
	}
	if armored {
		block, err := armor.Decode(bytes.NewReader(readBytes))
		if err != nil {
			return nil, errors.Wrap(err, "unable to decode armored reader")
		}
		return block.Body, nil
	}
	return bytes.NewReader(readBytes), nil
}

func isArmoredReader(reader *bufio.Reader) (bool, error) {
	line, err := reader.ReadString('\n')
	if err != nil {
		return false, errors.Wrap(err, "Unable to read the reader")
	}
	return isArmoredHeader(line), nil
}

// isArmoredHeader is implemented according to https://git.gnupg.org/cgi-bin/gitweb.cgi?p=gnupg.git;a=blob;f=g10/armor.c;hb=HEAD#l389
func isArmoredHeader(line string) bool {
	if len(line) < 15 {
		return false
	}
	if !strings.HasPrefix(line, "-----") {
		return false
	}
	line = strings.TrimSpace(line)
	if !strings.HasSuffix(line, "-----") {
		return false
	}
	line = strings.TrimPrefix(line, "-----")
	line = strings.TrimSuffix(line, "-----")
	for _, header := range armoredSignatureHeaders {
		if line == header {
			return true
		}
	}
	return false //unknown armor line
}
