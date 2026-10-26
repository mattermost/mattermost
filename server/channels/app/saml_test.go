// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"math/big"
	"mime/multipart"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

const (
	testIdpEntityID = "https://idp.example.com/saml"
	testIdpSSOURL   = "https://idp.example.com/sso"
	testIdpCert     = "MIICsDCCAhmgAwIBAgIJAODDg4pFEblaMA0GCSqGSIb3DQEBBQUAME8xCzAJBgNV"
)

func validIDPMetadata(attrs string) string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="` + testIdpEntityID + `"` + attrs + `>
  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>` + testIdpCert + `</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="` + testIdpSSOURL + `"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`
}

func TestBuildSamlMetadataObject(t *testing.T) {
	a := &App{}

	t.Run("minimal valid metadata", func(t *testing.T) {
		data, appErr := a.BuildSamlMetadataObject([]byte(validIDPMetadata("")))
		require.Nil(t, appErr)
		assert.Equal(t, testIdpEntityID, data.IdpDescriptorURL)
		assert.Equal(t, testIdpSSOURL, data.IdpURL)
		assert.Equal(t, testIdpCert, data.IdpPublicCertificate)
	})

	t.Run("cacheDuration on EntityDescriptor", func(t *testing.T) {
		// PingFederate emits cacheDuration="PT1440M" by default (xs:duration).
		data, appErr := a.BuildSamlMetadataObject([]byte(validIDPMetadata(` cacheDuration="PT1440M"`)))
		require.Nil(t, appErr)
		assert.Equal(t, testIdpEntityID, data.IdpDescriptorURL)
		assert.Equal(t, testIdpSSOURL, data.IdpURL)
		assert.Equal(t, testIdpCert, data.IdpPublicCertificate)
	})

	t.Run("cacheDuration on IDPSSODescriptor", func(t *testing.T) {
		xml := `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="` + testIdpEntityID + `">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" cacheDuration="PT1440M">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>` + testIdpCert + `</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="` + testIdpSSOURL + `"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`
		data, appErr := a.BuildSamlMetadataObject([]byte(xml))
		require.Nil(t, appErr)
		assert.Equal(t, testIdpEntityID, data.IdpDescriptorURL)
		assert.Equal(t, testIdpSSOURL, data.IdpURL)
		assert.Equal(t, testIdpCert, data.IdpPublicCertificate)
	})

	t.Run("validUntil without timezone", func(t *testing.T) {
		// xs:dateTime allows values without a timezone; RFC 3339 does not.
		data, appErr := a.BuildSamlMetadataObject([]byte(validIDPMetadata(` validUntil="2027-01-01T00:00:00"`)))
		require.Nil(t, appErr)
		assert.Equal(t, testIdpEntityID, data.IdpDescriptorURL)
		assert.Equal(t, testIdpSSOURL, data.IdpURL)
		assert.Equal(t, testIdpCert, data.IdpPublicCertificate)
	})

	t.Run("missing IDPSSODescriptor", func(t *testing.T) {
		xml := `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://sp.example.com">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"/>
</md:EntityDescriptor>`
		_, appErr := a.BuildSamlMetadataObject([]byte(xml))
		require.NotNil(t, appErr)
		assert.Equal(t, "api.admin.saml.invalid_xml_missing_idpssodescriptors.app_error", appErr.Id)
	})

	t.Run("missing SingleSignOnService", func(t *testing.T) {
		xml := `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="` + testIdpEntityID + `">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>` + testIdpCert + `</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`
		_, appErr := a.BuildSamlMetadataObject([]byte(xml))
		require.NotNil(t, appErr)
		assert.Equal(t, "api.admin.saml.invalid_xml_missing_ssoservices.app_error", appErr.Id)
	})

	t.Run("missing KeyDescriptor", func(t *testing.T) {
		xml := `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="` + testIdpEntityID + `">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="` + testIdpSSOURL + `"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`
		_, appErr := a.BuildSamlMetadataObject([]byte(xml))
		require.NotNil(t, appErr)
		assert.Equal(t, "api.admin.saml.invalid_xml_missing_keydescriptor.app_error", appErr.Id)
	})
}

func registerMockSaml(t *testing.T, configureErr error) *mocks.SamlInterface {
	saml := &mocks.SamlInterface{}
	saml.On("ConfigureSP", mock.AnythingOfType("*request.Context")).Return(configureErr)
	RegisterSamlInterface(func(_ *App) einterfaces.SamlInterface { return saml })
	t.Cleanup(func() { RegisterSamlInterface(nil) })
	return saml
}

func TestReloadSaml(t *testing.T) {
	t.Run("no-op when no SAML interface is registered", func(t *testing.T) {
		a := &App{ch: &Channels{}}
		require.NotPanics(t, func() {
			a.reloadSaml(request.TestContext(t))
		})
	})

	for name, configureErr := range map[string]error{
		"reloads the SP and broadcasts to the cluster":      nil,
		"swallows a ConfigureSP error and still broadcasts": errors.New("partial certificate set"),
	} {
		t.Run(name, func(t *testing.T) {
			saml := registerMockSaml(t, configureErr)

			cluster := &testlib.FakeClusterInterface{}
			th := SetupWithClusterMock(t, cluster)

			// Discard the ConfigureSP calls and cluster messages from startup.
			saml.Calls = nil
			cluster.ClearMessages()

			th.App.reloadSaml(request.TestContext(t))

			saml.AssertNumberOfCalls(t, "ConfigureSP", 1)
			msgs := cluster.SelectMessages(func(m *model.ClusterMessage) bool {
				return m.Event == model.ClusterEventReloadSaml
			})
			require.Len(t, msgs, 1)
			assert.Equal(t, model.ClusterSendReliable, msgs[0].SendType)
			assert.False(t, msgs[0].WaitForAllToSend)
		})
	}

	t.Run("registered cluster handler reconfigures the SP", func(t *testing.T) {
		saml := registerMockSaml(t, nil)

		cluster := &handlerCapturingCluster{handlers: map[model.ClusterEvent]einterfaces.ClusterMessageHandler{}}
		th := SetupWithClusterMock(t, cluster)
		// The test helper doesn't join the cluster, so handlers aren't registered on startup.
		th.Server.registerClusterHandlers()
		saml.Calls = nil

		handler, ok := cluster.handlers[model.ClusterEventReloadSaml]
		require.True(t, ok, "no handler registered for %s", model.ClusterEventReloadSaml)
		handler(&model.ClusterMessage{Event: model.ClusterEventReloadSaml})

		saml.AssertNumberOfCalls(t, "ConfigureSP", 1)
	})
}

type handlerCapturingCluster struct {
	testlib.FakeClusterInterface
	handlers map[model.ClusterEvent]einterfaces.ClusterMessageHandler
}

func (c *handlerCapturingCluster) RegisterClusterMessageHandler(event model.ClusterEvent, h einterfaces.ClusterMessageHandler) {
	c.handlers[event] = h
}

func TestSetSamlIdpCertificateFromMetadata(t *testing.T) {
	t.Run("rejects data that isn't PEM-encodable", func(t *testing.T) {
		a := &App{}
		appErr := a.SetSamlIdpCertificateFromMetadata(request.TestContext(t), []byte("not base64!"))
		require.NotNil(t, appErr)
		assert.Equal(t, "api.admin.saml.failure_parse_idp_certificate.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("rotating the certificate reloads the SP and broadcasts to the cluster", func(t *testing.T) {
		saml := registerMockSaml(t, nil)

		cluster := &testlib.FakeClusterInterface{}
		th := SetupWithClusterMock(t, cluster)
		// A rotation keeps the filename, so the config listener doesn't reconfigure the SP.
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.SamlSettings.IdpCertificateFile = SamlIdpCertificateName })
		saml.Calls = nil
		cluster.ClearMessages()

		appErr := th.App.SetSamlIdpCertificateFromMetadata(request.TestContext(t), []byte(base64.StdEncoding.EncodeToString(testCertificateDER(t))))
		require.Nil(t, appErr)

		saml.AssertNumberOfCalls(t, "ConfigureSP", 1)
		msgs := cluster.SelectMessages(func(m *model.ClusterMessage) bool {
			return m.Event == model.ClusterEventReloadSaml
		})
		assert.Len(t, msgs, 1)
	})
}

func TestAddSamlIdpCertificate(t *testing.T) {
	for name, data := range map[string][]byte{
		"rejects a file that isn't PEM":                []byte("not a certificate"),
		"rejects a PEM block that isn't a certificate": pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: []byte("garbage")}),
	} {
		t.Run(name, func(t *testing.T) {
			a := &App{}
			appErr := a.AddSamlIdpCertificate(request.TestContext(t), samlFileHeader(t, data))
			require.NotNil(t, appErr)
			assert.Equal(t, "api.admin.saml.failure_parse_idp_certificate.app_error", appErr.Id)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		})
	}

	t.Run("stores the certificate, reloads the SP and broadcasts to the cluster", func(t *testing.T) {
		saml := registerMockSaml(t, nil)

		cluster := &testlib.FakeClusterInterface{}
		th := SetupWithClusterMock(t, cluster)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.SamlSettings.IdpCertificateFile = SamlIdpCertificateName })
		saml.Calls = nil
		cluster.ClearMessages()

		certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: testCertificateDER(t)})
		appErr := th.App.AddSamlIdpCertificate(request.TestContext(t), samlFileHeader(t, certPEM))
		require.Nil(t, appErr)

		stored, err := th.App.GetConfigFile(SamlIdpCertificateName)
		require.NoError(t, err)
		assert.Equal(t, certPEM, stored)
		saml.AssertNumberOfCalls(t, "ConfigureSP", 1)
		msgs := cluster.SelectMessages(func(m *model.ClusterMessage) bool {
			return m.Event == model.ClusterEventReloadSaml
		})
		assert.Len(t, msgs, 1)
	})
}

func TestRemoveSamlIdpCertificate(t *testing.T) {
	cluster := &configChangeCapturingCluster{}
	th := SetupWithClusterMock(t, cluster)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.SamlSettings.IdpCertificateFile = SamlIdpCertificateName })
	require.NoError(t, th.App.Srv().platform.SetConfigFile(SamlIdpCertificateName, []byte("certificate")))
	cluster.sent = nil

	require.Nil(t, th.App.RemoveSamlIdpCertificate())

	assert.Empty(t, *th.App.Config().SamlSettings.IdpCertificateFile)
	assert.False(t, *th.App.Config().SamlSettings.Enable)
	assert.Equal(t, []bool{true}, cluster.sent, "the config change should be sent to the other nodes")
}

type configChangeCapturingCluster struct {
	testlib.FakeClusterInterface
	sent []bool
}

func (c *configChangeCapturingCluster) ConfigChanged(_, _ *model.Config, sendToOtherServer bool) *model.AppError {
	c.sent = append(c.sent, sendToOtherServer)
	return nil
}

func testCertificateDER(t *testing.T) []byte {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(time.Hour),
	}
	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	require.NoError(t, err)
	return certDER
}

func samlFileHeader(t *testing.T, data []byte) *multipart.FileHeader {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("certificate", "certificate.crt")
	require.NoError(t, err)
	_, err = part.Write(data)
	require.NoError(t, err)
	require.NoError(t, w.Close())

	form, err := multipart.NewReader(&buf, w.Boundary()).ReadForm(1 << 20)
	require.NoError(t, err)
	t.Cleanup(func() { _ = form.RemoveAll() })
	return form.File["certificate"][0]
}
