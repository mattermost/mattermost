// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"math/big"
	"mime/multipart"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	clustermocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func newTestFileHeader(t *testing.T, filename string, data []byte) *multipart.FileHeader {
	t.Helper()

	body := new(bytes.Buffer)
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("certificate", filename)
	require.NoError(t, err)
	_, err = part.Write(data)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	form, err := multipart.NewReader(body, writer.Boundary()).ReadForm(int64(body.Len()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = form.RemoveAll() })

	return form.File["certificate"][0]
}

func newTestCertificateBase64(t *testing.T) []byte {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	template := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "test"}}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	require.NoError(t, err)

	return []byte(base64.StdEncoding.EncodeToString(der))
}

func TestAdminConfigChangesNotifyCluster(t *testing.T) {
	mainHelper.Parallel(t)

	var (
		mut     sync.Mutex
		changes []*model.Config
	)
	clusterMock := &clustermocks.ClusterInterface{}
	clusterMock.On("IsLeader").Return(true).Maybe()
	clusterMock.On("GetClusterId").Return("").Maybe()
	clusterMock.On("SendClusterMessage", mock.Anything).Return().Maybe()
	clusterMock.On("RegisterClusterMessageHandler", mock.Anything, mock.Anything).Return().Maybe()
	clusterMock.On("StopInterNodeCommunication").Return().Maybe()
	clusterMock.On("Shutdown").Return().Maybe()
	clusterMock.On("ConfigChanged", mock.Anything, mock.Anything, mock.Anything).Return(nil).Run(func(args mock.Arguments) {
		if args.Bool(2) {
			mut.Lock()
			defer mut.Unlock()
			changes = append(changes, args.Get(1).(*model.Config))
		}
	}).Maybe()

	th := SetupWithClusterMock(t, clusterMock).InitBasic(t)

	// requireBroadcast runs f and asserts it sent exactly one config change to the cluster, satisfying check.
	requireBroadcast := func(t *testing.T, f func() error, check func(t *testing.T, cfg *model.Config)) {
		t.Helper()

		mut.Lock()
		changes = nil
		mut.Unlock()

		require.NoError(t, f())

		mut.Lock()
		defer mut.Unlock()
		require.Len(t, changes, 1, "expected exactly one config change sent to other cluster nodes")
		check(t, changes[0])
	}

	cert := []byte("certificate")

	t.Run("SAML certificates", func(t *testing.T) {
		requireBroadcast(t, func() error {
			return wrapAppErr(th.App.AddSamlPublicCertificate(newTestFileHeader(t, "public.crt", cert)))
		}, func(t *testing.T, cfg *model.Config) {
			assert.Equal(t, SamlPublicCertificateName, *cfg.SamlSettings.PublicCertificateFile)
		})
		requireBroadcast(t, func() error {
			return wrapAppErr(th.App.AddSamlPrivateCertificate(newTestFileHeader(t, "private.key", cert)))
		}, func(t *testing.T, cfg *model.Config) {
			assert.Equal(t, SamlPrivateKeyName, *cfg.SamlSettings.PrivateKeyFile)
		})
		requireBroadcast(t, func() error { return wrapAppErr(th.App.AddSamlIdpCertificate(newTestFileHeader(t, "idp.crt", cert))) }, func(t *testing.T, cfg *model.Config) {
			assert.Equal(t, SamlIdpCertificateName, *cfg.SamlSettings.IdpCertificateFile)
		})
		requireBroadcast(t, func() error { return wrapAppErr(th.App.SetSamlIdpCertificateFromMetadata(newTestCertificateBase64(t))) }, func(t *testing.T, cfg *model.Config) {
			assert.Equal(t, SamlIdpCertificateName, *cfg.SamlSettings.IdpCertificateFile)
		})
		requireBroadcast(t, func() error { return wrapAppErr(th.App.RemoveSamlPublicCertificate()) }, func(t *testing.T, cfg *model.Config) {
			assert.Empty(t, *cfg.SamlSettings.PublicCertificateFile)
		})
		requireBroadcast(t, func() error { return wrapAppErr(th.App.RemoveSamlPrivateCertificate()) }, func(t *testing.T, cfg *model.Config) {
			assert.Empty(t, *cfg.SamlSettings.PrivateKeyFile)
		})
		requireBroadcast(t, func() error { return wrapAppErr(th.App.RemoveSamlIdpCertificate()) }, func(t *testing.T, cfg *model.Config) {
			assert.Empty(t, *cfg.SamlSettings.IdpCertificateFile)
		})
	})

	t.Run("LDAP certificates", func(t *testing.T) {
		requireBroadcast(t, func() error {
			return wrapAppErr(th.App.AddLdapPublicCertificate(newTestFileHeader(t, "public.crt", cert)))
		}, func(t *testing.T, cfg *model.Config) {
			assert.Equal(t, model.LdapPublicCertificateName, *cfg.LdapSettings.PublicCertificateFile)
		})
		requireBroadcast(t, func() error {
			return wrapAppErr(th.App.AddLdapPrivateCertificate(newTestFileHeader(t, "private.key", cert)))
		}, func(t *testing.T, cfg *model.Config) {
			assert.Equal(t, model.LdapPrivateKeyName, *cfg.LdapSettings.PrivateKeyFile)
		})
		requireBroadcast(t, func() error { return wrapAppErr(th.App.RemoveLdapPublicCertificate()) }, func(t *testing.T, cfg *model.Config) {
			assert.Empty(t, *cfg.LdapSettings.PublicCertificateFile)
		})
		requireBroadcast(t, func() error { return wrapAppErr(th.App.RemoveLdapPrivateCertificate()) }, func(t *testing.T, cfg *model.Config) {
			assert.Empty(t, *cfg.LdapSettings.PrivateKeyFile)
		})
	})

	t.Run("audit log certificate", func(t *testing.T) {
		requireBroadcast(t, func() error {
			return wrapAppErr(th.App.AddAuditLogCertificate(th.Context, newTestFileHeader(t, "audit.crt", cert)))
		}, func(t *testing.T, cfg *model.Config) {
			assert.Equal(t, AuditCertificateFilename, *cfg.ExperimentalAuditSettings.Certificate)
		})
		requireBroadcast(t, func() error { return wrapAppErr(th.App.RemoveAuditLogCertificate(th.Context)) }, func(t *testing.T, cfg *model.Config) {
			assert.Empty(t, *cfg.ExperimentalAuditSettings.Certificate)
		})
	})

	t.Run("delivery tracking", func(t *testing.T) {
		requireBroadcast(t, func() error {
			return th.App.SaveDeliveryTrackingConfig(th.Context, &model.DeliveryTrackingConfig{
				DeliveryTrackingSettings: model.DeliveryTrackingSettings{Enable: model.NewPointer(true), EnableForAllChannels: model.NewPointer(false)},
			})
		}, func(t *testing.T, cfg *model.Config) {
			assert.True(t, *cfg.DeliveryTrackingSettings.Enable)
			assert.False(t, *cfg.DeliveryTrackingSettings.EnableForAllChannels)
		})
	})

	t.Run("content flagging", func(t *testing.T) {
		config := getBaseConfig(th)
		config.EnableContentFlagging = model.NewPointer(true)
		requireBroadcast(t, func() error { return wrapAppErr(th.App.SaveContentFlaggingConfig(config)) }, func(t *testing.T, cfg *model.Config) {
			assert.True(t, *cfg.ContentFlaggingSettings.EnableContentFlagging)
		})
	})
}

// wrapAppErr avoids returning a typed nil *model.AppError as a non-nil error.
func wrapAppErr(appErr *model.AppError) error {
	if appErr == nil {
		return nil
	}
	return appErr
}

func TestSaveContentFlaggingConfigClearsCacheWhenClusterNotifyFails(t *testing.T) {
	mainHelper.Parallel(t)

	var (
		mut         sync.Mutex
		invalidated bool
	)
	clusterMock := &clustermocks.ClusterInterface{}
	clusterMock.On("IsLeader").Return(true).Maybe()
	clusterMock.On("GetClusterId").Return("").Maybe()
	clusterMock.On("SendClusterMessage", mock.Anything).Return().Run(func(args mock.Arguments) {
		if args.Get(0).(*model.ClusterMessage).Event == model.ClusterEventInvalidateCacheForContentFlagging {
			mut.Lock()
			defer mut.Unlock()
			invalidated = true
		}
	}).Maybe()
	clusterMock.On("RegisterClusterMessageHandler", mock.Anything, mock.Anything).Return().Maybe()
	clusterMock.On("StopInterNodeCommunication").Return().Maybe()
	clusterMock.On("Shutdown").Return().Maybe()
	clusterMock.On("ConfigChanged", mock.Anything, mock.Anything, true).Return(model.NewAppError("ConfigChanged", "peer_failed", nil, "", 500)).Maybe()

	th := SetupWithClusterMock(t, clusterMock).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ClusterSettings.Enable = true
	})

	config := getBaseConfig(th)
	config.EnableContentFlagging = model.NewPointer(true)
	appErr := th.App.SaveContentFlaggingConfig(config)
	require.NotNil(t, appErr)
	assert.Equal(t, "peer_failed", appErr.Id)

	mut.Lock()
	defer mut.Unlock()
	assert.True(t, invalidated, "expected the content flagging cache to be invalidated across the cluster")
}
