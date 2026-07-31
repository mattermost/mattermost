// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"net/http"
	"path/filepath"
	"slices"
	"strings"

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
	if signer, err := verifySignature(bytes.NewReader(mattermostPluginPublicKey), plugin, signature); err == nil {
		logger.Debug("Plugin signature verified using hard-coded public key", mlog.String("signing_key", describeSigner(signer)))
		return nil
	}

	// Then try any inline public keys.
	if inlineKeys := ch.srv.Config().PluginSettings.SignaturePublicKeys; inlineKeys != nil && *inlineKeys != "" {
		if _, err := plugin.Seek(0, io.SeekStart); err != nil {
			logger.Warn("Unable to seek in plugin reader for inline signature public keys", mlog.Err(err))
		} else if _, err := signature.Seek(0, io.SeekStart); err != nil {
			logger.Warn("Unable to seek in signature reader for inline signature public keys", mlog.Err(err))
		} else if signer, err := verifyWithArmoredKeyRing(*inlineKeys, plugin, signature); err == nil {
			logger.Debug("Plugin signature verified using inline public key", mlog.String("signing_key", describeSigner(signer)))
			return nil
		} else {
			logger.Warn("Unable to verify plugin signature using inline public keys", mlog.Err(err))
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
		if signer, err := verifySignature(publicKey, plugin, signature); err == nil {
			logger.Debug("Plugin signature verified using configured public key", mlog.String("public_key_path", pk), mlog.String("signing_key", describeSigner(signer)))
			return nil
		}
	}

	return model.NewAppError("VerifyPlugin", "api.plugin.verify_plugin.app_error", nil, "", http.StatusInternalServerError)
}

// describeSigner formats an entity for logging: its key ID, and any identities (name/email) it
// claims.
func describeSigner(entity *openpgp.Entity) string {
	if entity == nil {
		return "unknown"
	}
	names := make([]string, 0, len(entity.Identities))
	for _, identity := range entity.Identities {
		names = append(names, identity.Name)
	}
	if len(names) == 0 {
		return entity.PrimaryKey.KeyIdString()
	}
	return entity.PrimaryKey.KeyIdString() + " (" + strings.Join(names, ", ") + ")"
}

func verifySignature(publicKey, message, signature io.Reader) (*openpgp.Entity, error) {
	pk, err := decodeIfArmored(publicKey)
	if err != nil {
		return nil, errors.Wrap(err, "can't decode public key")
	}
	s, err := decodeIfArmored(signature)
	if err != nil {
		return nil, errors.Wrap(err, "can't decode signature")
	}
	return verifyBinarySignature(pk, message, s)
}

// pgpPublicKeyBlockEnd marks the end of one ASCII-armored PGP public key block. Unlike
// openpgp.ReadArmoredKeyRing, which decodes a single armor envelope whose body may itself pack
// several keys, verifyWithArmoredKeyRing accepts several such envelopes concatenated as plain
// text, splitting on this marker to decode and merge them independently.
const pgpPublicKeyBlockEnd = "-----END PGP PUBLIC KEY BLOCK-----"

// verifyWithArmoredKeyRing verifies a signature against one or more concatenated ASCII-armored
// PGP public keys, unlike verifySignature which reads a single key.
func verifyWithArmoredKeyRing(armoredKeys string, message, signature io.Reader) (*openpgp.Entity, error) {
	var keyring openpgp.EntityList
	for remaining := armoredKeys; strings.TrimSpace(remaining) != ""; {
		end := strings.Index(remaining, pgpPublicKeyBlockEnd)
		if end == -1 {
			return nil, errors.New("armored public key ring has a block missing its closing marker")
		}
		end += len(pgpPublicKeyBlockEnd)

		block, err := armor.Decode(strings.NewReader(remaining[:end]))
		if err != nil {
			return nil, errors.Wrap(err, "can't decode armored public key block")
		}
		entities, err := openpgp.ReadKeyRing(block.Body)
		if err != nil {
			return nil, errors.Wrap(err, "can't read public key block")
		}
		keyring = append(keyring, entities...)

		remaining = remaining[end:]
	}
	if len(keyring) == 0 {
		return nil, errors.New("no public keys found in configured key ring")
	}

	s, err := decodeIfArmored(signature)
	if err != nil {
		return nil, errors.Wrap(err, "can't decode signature")
	}
	signer, err := openpgp.CheckDetachedSignature(keyring, message, s)
	if err != nil {
		return nil, errors.Wrap(err, "error while checking the signature")
	}
	return signer, nil
}

func verifyBinarySignature(publicKey, signedFile, signature io.Reader) (*openpgp.Entity, error) {
	keyring, err := openpgp.ReadKeyRing(publicKey)
	if err != nil {
		return nil, errors.Wrap(err, "can't read public key")
	}
	signer, err := openpgp.CheckDetachedSignature(keyring, signedFile, signature)
	if err != nil {
		return nil, errors.Wrap(err, "error while checking the signature")
	}
	return signer, nil
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
