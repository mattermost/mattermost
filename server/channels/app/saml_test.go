// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
