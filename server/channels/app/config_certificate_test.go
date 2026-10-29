// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestRemoveCertificateKeepsFileWhenConfigSaveFails(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	cert := []byte("certificate")
	require.Nil(t, th.App.AddSamlPublicCertificate(newTestFileHeader(t, "public.crt", cert)))
	require.Nil(t, th.App.AddSamlPrivateCertificate(newTestFileHeader(t, "private.key", cert)))
	require.Nil(t, th.App.AddSamlIdpCertificate(newTestFileHeader(t, "idp.crt", cert)))
	require.Nil(t, th.App.AddLdapPublicCertificate(newTestFileHeader(t, "public.crt", cert)))
	require.Nil(t, th.App.AddLdapPrivateCertificate(newTestFileHeader(t, "private.key", cert)))
	require.Nil(t, th.App.AddAuditLogCertificate(th.Context, newTestFileHeader(t, "audit.crt", cert)))

	tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t, []string{
		fmt.Sprintf(configurationWillBeSavedHookTemplate, `return nil, fmt.Errorf("rejected")`),
	}, th.App, th.NewPluginAPI)
	defer tearDown()
	require.NoError(t, activationErrors[0])

	for _, tc := range []struct {
		name     string
		remove   func() *model.AppError
		filename func(cfg *model.Config) string
	}{
		{"SAML public certificate", th.App.RemoveSamlPublicCertificate, func(cfg *model.Config) string { return *cfg.SamlSettings.PublicCertificateFile }},
		{"SAML private key", th.App.RemoveSamlPrivateCertificate, func(cfg *model.Config) string { return *cfg.SamlSettings.PrivateKeyFile }},
		{"SAML IdP certificate", th.App.RemoveSamlIdpCertificate, func(cfg *model.Config) string { return *cfg.SamlSettings.IdpCertificateFile }},
		{"LDAP public certificate", th.App.RemoveLdapPublicCertificate, func(cfg *model.Config) string { return *cfg.LdapSettings.PublicCertificateFile }},
		{"LDAP private key", th.App.RemoveLdapPrivateCertificate, func(cfg *model.Config) string { return *cfg.LdapSettings.PrivateKeyFile }},
		{"audit log certificate", func() *model.AppError { return th.App.RemoveAuditLogCertificate(th.Context) }, func(cfg *model.Config) string {
			return *cfg.ExperimentalAuditSettings.Certificate
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			filename := tc.filename(th.App.Config())
			require.NotEmpty(t, filename)

			require.NotNil(t, tc.remove())

			assert.Equal(t, filename, tc.filename(th.App.Config()))
			exists, err := th.App.Srv().platform.HasConfigFile(filename)
			require.NoError(t, err)
			assert.True(t, exists, "expected %q to remain while the config still references it", filename)
		})
	}
}
