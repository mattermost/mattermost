// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAnyLicense(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name    string
		license model.SupportPacketLicense
		allowed bool
	}{
		{name: "unlicensed", license: model.SupportPacketLicense{}},
		{name: "packet predates features", license: model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuProfessional}, allowed: true},
		{name: "every feature off", license: model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuProfessional, Features: &model.Features{Cluster: new(false)}}, allowed: true},
		{name: "features without a SKU", license: model.SupportPacketLicense{Features: &model.Features{}}, allowed: true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			allowed, ok := licensedSnapshot(tc.license).LicenseAllows(AnyLicense)
			require.True(t, ok)
			assert.Equal(t, tc.allowed, allowed)
		})
	}
}

func TestAnyFeature(t *testing.T) {
	t.Parallel()

	sso := AnyFeature(FeatureLDAP, FeatureSAML)
	testCases := []struct {
		name     string
		features *model.Features
		allowed  bool
	}{
		{name: "all off", features: &model.Features{LDAP: new(false), SAML: new(false)}},
		{name: "one on", features: &model.Features{LDAP: new(false), SAML: new(true)}, allowed: true},
		{name: "one not recorded", features: &model.Features{LDAP: new(false)}, allowed: true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := licensedSnapshot(model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise, Features: tc.features})
			allowed, ok := s.LicenseAllows(sso)
			require.True(t, ok)
			assert.Equal(t, tc.allowed, allowed)
		})
	}
}
