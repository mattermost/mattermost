package pluginapi

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
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
}

func bToP(b bool) *bool {
	return &b
}
