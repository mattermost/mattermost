// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/x509"
	"crypto/x509/pkix"
	"errors"
	"testing"
	"time"

	"github.com/goccy/go-yaml"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSupportPacketLicenseMinimumEnterprise(t *testing.T) {
	t.Parallel()

	for sku, expected := range map[string]bool{
		"":                                false,
		LicenseShortSkuE10:                false,
		LicenseShortSkuE20:                false,
		LicenseShortSkuProfessional:       false,
		LicenseShortSkuEnterprise:         true,
		LicenseShortSkuEnterpriseAdvanced: true,
		LicenseShortSkuMattermostEntry:    true,
	} {
		assert.Equal(t, expected, (&SupportPacketLicense{SkuShortName: sku}).MinimumEnterprise(), sku)
	}

	var license *SupportPacketLicense
	assert.False(t, license.MinimumEnterprise())
}

func TestSupportPacketStatsYAMLRoundTripPreservesNilAndZero(t *testing.T) {
	t.Parallel()

	stats := SupportPacketStats{
		Teams: new(int64),
	}

	data, err := yaml.Marshal(&stats)
	require.NoError(t, err)

	var roundTrip SupportPacketStats
	err = yaml.Unmarshal(data, &roundTrip)
	require.NoError(t, err)
	assert.Nil(t, roundTrip.Posts)
	require.NotNil(t, roundTrip.Teams)
	assert.Equal(t, int64(0), *roundTrip.Teams)
}

func TestSupportPacketStatsYAMLAllPopulatedMatchesLegacyBytes(t *testing.T) {
	t.Parallel()

	stats := SupportPacketStats{
		RegisteredUsers:     new(int64(1)),
		ActiveUsers:         new(int64(2)),
		DailyActiveUsers:    new(int64(3)),
		MonthlyActiveUsers:  new(int64(4)),
		DeactivatedUsers:    new(int64(5)),
		Guests:              new(int64(6)),
		SingleChannelGuests: new(int64(7)),
		BotAccounts:         new(int64(8)),
		Posts:               new(int64(9)),
		Channels:            new(int64(10)),
		Teams:               new(int64(11)),
		SlashCommands:       new(int64(12)),
		IncomingWebhooks:    new(int64(13)),
		OutgoingWebhooks:    new(int64(14)),
	}

	data, err := yaml.Marshal(&stats)
	require.NoError(t, err)

	const expected = `registered_users: 1
active_users: 2
daily_active_users: 3
monthly_active_users: 4
deactivated_users: 5
guests: 6
single_channel_guests: 7
bot_accounts: 8
posts: 9
channels: 10
teams: 11
slash_commands: 12
incoming_webhooks: 13
outgoing_webhooks: 14
`

	assert.Equal(t, expected, string(data))
}

func TestSupportPacketDiagnosticsYAMLOmitsNilAndKeepsZero(t *testing.T) {
	t.Parallel()

	var diagnostics SupportPacketDiagnostics
	diagnostics.Server.OpenFileDescriptors = new(int64(0))
	diagnostics.Database.MasterConnectionsInUse = new(0)
	diagnostics.FileStore.AvailableMB = new(uint64(0))

	data, err := yaml.Marshal(&diagnostics)
	require.NoError(t, err)

	body := string(data)
	assert.Contains(t, body, "open_file_descriptors: 0\n")
	assert.Contains(t, body, "master_connections_in_use: 0\n")
	assert.Contains(t, body, "available_mb: 0\n")
	assert.NotContains(t, body, "max_file_descriptors")
	assert.NotContains(t, body, "schema_version")

	var roundTrip SupportPacketDiagnostics
	err = yaml.Unmarshal(data, &roundTrip)
	require.NoError(t, err)
	assert.Nil(t, roundTrip.Server.MaxFileDescriptors)
	assert.Nil(t, roundTrip.Database.SchemaVersion)
	assert.Equal(t, new(int64(0)), roundTrip.Server.OpenFileDescriptors)
	assert.Equal(t, new(0), roundTrip.Database.MasterConnectionsInUse)
	assert.Equal(t, new(uint64(0)), roundTrip.FileStore.AvailableMB)
}

func TestSupportPacketLicenseIsMattermostEntry(t *testing.T) {
	assert.True(t, (&SupportPacketLicense{SkuShortName: LicenseShortSkuMattermostEntry}).IsMattermostEntry())
	assert.False(t, (&SupportPacketLicense{SkuShortName: LicenseShortSkuEnterprise}).IsMattermostEntry())
	assert.False(t, (*SupportPacketLicense)(nil).IsMattermostEntry())
}

func TestNewSupportPacketCertificate(t *testing.T) {
	t.Parallel()

	notAfter := time.Date(2026, 11, 28, 9, 14, 2, 0, time.FixedZone("CET", 3600))

	t.Run("names the certificate by common names", func(t *testing.T) {
		cert := &x509.Certificate{
			Subject:  pkix.Name{CommonName: "chat.example.com", Organization: []string{"Example"}},
			Issuer:   pkix.Name{CommonName: "R11", Organization: []string{"Let's Encrypt"}},
			NotAfter: notAfter,
		}

		assert.Equal(t, &SupportPacketCertificate{
			CommonName: "chat.example.com",
			Issuer:     "R11",
			NotAfter:   time.Date(2026, 11, 28, 8, 14, 2, 0, time.UTC),
		}, NewSupportPacketCertificate(cert, nil))
	})

	t.Run("falls back to the distinguished name without a common name", func(t *testing.T) {
		cert := &x509.Certificate{Subject: pkix.Name{Organization: []string{"Example"}}, Issuer: pkix.Name{Organization: []string{"Example CA"}}}

		got := NewSupportPacketCertificate(cert, nil)
		assert.Equal(t, "O=Example", got.CommonName)
		assert.Equal(t, "O=Example CA", got.Issuer)
	})

	t.Run("error", func(t *testing.T) {
		assert.Equal(t, &SupportPacketCertificate{Error: "x509: malformed certificate"}, NewSupportPacketCertificate(nil, errors.New("x509: malformed certificate")))
	})

	t.Run("nothing to report", func(t *testing.T) {
		assert.Nil(t, NewSupportPacketCertificate(nil, nil))
	})
}

func TestSupportPacketCertificateYAML(t *testing.T) {
	t.Parallel()

	cert := &x509.Certificate{
		Subject:  pkix.Name{CommonName: "chat.example.com"},
		Issuer:   pkix.Name{CommonName: "R11"},
		NotAfter: time.Date(2026, 11, 28, 9, 14, 2, 0, time.UTC),
	}
	var diagnostics SupportPacketDiagnostics
	diagnostics.TLS.Certificate = NewSupportPacketCertificate(cert, nil)
	diagnostics.LDAP.ClientCertificate = NewSupportPacketCertificate(nil, errors.New(`failed to read certificate "ldap-public.crt": not found`))

	data, err := yaml.Marshal(&diagnostics)
	require.NoError(t, err)

	body := string(data)
	assert.Contains(t, body, `tls:
  certificate:
    common_name: chat.example.com
    issuer: R11
    not_after: 2026-11-28T09:14:02Z
`)
	assert.Contains(t, body, `  client_certificate:
    error: "failed to read certificate \"ldap-public.crt\": not found"
`)
	assert.NotContains(t, body, "server_certificate")
	assert.NotContains(t, body, "idp_certificate")
	assert.NotContains(t, body, "sp_certificate")

	var roundTrip SupportPacketDiagnostics
	err = yaml.Unmarshal(data, &roundTrip)
	require.NoError(t, err)
	assert.Equal(t, diagnostics.TLS.Certificate, roundTrip.TLS.Certificate)
	assert.Equal(t, diagnostics.LDAP.ClientCertificate, roundTrip.LDAP.ClientCertificate)
	assert.Nil(t, roundTrip.LDAP.ServerCertificate)
	assert.Nil(t, roundTrip.SAML.IdpCertificate)
}
