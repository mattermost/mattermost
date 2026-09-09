// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCheckLdapTestBindPassword(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.LdapSettings.LdapServer = model.NewPointer("ldap.example.com")
		cfg.LdapSettings.LdapPort = model.NewPointer(389)
		cfg.LdapSettings.ConnectionSecurity = model.NewPointer("TLS")
		cfg.LdapSettings.SkipCertificateVerification = model.NewPointer(false)
		cfg.LdapSettings.BindUsername = model.NewPointer("cn=admin,dc=example,dc=com")
		cfg.LdapSettings.BindPassword = model.NewPointer("saved-password")
	})

	savedSettings := func() model.LdapSettings {
		return model.LdapSettings{
			LdapServer:                  model.NewPointer("ldap.example.com"),
			LdapPort:                    model.NewPointer(389),
			ConnectionSecurity:          model.NewPointer("TLS"),
			SkipCertificateVerification: model.NewPointer(false),
			BindUsername:                model.NewPointer("cn=admin,dc=example,dc=com"),
			BindPassword:                model.NewPointer(""),
		}
	}

	t.Run("no connection setting changed and no password submitted", func(t *testing.T) {
		require.Nil(t, th.App.checkLdapTestBindPassword("TestLdapConnection", savedSettings()))
	})

	t.Run("no connection setting changed and masked password submitted", func(t *testing.T) {
		settings := savedSettings()
		settings.BindPassword = model.NewPointer(model.FakeSetting)
		require.Nil(t, th.App.checkLdapTestBindPassword("TestLdapConnection", settings))
	})

	t.Run("connection settings omitted entirely", func(t *testing.T) {
		require.Nil(t, th.App.checkLdapTestBindPassword("TestLdapConnection", model.LdapSettings{}))
	})

	t.Run("only skip certificate verification changed and no password submitted", func(t *testing.T) {
		settings := savedSettings()
		settings.SkipCertificateVerification = model.NewPointer(true)

		require.Nil(t, th.App.checkLdapTestBindPassword("TestLdapConnection", settings))
	})

	t.Run("only skip certificate verification changed and masked password submitted", func(t *testing.T) {
		settings := savedSettings()
		settings.SkipCertificateVerification = model.NewPointer(true)
		settings.BindPassword = model.NewPointer(model.FakeSetting)

		require.Nil(t, th.App.checkLdapTestBindPassword("TestLdapConnection", settings))
	})

	t.Run("skip certificate verification submitted as false while connection security is empty", func(t *testing.T) {
		th2 := Setup(t)

		th2.App.UpdateConfig(func(cfg *model.Config) {
			cfg.LdapSettings.LdapServer = model.NewPointer("ldap.example.com")
			cfg.LdapSettings.LdapPort = model.NewPointer(389)
			cfg.LdapSettings.ConnectionSecurity = model.NewPointer("")
			cfg.LdapSettings.SkipCertificateVerification = model.NewPointer(true)
			cfg.LdapSettings.BindUsername = model.NewPointer("cn=admin,dc=example,dc=com")
			cfg.LdapSettings.BindPassword = model.NewPointer("saved-password")
		})

		settings := model.LdapSettings{
			LdapServer:                  model.NewPointer("ldap.example.com"),
			LdapPort:                    model.NewPointer(389),
			ConnectionSecurity:          model.NewPointer(""),
			SkipCertificateVerification: model.NewPointer(false),
			BindUsername:                model.NewPointer("cn=admin,dc=example,dc=com"),
			BindPassword:                model.NewPointer(model.FakeSetting),
		}

		require.Nil(t, th2.App.checkLdapTestBindPassword("TestLdapConnection", settings))

		settings.LdapServer = model.NewPointer("attacker.example.com")
		appErr := th2.App.checkLdapTestBindPassword("TestLdapConnection", settings)
		require.NotNil(t, appErr)
		require.Equal(t, "api.ldap.test.reenter_password", appErr.Id)
	})

	t.Run("no saved bind password", func(t *testing.T) {
		th2 := Setup(t)

		th2.App.UpdateConfig(func(cfg *model.Config) {
			cfg.LdapSettings.LdapServer = model.NewPointer("")
			cfg.LdapSettings.BindPassword = model.NewPointer("")
		})

		settings := savedSettings()
		settings.LdapServer = model.NewPointer("attacker.example.com")
		require.Nil(t, th2.App.checkLdapTestBindPassword("TestLdapConnection", settings))
	})

	changedCases := map[string]func(settings *model.LdapSettings){
		"server changed": func(settings *model.LdapSettings) {
			settings.LdapServer = model.NewPointer("attacker.example.com")
		},
		"port changed": func(settings *model.LdapSettings) {
			settings.LdapPort = model.NewPointer(1389)
		},
		"connection security changed": func(settings *model.LdapSettings) {
			settings.ConnectionSecurity = model.NewPointer("")
		},
		"bind username changed": func(settings *model.LdapSettings) {
			settings.BindUsername = model.NewPointer("cn=other,dc=example,dc=com")
		},
	}

	for name, mutate := range changedCases {
		t.Run(name+" without a submitted password", func(t *testing.T) {
			settings := savedSettings()
			mutate(&settings)

			appErr := th.App.checkLdapTestBindPassword("TestLdapConnection", settings)
			require.NotNil(t, appErr)
			require.Equal(t, "api.ldap.test.reenter_password", appErr.Id)
			require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		})

		t.Run(name+" with a masked password", func(t *testing.T) {
			settings := savedSettings()
			mutate(&settings)
			settings.BindPassword = model.NewPointer(model.FakeSetting)

			appErr := th.App.checkLdapTestBindPassword("TestLdapConnection", settings)
			require.NotNil(t, appErr)
			require.Equal(t, "api.ldap.test.reenter_password", appErr.Id)
		})

		t.Run(name+" with a re-entered password", func(t *testing.T) {
			settings := savedSettings()
			mutate(&settings)
			settings.BindPassword = model.NewPointer("new-password")

			require.Nil(t, th.App.checkLdapTestBindPassword("TestLdapConnection", settings))
		})
	}
}

func TestTestLdapConnectionBindPasswordGuard(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.LdapSettings.LdapServer = model.NewPointer("ldap.example.com")
		cfg.LdapSettings.LdapPort = model.NewPointer(389)
		cfg.LdapSettings.BindUsername = model.NewPointer("cn=admin,dc=example,dc=com")
		cfg.LdapSettings.BindPassword = model.NewPointer("saved-password")
	})

	t.Run("rejects reusing the saved password against another server", func(t *testing.T) {
		settings := model.LdapSettings{
			LdapServer: model.NewPointer("attacker.example.com"),
			LdapPort:   model.NewPointer(389),
		}

		appErr := th.App.TestLdapConnection(th.Context, settings)
		require.NotNil(t, appErr)
		require.Equal(t, "api.ldap.test.reenter_password", appErr.Id)

		_, appErr = th.App.TestLdapDiagnostics(th.Context, model.LdapDiagnosticTestTypeFilters, settings)
		require.NotNil(t, appErr)
		require.Equal(t, "api.ldap.test.reenter_password", appErr.Id)
	})

	t.Run("passes the guard when nothing connection relevant changed", func(t *testing.T) {
		settings := model.LdapSettings{
			LdapServer:   model.NewPointer("ldap.example.com"),
			LdapPort:     model.NewPointer(389),
			BindUsername: model.NewPointer("cn=admin,dc=example,dc=com"),
			BindPassword: model.NewPointer(model.FakeSetting),
		}

		appErr := th.App.TestLdapConnection(th.Context, settings)
		require.NotNil(t, appErr)
		require.NotEqual(t, "api.ldap.test.reenter_password", appErr.Id)

		_, appErr = th.App.TestLdapDiagnostics(th.Context, model.LdapDiagnosticTestTypeFilters, settings)
		require.NotNil(t, appErr)
		require.NotEqual(t, "api.ldap.test.reenter_password", appErr.Id)
	})

	t.Run("passes the guard when only skip certificate verification changed", func(t *testing.T) {
		settings := model.LdapSettings{
			LdapServer:                  model.NewPointer("ldap.example.com"),
			LdapPort:                    model.NewPointer(389),
			BindUsername:                model.NewPointer("cn=admin,dc=example,dc=com"),
			SkipCertificateVerification: model.NewPointer(!model.SafeDereference(th.App.Config().LdapSettings.SkipCertificateVerification)),
			BindPassword:                model.NewPointer(model.FakeSetting),
		}

		appErr := th.App.TestLdapConnection(th.Context, settings)
		require.NotNil(t, appErr)
		require.NotEqual(t, "api.ldap.test.reenter_password", appErr.Id)

		_, appErr = th.App.TestLdapDiagnostics(th.Context, model.LdapDiagnosticTestTypeFilters, settings)
		require.NotNil(t, appErr)
		require.NotEqual(t, "api.ldap.test.reenter_password", appErr.Id)
	})

	t.Run("allows testing a new server with a re-entered password", func(t *testing.T) {
		settings := model.LdapSettings{
			LdapServer:   model.NewPointer("other.example.com"),
			LdapPort:     model.NewPointer(389),
			BindUsername: model.NewPointer("cn=admin,dc=example,dc=com"),
			BindPassword: model.NewPointer("new-password"),
		}

		appErr := th.App.TestLdapConnection(th.Context, settings)
		require.NotNil(t, appErr)
		require.NotEqual(t, "api.ldap.test.reenter_password", appErr.Id)
	})
}
