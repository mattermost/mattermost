// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package auth

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func samlSnapshot(edit func(cfg *model.Config)) *healthcheck.Snapshot {
	return configSnapshot(func(cfg *model.Config) {
		cfg.SamlSettings.Enable = new(true)
		cfg.SamlSettings.IdAttribute = new("objectGUID")
		edit(cfg)
	})
}

func TestSamlRules(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "defaults",
			snapshot: samlSnapshot(func(cfg *model.Config) {}),
			want: map[string]want{
				"SAML_SIGNATURE_SHA1": resolved,
				"SAML_VERIFY_OFF":     resolved,
				"SAML_ENCRYPT_OFF":    resolved,
				"SAML_ID_IS_EMAIL":    resolved,
				"SAML_ID_MUTABLE":     resolved,
			},
		},
		{
			name: "SHA-1 signatures",
			snapshot: samlSnapshot(func(cfg *model.Config) {
				cfg.SamlSettings.SignatureAlgorithm = new(model.SamlSettingsSignatureAlgorithmSha1)
			}),
			want: map[string]want{"SAML_SIGNATURE_SHA1": firing("health.rule.saml_signature_sha1.message", nil)},
		},
		{
			name: "SHA-512 signatures",
			snapshot: samlSnapshot(func(cfg *model.Config) {
				cfg.SamlSettings.SignatureAlgorithm = new(model.SamlSettingsSignatureAlgorithmSha512)
			}),
			want: map[string]want{"SAML_SIGNATURE_SHA1": resolved},
		},
		{
			name:     "signature algorithm absent",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.SignatureAlgorithm = nil }),
			want:     map[string]want{"SAML_SIGNATURE_SHA1": configUnavailable},
		},
		{
			name:     "verification off",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.Verify = new(false) }),
			want:     map[string]want{"SAML_VERIFY_OFF": firing("health.rule.saml_verify_off.message", nil)},
		},
		{
			name:     "verify absent",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.Verify = nil }),
			want:     map[string]want{"SAML_VERIFY_OFF": configUnavailable},
		},
		{
			name:     "encryption off",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.Encrypt = new(false) }),
			want:     map[string]want{"SAML_ENCRYPT_OFF": firing("health.rule.saml_encrypt_off.message", nil)},
		},
		{
			name:     "encrypt absent",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.Encrypt = nil }),
			want:     map[string]want{"SAML_ENCRYPT_OFF": configUnavailable},
		},
		{
			name:     "empty IdAttribute keys by email",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.IdAttribute = new("") }),
			want: map[string]want{
				"SAML_ID_IS_EMAIL": firing("health.rule.saml_id_is_email.message", map[string]string{"attribute": ""}),
				"SAML_ID_MUTABLE":  resolved,
			},
		},
		{
			name:     "IdAttribute EmailAddress",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.IdAttribute = new("EmailAddress") }),
			want: map[string]want{
				"SAML_ID_IS_EMAIL": firing("health.rule.saml_id_is_email.message", map[string]string{"attribute": "EmailAddress"}),
				"SAML_ID_MUTABLE":  resolved,
			},
		},
		{
			name:     "IdAttribute mail",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.IdAttribute = new("mail") }),
			want: map[string]want{
				"SAML_ID_IS_EMAIL": firing("health.rule.saml_id_is_email.message", map[string]string{"attribute": "mail"}),
				"SAML_ID_MUTABLE":  resolved,
			},
		},
		{
			name:     "IdAttribute sAMAccountName",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.IdAttribute = new("sAMAccountName") }),
			want: map[string]want{
				"SAML_ID_IS_EMAIL": resolved,
				"SAML_ID_MUTABLE":  firing("health.rule.saml_id_mutable.message", map[string]string{"attribute": "sAMAccountName"}),
			},
		},
		{
			name:     "IdAttribute username",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.IdAttribute = new("Username") }),
			want: map[string]want{
				"SAML_ID_IS_EMAIL": resolved,
				"SAML_ID_MUTABLE":  firing("health.rule.saml_id_mutable.message", map[string]string{"attribute": "Username"}),
			},
		},
		{
			name:     "IdAttribute uid",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.IdAttribute = new("uid") }),
			want: map[string]want{
				"SAML_ID_IS_EMAIL": resolved,
				"SAML_ID_MUTABLE":  firing("health.rule.saml_id_mutable.message", map[string]string{"attribute": "uid"}),
			},
		},
		{
			name:     "IdAttribute absent",
			snapshot: samlSnapshot(func(cfg *model.Config) { cfg.SamlSettings.IdAttribute = nil }),
			want:     map[string]want{"SAML_ID_IS_EMAIL": configUnavailable, "SAML_ID_MUTABLE": configUnavailable},
		},
		{
			name: "SAML off",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.SamlSettings.Verify = new(false)
				cfg.SamlSettings.IdAttribute = new("uid")
			}),
			want: map[string]want{"SAML_VERIFY_OFF": resolved, "SAML_ID_IS_EMAIL": resolved, "SAML_ID_MUTABLE": resolved},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResults(t, tc.snapshot, tc.want)
		})
	}
}
