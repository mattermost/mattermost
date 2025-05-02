package pluginapi

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestIsEnterpriseLicensedOrDevelopment(t *testing.T) {
	t.Run("license, no config", func(t *testing.T) {
		assert.True(t, IsEnterpriseLicensedOrDevelopment(nil, &model.License{}))
	})

	t.Run("license, nil config", func(t *testing.T) {
		assert.True(t, IsEnterpriseLicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: nil, EnableTesting: nil}},
			&model.License{},
		))
	})

	t.Run("no license, no config", func(t *testing.T) {
		assert.False(t, IsEnterpriseLicensedOrDevelopment(nil, nil))
	})

	t.Run("no license, nil config", func(t *testing.T) {
		assert.False(t, IsEnterpriseLicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: nil, EnableTesting: nil}},
			nil,
		))
	})

	t.Run("no license, only developer mode", func(t *testing.T) {
		assert.False(t, IsEnterpriseLicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(false)}},
			nil,
		))
	})

	t.Run("no license, only testing mode", func(t *testing.T) {
		assert.False(t, IsEnterpriseLicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(false), EnableTesting: bToP(true)}},
			nil,
		))
	})

	t.Run("no license, developer and testing mode", func(t *testing.T) {
		assert.True(t, IsEnterpriseLicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(true)}},
			nil,
		))
	})
}

func TestIsE20LicensedOrDevelopment(t *testing.T) {
	t.Run("nil license features", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(nil, &model.License{}))
	})

	t.Run("nil future features", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(nil, &model.License{Features: &model.Features{}}))
	})

	t.Run("disabled future features", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(nil, &model.License{Features: &model.Features{
			FutureFeatures: bToP(false),
		}}))
	})

	t.Run("enabled future features", func(t *testing.T) {
		assert.True(t, IsE20LicensedOrDevelopment(nil, &model.License{Features: &model.Features{
			FutureFeatures: bToP(true),
		}}))
	})

	t.Run("no license, no config", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(nil, nil))
	})

	t.Run("no license, nil config", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: nil, EnableTesting: nil}},
			nil,
		))
	})

	t.Run("no license, only developer mode", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(false)}},
			nil,
		))
	})

	t.Run("no license, only testing mode", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(false), EnableTesting: bToP(true)}},
			nil,
		))
	})

	t.Run("no license, developer and testing mode", func(t *testing.T) {
		assert.True(t, IsE20LicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(true)}},
			nil,
		))
	})

	t.Run("license with E10 SKU name, disabled future features", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "E10",
			Features:     &model.Features{FutureFeatures: bToP(false)},
		}))
	})

	t.Run("license with E10 SKU name, enabled future features", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "E10",
			Features:     &model.Features{FutureFeatures: bToP(true)},
		}))
	})

	t.Run("license with professional SKU name, disabled future features", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "professional",
			Features:     &model.Features{FutureFeatures: bToP(false)},
		}))
	})

	t.Run("license with professional SKU name, enabled future features", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "professional",
			Features:     &model.Features{FutureFeatures: bToP(true)},
		}))
	})

	t.Run("license with enterprise SKU name, disabled future features", func(t *testing.T) {
		assert.True(t, IsE20LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "enterprise",
			Features:     &model.Features{FutureFeatures: bToP(false)},
		}))
	})

	t.Run("license with enterprise SKU name, enabled future features", func(t *testing.T) {
		assert.True(t, IsE20LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "enterprise",
			Features:     &model.Features{FutureFeatures: bToP(true)},
		}))
	})

	t.Run("license with unknown SKU name, disabled future features", func(t *testing.T) {
		assert.False(t, IsE20LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "unknown",
			Features:     &model.Features{FutureFeatures: bToP(false)},
		}))
	})

	t.Run("license with unknown SKU name, enabled future features", func(t *testing.T) {
		assert.True(t, IsE20LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "unknown",
			Features:     &model.Features{FutureFeatures: bToP(true)},
		}))
	})
}

func TestIsE10LicensedOrDevelopment(t *testing.T) {
	t.Run("nil license features", func(t *testing.T) {
		assert.False(t, IsE10LicensedOrDevelopment(nil, &model.License{}))
	})

	t.Run("nil future features", func(t *testing.T) {
		assert.False(t, IsE10LicensedOrDevelopment(nil, &model.License{Features: &model.Features{}}))
	})

	t.Run("disabled LDAP", func(t *testing.T) {
		assert.False(t, IsE10LicensedOrDevelopment(nil, &model.License{Features: &model.Features{
			LDAP: bToP(false),
		}}))
	})

	t.Run("enabled LDAP", func(t *testing.T) {
		assert.True(t, IsE10LicensedOrDevelopment(nil, &model.License{Features: &model.Features{
			LDAP: bToP(true),
		}}))
	})

	t.Run("no license, no config", func(t *testing.T) {
		assert.False(t, IsE10LicensedOrDevelopment(nil, nil))
	})

	t.Run("no license, nil config", func(t *testing.T) {
		assert.False(t, IsE10LicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: nil, EnableTesting: nil}},
			nil,
		))
	})

	t.Run("no license, only developer mode", func(t *testing.T) {
		assert.False(t, IsE10LicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(false)}},
			nil,
		))
	})

	t.Run("no license, only testing mode", func(t *testing.T) {
		assert.False(t, IsE10LicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(false), EnableTesting: bToP(true)}},
			nil,
		))
	})

	t.Run("no license, developer and testing mode", func(t *testing.T) {
		assert.True(t, IsE10LicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(true)}},
			nil,
		))
	})

	t.Run("license with professional SKU name, disabled LDAP", func(t *testing.T) {
		assert.True(t, IsE10LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "professional",
			Features:     &model.Features{LDAP: bToP(false)},
		}))
	})

	t.Run("license with professional SKU name, enabled LDAP", func(t *testing.T) {
		assert.True(t, IsE10LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "professional",
			Features:     &model.Features{LDAP: bToP(true)},
		}))
	})

	t.Run("license with enterprise SKU name, disabled LDAP", func(t *testing.T) {
		assert.True(t, IsE10LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "enterprise",
			Features:     &model.Features{LDAP: bToP(false)},
		}))
	})

	t.Run("license with enterprise SKU name, enabled LDAP", func(t *testing.T) {
		assert.True(t, IsE10LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "enterprise",
			Features:     &model.Features{LDAP: bToP(true)},
		}))
	})

	t.Run("license with unknown SKU name, disabled LDAP", func(t *testing.T) {
		assert.False(t, IsE10LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "unknown",
			Features:     &model.Features{LDAP: bToP(false)},
		}))
	})

	t.Run("license with unknown SKU name, enabled LDAP", func(t *testing.T) {
		assert.True(t, IsE10LicensedOrDevelopment(nil, &model.License{
			SkuShortName: "unknown",
			Features:     &model.Features{LDAP: bToP(true)},
		}))
	})
}

func TestIsValidSKUShortName(t *testing.T) {
	t.Run("nil license", func(t *testing.T) {
		assert.False(t, isValidSkuShortName(nil))
	})

	t.Run("license with valid E10 SKU name", func(t *testing.T) {
		assert.True(t, isValidSkuShortName(&model.License{SkuShortName: "E10"}))
	})

	t.Run("license with valid E20 SKU name", func(t *testing.T) {
		assert.True(t, isValidSkuShortName(&model.License{SkuShortName: "E20"}))
	})

	t.Run("license with valid professional SKU name", func(t *testing.T) {
		assert.True(t, isValidSkuShortName(&model.License{SkuShortName: "professional"}))
	})

	t.Run("license with valid enterprise SKU name", func(t *testing.T) {
		assert.True(t, isValidSkuShortName(&model.License{SkuShortName: "enterprise"}))
	})

	t.Run("license with invalid SKU name", func(t *testing.T) {
		assert.False(t, isValidSkuShortName(&model.License{SkuShortName: "invalid"}))
	})
}

func TestIsEnterpriseAdvancedOrDevelopment(t *testing.T) {
	t.Run("nil license features", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(nil, &model.License{}))
	})

	t.Run("nil future features", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(nil, &model.License{Features: &model.Features{}}))
	})

	t.Run("disabled future features", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(nil, &model.License{Features: &model.Features{
			FutureFeatures: bToP(false),
		}}))
	})

	t.Run("should have no affect of future features", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(nil, &model.License{Features: &model.Features{
			FutureFeatures: bToP(true),
		}}))
	})

	t.Run("no license, no config", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(nil, nil))
	})

	t.Run("no license, nil config", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: nil, EnableTesting: nil}},
			nil,
		))
	})

	t.Run("no license, only developer mode", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(false)}},
			nil,
		))
	})

	t.Run("no license, only testing mode", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(false), EnableTesting: bToP(true)}},
			nil,
		))
	})

	t.Run("no license, developer and testing mode", func(t *testing.T) {
		assert.True(t, IsEnterpriseAdvancedLicensedOrDevelopment(
			&model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: bToP(true), EnableTesting: bToP(true)}},
			nil,
		))
	})

	t.Run("license with E10 SKU name, disabled future features", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(nil, &model.License{
			SkuShortName: "E10",
			Features:     &model.Features{FutureFeatures: bToP(false)},
		}))
	})

	t.Run("license with E10 SKU name, enabled future features", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(nil, &model.License{
			SkuShortName: "E10",
			Features:     &model.Features{FutureFeatures: bToP(true)},
		}))
	})

	t.Run("license with E20 SKU name, disabled future features", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(nil, &model.License{
			SkuShortName: "E20",
			Features:     &model.Features{FutureFeatures: bToP(false)},
		}))
	})

	t.Run("license with E20 SKU name, enabled future features", func(t *testing.T) {
		assert.False(t, IsEnterpriseAdvancedLicensedOrDevelopment(nil, &model.License{
			SkuShortName: "E20",
			Features:     &model.Features{FutureFeatures: bToP(true)},
		}))
	})
}

func bToP(b bool) *bool {
	return &b
}
