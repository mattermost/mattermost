// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"crypto"
	"crypto/dsa" //nolint:staticcheck // DSA keys are generated only to verify they are rejected
	"crypto/rand"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

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
		require.NoError(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
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
		require.NoError(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
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
		require.NoError(t, verifySignature(publicKeyFileReader, pluginFileReader, armoredSignatureFileReader))
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
		require.NoError(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
}

func signDetached(t *testing.T, entity *openpgp.Entity, hash crypto.Hash, created time.Time, data []byte) []byte {
	t.Helper()
	sig := &packet.Signature{
		Version:      4,
		SigType:      packet.SigTypeBinary,
		PubKeyAlgo:   entity.PrimaryKey.PubKeyAlgo,
		Hash:         hash,
		CreationTime: created,
		IssuerKeyId:  &entity.PrimaryKey.KeyId,
	}
	h := hash.New()
	h.Write(data)
	require.NoError(t, sig.Sign(h, entity.PrivateKey, &packet.Config{NonDeterministicSignaturesViaNotation: model.NewPointer(false)}))
	var signature bytes.Buffer
	require.NoError(t, sig.Serialize(&signature))
	return signature.Bytes()
}

func serializePublicKey(t *testing.T, entity *openpgp.Entity) []byte {
	t.Helper()
	var publicKey bytes.Buffer
	require.NoError(t, entity.Serialize(&publicKey))
	return publicKey.Bytes()
}

func TestVerifyBinarySignatureRejectsWeakHash(t *testing.T) {
	mainHelper.Parallel(t)

	entity, err := openpgp.NewEntity("test", "", "test@example.com", &packet.Config{Algorithm: packet.PubKeyAlgoEdDSA})
	require.NoError(t, err)
	publicKey := serializePublicKey(t, entity)
	data := []byte("plugin bundle")

	t.Run("SHA-256 is accepted", func(t *testing.T) {
		signature := signDetached(t, entity, crypto.SHA256, time.Now(), data)
		require.NoError(t, verifyBinarySignature(bytes.NewReader(publicKey), bytes.NewReader(data), bytes.NewReader(signature)))
	})

	t.Run("SHA-1 is rejected", func(t *testing.T) {
		signature := signDetached(t, entity, crypto.SHA1, time.Now(), data)
		err := verifyBinarySignature(bytes.NewReader(publicKey), bytes.NewReader(data), bytes.NewReader(signature))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "insecure message hash algorithm")
	})
}

func TestVerifyBinarySignatureRejectsRetiredKey(t *testing.T) {
	mainHelper.Parallel(t)

	now := time.Now()
	entity, err := openpgp.NewEntity("test", "", "test@example.com", &packet.Config{
		Algorithm: packet.PubKeyAlgoEdDSA,
		Time:      func() time.Time { return now.Add(-2 * time.Hour) },
	})
	require.NoError(t, err)
	data := []byte("plugin bundle")
	backdatedSignature := signDetached(t, entity, crypto.SHA256, now.Add(-time.Hour), data)

	require.NoError(t, verifyBinarySignature(bytes.NewReader(serializePublicKey(t, entity)), bytes.NewReader(data), bytes.NewReader(backdatedSignature)))

	require.NoError(t, entity.RevokeKey(packet.KeyRetired, "retired", &packet.Config{Time: func() time.Time { return now }}))

	err = verifyBinarySignature(bytes.NewReader(serializePublicKey(t, entity)), bytes.NewReader(data), bytes.NewReader(backdatedSignature))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "revoked")
}

func TestVerifyBinarySignatureRejectsWeakKeys(t *testing.T) {
	mainHelper.Parallel(t)

	data := []byte("plugin bundle")

	t.Run("RSA 1024 is rejected", func(t *testing.T) {
		entity, err := openpgp.NewEntity("test", "", "test@example.com", &packet.Config{Algorithm: packet.PubKeyAlgoRSA, RSABits: 1024})
		require.NoError(t, err)
		signature := signDetached(t, entity, crypto.SHA256, time.Now(), data)

		err = verifyBinarySignature(bytes.NewReader(serializePublicKey(t, entity)), bytes.NewReader(data), bytes.NewReader(signature))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "minimum rsa length is 2047 got 1024")
	})

	t.Run("DSA is rejected", func(t *testing.T) {
		var dsaKey dsa.PrivateKey
		require.NoError(t, dsa.GenerateParameters(&dsaKey.Parameters, rand.Reader, dsa.L2048N256))
		require.NoError(t, dsa.GenerateKey(&dsaKey, rand.Reader))
		privateKey := packet.NewDSAPrivateKey(time.Now(), &dsaKey)
		entity := &openpgp.Entity{
			PrimaryKey: &privateKey.PublicKey,
			PrivateKey: privateKey,
			Identities: map[string]*openpgp.Identity{},
		}
		require.NoError(t, entity.AddUserId("test", "", "test@example.com", nil))
		signature := signDetached(t, entity, crypto.SHA256, time.Now(), data)

		err := verifyBinarySignature(bytes.NewReader(serializePublicKey(t, entity)), bytes.NewReader(data), bytes.NewReader(signature))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "public key algorithm")
	})
}
