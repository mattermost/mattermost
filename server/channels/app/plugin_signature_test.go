// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/openpgp"        //nolint:staticcheck
	"golang.org/x/crypto/openpgp/armor"  //nolint:staticcheck
	"golang.org/x/crypto/openpgp/packet" //nolint:staticcheck

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestPluginPublicKeys(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	path, _ := fileutils.FindDir("tests")
	publicKeyFilename := "test-public-key.plugin.gpg"
	publicKey, err := os.ReadFile(filepath.Join(path, publicKeyFilename))
	require.NoError(t, err)
	fileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
	require.NoError(t, err)
	defer fileReader.Close()
	appErr := th.App.AddPublicKey(publicKeyFilename, fileReader)
	require.Nil(t, appErr)
	file, appErr := th.App.GetPublicKey(publicKeyFilename)
	require.Nil(t, appErr)
	require.Equal(t, publicKey, file)
	_, appErr = th.App.GetPublicKey("wrong file name")
	require.NotNil(t, appErr)
	_, appErr = th.App.GetPublicKey("wrong-file-name.plugin.gpg")
	require.NotNil(t, appErr)

	appErr = th.App.DeletePublicKey("wrong file name")
	require.Nil(t, appErr)
	appErr = th.App.DeletePublicKey("wrong-file-name.plugin.gpg")
	require.Nil(t, appErr)

	appErr = th.App.DeletePublicKey(publicKeyFilename)
	require.Nil(t, appErr)
	_, appErr = th.App.GetPublicKey(publicKeyFilename)
	require.NotNil(t, appErr)
}

// generateArmoredPublicKey returns a freshly generated, well-formed but unrelated ASCII-armored
// public key, standing in for a second administrator-configured key that doesn't match the
// signature under test.
func generateArmoredPublicKey(t *testing.T) string {
	t.Helper()
	entity, err := openpgp.NewEntity("decoy", "", "decoy@example.com", &packet.Config{RSABits: 1024})
	require.NoError(t, err)

	var buf bytes.Buffer
	armorWriter, err := armor.Encode(&buf, openpgp.PublicKeyType, nil)
	require.NoError(t, err)
	require.NoError(t, entity.Serialize(armorWriter))
	require.NoError(t, armorWriter.Close())

	return buf.String()
}

// combineIntoSingleArmorEnvelope re-packs several armored public keys into one armor envelope
// whose body carries all of their binary packets, matching what `gpg --export --armor key1 key2`
// produces -- as opposed to simply concatenating each key's own separate envelope as text.
func combineIntoSingleArmorEnvelope(t *testing.T, armoredKeys ...string) string {
	t.Helper()
	var buf bytes.Buffer
	armorWriter, err := armor.Encode(&buf, openpgp.PublicKeyType, nil)
	require.NoError(t, err)

	for _, armoredKey := range armoredKeys {
		block, err := armor.Decode(strings.NewReader(armoredKey))
		require.NoError(t, err)
		entities, err := openpgp.ReadKeyRing(block.Body)
		require.NoError(t, err)
		for _, entity := range entities {
			require.NoError(t, entity.Serialize(armorWriter))
		}
	}
	require.NoError(t, armorWriter.Close())

	return buf.String()
}

func TestVerifyWithArmoredKeyRing(t *testing.T) {
	mainHelper.Parallel(t)
	path, _ := fileutils.FindDir("tests")

	developmentKey, err := os.ReadFile(filepath.Join(path, "development-public-key.asc"))
	require.NoError(t, err)
	decoyKey := generateArmoredPublicKey(t)

	openPlugin := func(t *testing.T) (*os.File, *os.File) {
		t.Helper()
		pluginFile, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)
		t.Cleanup(func() { pluginFile.Close() })
		signatureFile, err := os.Open(filepath.Join(path, "testplugin.tar.gz.sig"))
		require.NoError(t, err)
		t.Cleanup(func() { signatureFile.Close() })
		return pluginFile, signatureFile
	}

	t.Run("verifies against a single inline key", func(t *testing.T) {
		pluginFile, signatureFile := openPlugin(t)
		signer, err := verifyWithArmoredKeyRing(string(developmentKey), pluginFile, signatureFile)
		require.NoError(t, err)
		require.NotNil(t, signer)
	})

	t.Run("verifies against the matching key in a multi-key ring", func(t *testing.T) {
		pluginFile, signatureFile := openPlugin(t)
		keyRing := decoyKey + string(developmentKey)
		signer, err := verifyWithArmoredKeyRing(keyRing, pluginFile, signatureFile)
		require.NoError(t, err)
		require.NotNil(t, signer)
	})

	t.Run("verifies against a key packed alongside others in a single armor envelope", func(t *testing.T) {
		// Unlike the concatenated-envelopes case above, gpg's own `--export key1 key2` produces
		// one envelope whose body packs every key's binary data together.
		keyRing := combineIntoSingleArmorEnvelope(t, decoyKey, string(developmentKey))
		require.Equal(t, 1, strings.Count(keyRing, "-----BEGIN PGP PUBLIC KEY BLOCK-----"),
			"the combined export should be a single envelope, not several concatenated ones")

		pluginFile, signatureFile := openPlugin(t)
		signer, err := verifyWithArmoredKeyRing(keyRing, pluginFile, signatureFile)
		require.NoError(t, err)
		require.NotNil(t, signer)
	})

	t.Run("fails when no key in the ring matches", func(t *testing.T) {
		pluginFile, signatureFile := openPlugin(t)
		_, err := verifyWithArmoredKeyRing(decoyKey, pluginFile, signatureFile)
		require.Error(t, err)
	})

	t.Run("fails on malformed key material", func(t *testing.T) {
		pluginFile, signatureFile := openPlugin(t)
		_, err := verifyWithArmoredKeyRing("not a key", pluginFile, signatureFile)
		require.Error(t, err)
	})
}

func TestVerifyPluginWithInlineSignaturePublicKeys(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	path, _ := fileutils.FindDir("tests")
	ch := th.App.Channels()
	logger := th.App.Srv().Log()

	developmentKey, err := os.ReadFile(filepath.Join(path, "development-public-key.asc"))
	require.NoError(t, err)

	// testplugin.tar.gz is signed with the development key rather than the hard-coded Mattermost
	// one, so it verifies only once that key is reachable.
	openPlugin := func(t *testing.T) (*os.File, *os.File) {
		t.Helper()
		pluginFile, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)
		t.Cleanup(func() { pluginFile.Close() })
		signatureFile, err := os.Open(filepath.Join(path, "testplugin.tar.gz.sig"))
		require.NoError(t, err)
		t.Cleanup(func() { signatureFile.Close() })
		return pluginFile, signatureFile
	}

	t.Run("fails before the key is configured", func(t *testing.T) {
		pluginFile, signatureFile := openPlugin(t)
		require.NotNil(t, ch.verifyPlugin(logger, pluginFile, signatureFile))
	})

	t.Run("verifies with a key supplied inline", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			keys := string(developmentKey)
			cfg.PluginSettings.SignaturePublicKeys = &keys
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				empty := ""
				cfg.PluginSettings.SignaturePublicKeys = &empty
			})
		})

		pluginFile, signatureFile := openPlugin(t)
		require.Nil(t, ch.verifyPlugin(logger, pluginFile, signatureFile))
	})
}

// TestVerifyPluginWithSignaturePublicKeysFromEnvironment proves the key material can be supplied
// by a genuine environment variable rather than patched directly into the in-memory config, and
// that its newlines survive that round trip intact for both a single key and several concatenated
// keys.
func TestVerifyPluginWithSignaturePublicKeysFromEnvironment(t *testing.T) {
	// t.Setenv prevents t.Parallel — env var has no config equivalent
	th := Setup(t)

	path, _ := fileutils.FindDir("tests")
	ch := th.App.Channels()
	logger := th.App.Srv().Log()

	developmentKey, err := os.ReadFile(filepath.Join(path, "development-public-key.asc"))
	require.NoError(t, err)
	decoyKey := generateArmoredPublicKey(t)

	// testplugin.tar.gz is signed with the development key rather than the hard-coded Mattermost
	// one, so it verifies only once that key is reachable.
	openPlugin := func(t *testing.T) (*os.File, *os.File) {
		t.Helper()
		pluginFile, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)
		t.Cleanup(func() { pluginFile.Close() })
		signatureFile, err := os.Open(filepath.Join(path, "testplugin.tar.gz.sig"))
		require.NoError(t, err)
		t.Cleanup(func() { signatureFile.Close() })
		return pluginFile, signatureFile
	}

	t.Run("fails before any environment variable is set", func(t *testing.T) {
		pluginFile, signatureFile := openPlugin(t)
		require.NotNil(t, ch.verifyPlugin(logger, pluginFile, signatureFile))
	})

	t.Run("verifies with a single key set via environment variable", func(t *testing.T) {
		t.Setenv("MM_PLUGINSETTINGS_SIGNATUREPUBLICKEYS", string(developmentKey))
		require.NoError(t, th.App.ReloadConfig())

		require.Equal(t, string(developmentKey), *th.App.Config().PluginSettings.SignaturePublicKeys,
			"the key must reach config with its newlines intact")

		pluginFile, signatureFile := openPlugin(t)
		require.Nil(t, ch.verifyPlugin(logger, pluginFile, signatureFile))
	})

	t.Run("verifies with multiple keys concatenated in one environment variable", func(t *testing.T) {
		keys := decoyKey + string(developmentKey)
		t.Setenv("MM_PLUGINSETTINGS_SIGNATUREPUBLICKEYS", keys)
		require.NoError(t, th.App.ReloadConfig())

		require.Equal(t, keys, *th.App.Config().PluginSettings.SignaturePublicKeys,
			"both concatenated keys, and the newlines between them, must reach config intact")

		pluginFile, signatureFile := openPlugin(t)
		require.Nil(t, ch.verifyPlugin(logger, pluginFile, signatureFile))
	})

	t.Run("fails when the environment variable holds only an unrelated key", func(t *testing.T) {
		t.Setenv("MM_PLUGINSETTINGS_SIGNATUREPUBLICKEYS", decoyKey)
		require.NoError(t, th.App.ReloadConfig())

		pluginFile, signatureFile := openPlugin(t)
		require.NotNil(t, ch.verifyPlugin(logger, pluginFile, signatureFile))
	})
}

func TestVerifySignature(t *testing.T) {
	mainHelper.Parallel(t)
	path, _ := fileutils.FindDir("tests")
	pluginFilename := "testplugin.tar.gz"
	signatureFilename := "testplugin.tar.gz.sig"
	armoredSignatureFilename := "testplugin.tar.gz.asc"
	publicKeyFilename := "development-public-key.gpg"
	armoredPublicKeyFilename := "development-public-key.asc"
	t.Run("verify armored signature and armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, armoredPublicKeyFilename))
		require.NoError(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, armoredSignatureFilename))
		require.NoError(t, err)
		defer signatureFileReader.Close()
		_, err = verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader)
		require.NoError(t, err)
	})
	t.Run("verify non armored signature and armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, armoredPublicKeyFilename))
		require.NoError(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.NoError(t, err)
		defer signatureFileReader.Close()
		_, err = verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader)
		require.NoError(t, err)
	})
	t.Run("verify armored signature and non armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.NoError(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		armoredSignatureFileReader, err := os.Open(filepath.Join(path, armoredSignatureFilename))
		require.NoError(t, err)
		defer armoredSignatureFileReader.Close()
		_, err = verifySignature(publicKeyFileReader, pluginFileReader, armoredSignatureFileReader)
		require.NoError(t, err)
	})
	t.Run("verify non armored signature and non armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.NoError(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.NoError(t, err)
		defer signatureFileReader.Close()
		_, err = verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader)
		require.NoError(t, err)
	})
}
