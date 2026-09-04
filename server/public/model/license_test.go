// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLicenseFeaturesToMap(t *testing.T) {
	f := Features{}
	f.SetDefaults()

	m := f.ToMap()

	CheckTrue(t, m["ldap"].(bool))
	CheckTrue(t, m["ldap_groups"].(bool))
	CheckTrue(t, m["mfa"].(bool))
	CheckTrue(t, m["google"].(bool))
	CheckTrue(t, m["office365"].(bool))
	CheckTrue(t, m["compliance"].(bool))
	CheckTrue(t, m["cluster"].(bool))
	CheckTrue(t, m["metrics"].(bool))
	CheckTrue(t, m["mhpns"].(bool))
	CheckTrue(t, m["saml"].(bool))
	CheckTrue(t, m["elastic_search"].(bool))
	CheckTrue(t, m["email_notification_contents"].(bool))
	CheckTrue(t, m["data_retention"].(bool))
	CheckTrue(t, m["message_export"].(bool))
	CheckTrue(t, m["custom_permissions_schemes"].(bool))
	CheckTrue(t, m["id_loaded"].(bool))
	CheckTrue(t, m["future"].(bool))
	CheckTrue(t, m["shared_channels"].(bool))
	CheckTrue(t, m["remote_cluster_service"].(bool))
}

func TestLicenseFeaturesSetDefaults(t *testing.T) {
	f := Features{}
	f.SetDefaults()

	CheckInt(t, *f.Users, 0)
	CheckTrue(t, *f.LDAP)
	CheckTrue(t, *f.LDAPGroups)
	CheckTrue(t, *f.MFA)
	CheckTrue(t, *f.GoogleOAuth)
	CheckTrue(t, *f.Office365OAuth)
	CheckTrue(t, *f.Compliance)
	CheckTrue(t, *f.Cluster)
	CheckTrue(t, *f.Metrics)
	CheckTrue(t, *f.MHPNS)
	CheckTrue(t, *f.SAML)
	CheckTrue(t, *f.Elasticsearch)
	CheckTrue(t, *f.EmailNotificationContents)
	CheckTrue(t, *f.DataRetention)
	CheckTrue(t, *f.MessageExport)
	CheckTrue(t, *f.CustomPermissionsSchemes)
	CheckTrue(t, *f.GuestAccountsPermissions)
	CheckTrue(t, *f.IDLoadedPushNotifications)
	CheckTrue(t, *f.SharedChannels)
	CheckTrue(t, *f.RemoteClusterService)
	CheckTrue(t, *f.FutureFeatures)

	f = Features{}
	f.SetDefaults()

	*f.Users = 300
	*f.FutureFeatures = false
	*f.LDAP = true
	*f.LDAPGroups = true
	*f.MFA = true
	*f.GoogleOAuth = true
	*f.Office365OAuth = true
	*f.Compliance = true
	*f.Cluster = true
	*f.Metrics = true
	*f.MHPNS = true
	*f.SAML = true
	*f.Elasticsearch = true
	*f.DataRetention = true
	*f.MessageExport = true
	*f.CustomPermissionsSchemes = true
	*f.GuestAccounts = true
	*f.GuestAccountsPermissions = true
	*f.EmailNotificationContents = true
	*f.IDLoadedPushNotifications = true
	*f.SharedChannels = true

	f.SetDefaults()

	CheckInt(t, *f.Users, 300)
	CheckTrue(t, *f.LDAP)
	CheckTrue(t, *f.LDAPGroups)
	CheckTrue(t, *f.MFA)
	CheckTrue(t, *f.GoogleOAuth)
	CheckTrue(t, *f.Office365OAuth)
	CheckTrue(t, *f.Compliance)
	CheckTrue(t, *f.Cluster)
	CheckTrue(t, *f.Metrics)
	CheckTrue(t, *f.MHPNS)
	CheckTrue(t, *f.SAML)
	CheckTrue(t, *f.Elasticsearch)
	CheckTrue(t, *f.EmailNotificationContents)
	CheckTrue(t, *f.DataRetention)
	CheckTrue(t, *f.MessageExport)
	CheckTrue(t, *f.CustomPermissionsSchemes)
	CheckTrue(t, *f.GuestAccounts)
	CheckTrue(t, *f.GuestAccountsPermissions)
	CheckTrue(t, *f.IDLoadedPushNotifications)
	CheckTrue(t, *f.SharedChannels)
	CheckTrue(t, *f.RemoteClusterService)
	CheckFalse(t, *f.FutureFeatures)
}

func TestLicenseIsExpired(t *testing.T) {
	l1 := License{}
	l1.ExpiresAt = GetMillis() - 1000
	assert.True(t, l1.IsExpired())

	l1.ExpiresAt = GetMillis() + 10000
	assert.False(t, l1.IsExpired())
}

func TestLicenseIsPastGracePeriod(t *testing.T) {
	l1 := License{}
	l1.ExpiresAt = GetMillis() - LicenseGracePeriod - 1000
	assert.True(t, l1.IsPastGracePeriod())

	l1.ExpiresAt = GetMillis() + 1000
	assert.False(t, l1.IsPastGracePeriod())
}

func TestLicenseIsStarted(t *testing.T) {
	l1 := License{}
	l1.StartsAt = GetMillis() - 1000

	assert.True(t, l1.IsStarted())

	l1.StartsAt = GetMillis() + 10000
	assert.False(t, l1.IsStarted())
}

func TestIsCloud(t *testing.T) {
	l1 := License{}
	l1.Features = &Features{}
	l1.Features.SetDefaults()
	assert.False(t, l1.IsCloud())

	boolTrue := true
	l1.Features.Cloud = &boolTrue
	assert.True(t, l1.IsCloud())

	var license *License
	assert.False(t, license.IsCloud())

	l1.Features = nil
	assert.False(t, l1.IsCloud())

	t.Run("false if license is nil", func(t *testing.T) {
		var license *License
		assert.False(t, license.IsCloud())
	})
}

func TestLicenseRecordIsValid(t *testing.T) {
	lr := LicenseRecord{
		CreateAt: GetMillis(),
		Bytes:    "asdfghjkl;",
	}

	appErr := lr.IsValid()
	assert.NotNil(t, appErr)

	lr.Id = NewId()
	lr.CreateAt = 0
	appErr = lr.IsValid()
	assert.NotNil(t, appErr)

	lr.CreateAt = GetMillis()
	lr.Bytes = ""
	appErr = lr.IsValid()
	assert.NotNil(t, appErr)

	lr.Bytes = strings.Repeat("0123456789", 1001)
	appErr = lr.IsValid()
	assert.NotNil(t, appErr)

	lr.Bytes = "ASDFGHJKL;"
	appErr = lr.IsValid()
	assert.Nil(t, appErr)
}

func TestLicenseRecordPreSave(t *testing.T) {
	lr := LicenseRecord{}
	lr.PreSave()

	assert.NotZero(t, lr.CreateAt)
}

func TestIsLegacyTrialRequest(t *testing.T) {
	legacyTr := &TrialLicenseRequest{
		Email:         "test@mattermost.com",
		TermsAccepted: true,
		SiteURL:       "https://mattermost.com",
		SiteName:      "Mattermost",
		Users:         100,
	}
	t.Run("legacy trial request", func(t *testing.T) {
		assert.True(t, legacyTr.IsLegacy())
	})

	t.Run("legacy trial request with any non-legacy field set is not a legacy request", func(t *testing.T) {
		legacyTr.CompanyCountry = "US"
		assert.False(t, legacyTr.IsLegacy())
		legacyTr.CompanyCountry = ""
		legacyTr.CompanyName = "test company"
		assert.False(t, legacyTr.IsLegacy())
		legacyTr.CompanyName = ""
		legacyTr.CompanySize = "50-100"
		assert.False(t, legacyTr.IsLegacy())
		legacyTr.CompanySize = ""
		legacyTr.ContactName = "test user"
		assert.False(t, legacyTr.IsLegacy())
		legacyTr.ContactName = ""
		assert.True(t, legacyTr.IsLegacy())
	})
}

func TestTrialLicenseRequestIsValid(t *testing.T) {
	validTlr := &TrialLicenseRequest{
		Email:          "test@test.com",
		Users:          100,
		CompanyCountry: "US",
		CompanyName:    "Test Company",
		CompanySize:    "50-100",
		ContactName:    "Test User",
		TermsAccepted:  true,
	}

	resetBaseRequest := func() {
		validTlr = &TrialLicenseRequest{
			Email:          "test@test.com",
			Users:          100,
			CompanyCountry: "US",
			CompanyName:    "Test Company",
			CompanySize:    "50-100",
			ContactName:    "Test User",
			TermsAccepted:  true,
		}
	}
	t.Run("valid request", func(t *testing.T) {
		resetBaseRequest()
		assert.Equal(t, true, validTlr.IsValid())
	})

	t.Run("no terms", func(t *testing.T) {
		resetBaseRequest()
		validTlr.TermsAccepted = false
		assert.Equal(t, false, validTlr.IsValid())
	})

	t.Run("no email", func(t *testing.T) {
		resetBaseRequest()
		validTlr.Email = ""
		assert.Equal(t, false, validTlr.IsValid())
	})

	t.Run("no CompanyCountry", func(t *testing.T) {
		resetBaseRequest()
		validTlr.CompanyCountry = ""
		assert.Equal(t, false, validTlr.IsValid())
	})

	t.Run("no CompanyName", func(t *testing.T) {
		resetBaseRequest()
		validTlr.CompanyName = ""
		assert.Equal(t, false, validTlr.IsValid())
	})

	t.Run("no CompanySize", func(t *testing.T) {
		resetBaseRequest()
		validTlr.CompanySize = ""
		assert.Equal(t, false, validTlr.IsValid())
	})

	t.Run("Bad User Count", func(t *testing.T) {
		resetBaseRequest()
		validTlr.Users = 0
		assert.Equal(t, false, validTlr.IsValid())
	})
}

func TestLicense_IsTrialLicense(t *testing.T) {
	t.Run("detect trial license directly from the flag", func(t *testing.T) {
		license := &License{
			IsTrial: true,
		}
		assert.True(t, license.IsTrial)

		license.IsTrial = false
		assert.False(t, license.IsTrialLicense())
	})

	t.Run("detect trial license form duration", func(t *testing.T) {
		startDate, err := time.Parse(time.RFC822, "01 Jan 21 00:00 UTC")
		assert.NoError(t, err)

		endDate, err := time.Parse(time.RFC822, "31 Jan 21 08:00 UTC")
		assert.NoError(t, err)

		license := &License{
			StartsAt:  startDate.UnixNano() / int64(time.Millisecond),
			ExpiresAt: endDate.UnixNano() / int64(time.Millisecond),
		}
		assert.True(t, license.IsTrialLicense())

		endDate, err = time.Parse(time.RFC822, "01 Feb 21 08:00 UTC")
		assert.NoError(t, err)

		license.ExpiresAt = endDate.UnixNano() / int64(time.Millisecond)
		assert.False(t, license.IsTrialLicense())

		// 30 days + 23 hours 59 mins 59 seconds
		endDate, err = time.Parse("02 Jan 06 15:04:05 MST", "31 Jan 21 23:59:59 UTC")
		assert.NoError(t, err)
		license.ExpiresAt = endDate.UnixNano() / int64(time.Millisecond)
		assert.True(t, license.IsTrialLicense())
	})

	t.Run("detect trial with both flag and duration", func(t *testing.T) {
		startDate, err := time.Parse(time.RFC822, "01 Jan 21 00:00 UTC")
		assert.NoError(t, err)

		endDate, err := time.Parse(time.RFC822, "31 Jan 21 08:00 UTC")
		assert.NoError(t, err)

		license := &License{
			IsTrial:   true,
			StartsAt:  startDate.UnixNano() / int64(time.Millisecond),
			ExpiresAt: endDate.UnixNano() / int64(time.Millisecond),
		}

		assert.True(t, license.IsTrialLicense())
		license.IsTrial = false

		// detecting trial from duration
		assert.True(t, license.IsTrialLicense())

		endDate, _ = time.Parse(time.RFC822, "1 Feb 2021 08:00 UTC")
		license.ExpiresAt = endDate.UnixNano() / int64(time.Millisecond)
		assert.False(t, license.IsTrialLicense())

		license.IsTrial = true
		assert.True(t, license.IsTrialLicense())
	})
}

func TestLicense_IsSanctionedTrial(t *testing.T) {
	t.Run("short duration sanctioned trial", func(t *testing.T) {
		startDate, err := time.Parse(time.RFC822, "01 Jan 21 00:00 UTC")
		assert.NoError(t, err)

		endDate, err := time.Parse(time.RFC822, "08 Jan 21 08:00 UTC")
		assert.NoError(t, err)

		license := &License{
			IsTrial:   true,
			StartsAt:  startDate.UnixNano() / int64(time.Millisecond),
			ExpiresAt: endDate.UnixNano() / int64(time.Millisecond),
		}

		assert.True(t, license.IsSanctionedTrial())

		license.IsTrial = false
		assert.False(t, license.IsSanctionedTrial())
	})

	t.Run("long duration sanctioned trial", func(t *testing.T) {
		startDate, err := time.Parse(time.RFC822, "01 Jan 21 00:00 UTC")
		assert.NoError(t, err)

		endDate, err := time.Parse(time.RFC822, "02 Feb 21 08:00 UTC")
		assert.NoError(t, err)

		license := &License{
			IsTrial:   true,
			StartsAt:  startDate.UnixNano() / int64(time.Millisecond),
			ExpiresAt: endDate.UnixNano() / int64(time.Millisecond),
		}

		assert.True(t, license.IsSanctionedTrial())

		license.IsTrial = false
		assert.False(t, license.IsSanctionedTrial())
	})

	t.Run("invalid duration for sanctioned trial", func(t *testing.T) {
		startDate, err := time.Parse(time.RFC822, "01 Jan 21 00:00 UTC")
		assert.NoError(t, err)

		endDate, err := time.Parse(time.RFC822, "31 Jan 21 08:00 UTC")
		assert.NoError(t, err)

		license := &License{
			IsTrial:   true,
			StartsAt:  startDate.UnixNano() / int64(time.Millisecond),
			ExpiresAt: endDate.UnixNano() / int64(time.Millisecond),
		}

		assert.False(t, license.IsSanctionedTrial())
	})

	t.Run("boundary conditions for sanctioned trial", func(t *testing.T) {
		startDate, err := time.Parse(time.RFC822, "01 Jan 21 00:00 UTC")
		assert.NoError(t, err)

		// 29 days + 23 hours 59 mins 59 seconds
		endDate, err := time.Parse("02 Jan 06 15:04:05 MST", "30 Jan 21 23:59:59 UTC")
		assert.NoError(t, err)

		license := &License{
			IsTrial:   true,
			StartsAt:  startDate.UnixNano() / int64(time.Millisecond),
			ExpiresAt: endDate.UnixNano() / int64(time.Millisecond),
		}

		assert.True(t, license.IsSanctionedTrial())

		// 31 days + 23 hours 59 mins 59 seconds
		endDate, err = time.Parse("02 Jan 06 15:04:05 MST", "01 Feb 21 23:59:59 UTC")
		assert.NoError(t, err)
		license.ExpiresAt = endDate.UnixNano() / int64(time.Millisecond)
		assert.True(t, license.IsSanctionedTrial())
	})
}

func TestLicenseHasSharedChannels(t *testing.T) {
	testCases := []struct {
		description   string
		license       License
		expectedValue bool
	}{
		{
			"licensed for shared channels",
			License{
				Features: &Features{
					SharedChannels: new(true),
				},
				SkuShortName: "other",
			},
			true,
		},
		{
			"not licensed for shared channels",
			License{
				Features:     &Features{},
				SkuShortName: "other",
			},
			false,
		},
		{
			"professional license for shared channels",
			License{
				Features:     &Features{},
				SkuShortName: LicenseShortSkuProfessional,
			},
			true,
		},
		{
			"enterprise license for shared channels",
			License{
				Features:     &Features{},
				SkuShortName: LicenseShortSkuEnterprise,
			},
			true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			assert.Equal(t, testCase.expectedValue, testCase.license.HasSharedChannels())
		})
	}
}

func TestLicenseHasMHPNS(t *testing.T) {
	testCases := []struct {
		description   string
		license       *License
		expectedValue bool
	}{
		{
			"nil license",
			nil,
			false,
		},
		{
			"nil features",
			&License{},
			false,
		},
		{
			"nil MHPNS feature",
			&License{
				Features: &Features{},
			},
			false,
		},
		{
			"MHPNS feature disabled",
			&License{
				Features: &Features{
					MHPNS: new(false),
				},
			},
			false,
		},
		{
			"MHPNS feature enabled",
			&License{
				Features: &Features{
					MHPNS: new(true),
				},
			},
			true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			assert.Equal(t, testCase.expectedValue, testCase.license.HasMHPNS())
		})
	}
}

func TestLicenseHasAddOn(t *testing.T) {
	testCases := []struct {
		description   string
		license       *License
		addOn         string
		expectedValue bool
	}{
		{
			"nil license",
			nil,
			AddOnCrossGuard,
			false,
		},
		{
			"nil add-ons slice",
			&License{},
			AddOnCrossGuard,
			false,
		},
		{
			"empty add-ons slice",
			&License{AddOns: []string{}},
			AddOnCrossGuard,
			false,
		},
		{
			"different add-on granted",
			&License{AddOns: []string{"something-else"}},
			AddOnCrossGuard,
			false,
		},
		{
			"exact match",
			&License{AddOns: []string{AddOnCrossGuard}},
			AddOnCrossGuard,
			true,
		},
		{
			"match among several",
			&License{AddOns: []string{"something-else", AddOnCrossGuard, "another"}},
			AddOnCrossGuard,
			true,
		},
		{
			"case-insensitive match",
			&License{AddOns: []string{"CrossGuard"}},
			AddOnCrossGuard,
			true,
		},
		{
			// A prefix must not satisfy the entitlement, or a future
			// "crossguard-premium" add-on would silently unlock "crossguard".
			"longer name is not a match",
			&License{AddOns: []string{"crossguard-premium"}},
			AddOnCrossGuard,
			false,
		},
		{
			"shorter name is not a match",
			&License{AddOns: []string{"cross"}},
			AddOnCrossGuard,
			false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			assert.Equal(t, testCase.expectedValue, testCase.license.HasAddOn(testCase.addOn))
		})
	}
}

func TestLicenseAddOnsJSON(t *testing.T) {
	t.Run("round trips", func(t *testing.T) {
		var license License
		err := json.Unmarshal([]byte(`{"add_ons": ["crossguard"]}`), &license)
		require.NoError(t, err)
		assert.Equal(t, []string{"crossguard"}, license.AddOns)
		assert.True(t, license.HasAddOn(AddOnCrossGuard))
	})

	t.Run("absent key yields no add-ons", func(t *testing.T) {
		var license License
		err := json.Unmarshal([]byte(`{"sku_short_name": "advanced"}`), &license)
		require.NoError(t, err)
		assert.Nil(t, license.AddOns)
		assert.False(t, license.HasAddOn(AddOnCrossGuard))
	})

	t.Run("unrecognized add-on is ignored, not rejected", func(t *testing.T) {
		// Forward compatibility: a license issued for an add-on this build does not
		// know about must still validate, otherwise every new add-on would require a
		// server upgrade before any license naming it could be uploaded.
		var license License
		err := json.Unmarshal([]byte(`{"add_ons": ["not-a-real-addon"]}`), &license)
		require.NoError(t, err)
		assert.False(t, license.HasAddOn(AddOnCrossGuard))
	})

	t.Run("NewTestLicenseWithAddOns grants the add-on", func(t *testing.T) {
		license := NewTestLicenseWithAddOns(AddOnCrossGuard)
		assert.True(t, license.HasAddOn(AddOnCrossGuard))
		assert.False(t, license.HasAddOn("another"))

		assert.False(t, NewTestLicense().HasAddOn(AddOnCrossGuard))
	})
}

func TestPluginAddOnRequirements(t *testing.T) {
	for pluginID, addOn := range PluginAddOnRequirements {
		t.Run(pluginID, func(t *testing.T) {
			assert.True(t, IsValidPluginId(pluginID), "plugin id must be valid")
			assert.NotEmpty(t, addOn, "add-on name must not be empty")
			assert.Equal(t, strings.ToLower(addOn), addOn, "add-on name should be lower case for consistency")
		})
	}

	t.Run("crossguard is registered", func(t *testing.T) {
		assert.Equal(t, AddOnCrossGuard, PluginAddOnRequirements[PluginIdCrossGuard])
	})
}

func TestMinimumProfessionalLicense(t *testing.T) {
	testCases := []struct {
		description   string
		license       *License
		expectedValue bool
	}{
		{
			"nil license",
			nil,
			false,
		},
		{
			"professional license",
			&License{
				SkuShortName: LicenseShortSkuProfessional,
			},
			true,
		},
		{
			"enterprise license",
			&License{
				SkuShortName: LicenseShortSkuEnterprise,
			},
			true,
		},
		{
			"enterprise advanced license",
			&License{
				SkuShortName: LicenseShortSkuEnterpriseAdvanced,
			},
			true,
		},
		{
			"E10 license",
			&License{
				SkuShortName: LicenseShortSkuE10,
			},
			false,
		},
		{
			"E20 license",
			&License{
				SkuShortName: LicenseShortSkuE20,
			},
			false,
		},
		{
			"unknown license",
			&License{
				SkuShortName: "unknown",
			},
			false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			assert.Equal(t, testCase.expectedValue, MinimumProfessionalLicense(testCase.license))
		})
	}
}

func TestMinimumEnterpriseLicense(t *testing.T) {
	testCases := []struct {
		description   string
		license       *License
		expectedValue bool
	}{
		{
			"nil license",
			nil,
			false,
		},
		{
			"professional license",
			&License{
				SkuShortName: LicenseShortSkuProfessional,
			},
			false,
		},
		{
			"enterprise license",
			&License{
				SkuShortName: LicenseShortSkuEnterprise,
			},
			true,
		},
		{
			"enterprise advanced license",
			&License{
				SkuShortName: LicenseShortSkuEnterpriseAdvanced,
			},
			true,
		},
		{
			"E10 license",
			&License{
				SkuShortName: LicenseShortSkuE10,
			},
			false,
		},
		{
			"E20 license",
			&License{
				SkuShortName: LicenseShortSkuE20,
			},
			false,
		},
		{
			"unknown license",
			&License{
				SkuShortName: "unknown",
			},
			false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			assert.Equal(t, testCase.expectedValue, MinimumEnterpriseLicense(testCase.license))
		})
	}
}

func TestMinimumEnterpriseAdvancedLicense(t *testing.T) {
	testCases := []struct {
		description   string
		license       *License
		expectedValue bool
	}{
		{
			"nil license",
			nil,
			false,
		},
		{
			"professional license",
			&License{
				SkuShortName: LicenseShortSkuProfessional,
			},
			false,
		},
		{
			"enterprise license",
			&License{
				SkuShortName: LicenseShortSkuEnterprise,
			},
			false,
		},
		{
			"enterprise advanced license",
			&License{
				SkuShortName: LicenseShortSkuEnterpriseAdvanced,
			},
			true,
		},
		{
			"E10 license",
			&License{
				SkuShortName: LicenseShortSkuE10,
			},
			false,
		},
		{
			"E20 license",
			&License{
				SkuShortName: LicenseShortSkuE20,
			},
			false,
		},
		{
			"unknown license",
			&License{
				SkuShortName: "unknown",
			},
			false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			assert.Equal(t, testCase.expectedValue, MinimumEnterpriseAdvancedLicense(testCase.license))
		})
	}
}
