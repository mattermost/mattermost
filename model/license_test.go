// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
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
					SharedChannels: NewBool(true),
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
