// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

func TestBuildAzureServiceURL(t *testing.T) {
	const account = "acmemattermost"

	tests := []struct {
		name     string
		cloud    string
		scheme   string
		account  string // defaults to the package-level account const when empty
		endpoint string
		expected string
		wantErr  bool
	}{
		{
			name:     "commercial cloud, default scheme",
			cloud:    model.AzureCloudCommercial,
			scheme:   "https",
			expected: "https://acmemattermost.blob.core.windows.net/",
		},
		{
			name:    "commercial cloud rejects an account name with a hash character",
			cloud:   model.AzureCloudCommercial,
			scheme:  "https",
			account: "account#",
			wantErr: true,
		},
		{
			name:    "commercial cloud rejects an account name with a slash character",
			cloud:   model.AzureCloudCommercial,
			scheme:  "https",
			account: "account/",
			wantErr: true,
		},
		{
			name:    "government cloud rejects a malformed account name",
			cloud:   model.AzureCloudGovernment,
			scheme:  "https",
			account: "account#",
			wantErr: true,
		},
		{
			name:     "empty cloud falls back to commercial for legacy configs",
			cloud:    "",
			scheme:   "https",
			expected: "https://acmemattermost.blob.core.windows.net/",
		},
		{
			name:     "government cloud uses the usgovcloudapi suffix",
			cloud:    model.AzureCloudGovernment,
			scheme:   "https",
			expected: "https://acmemattermost.blob.core.usgovcloudapi.net/",
		},
		{
			name:     "custom cloud returns the endpoint verbatim (vhost-style)",
			cloud:    model.AzureCloudCustom,
			scheme:   "https",
			endpoint: "https://acmemattermost.blob.core.windows.net/",
			expected: "https://acmemattermost.blob.core.windows.net/",
		},
		{
			name:     "custom cloud returns the endpoint verbatim (Azurite path-style)",
			cloud:    model.AzureCloudCustom,
			scheme:   "http",
			endpoint: "http://localhost:10000/devstoreaccount1/",
			expected: "http://localhost:10000/devstoreaccount1/",
		},
		{
			name:     "custom cloud preserves arbitrary paths the admin provides",
			cloud:    model.AzureCloudCustom,
			scheme:   "https",
			endpoint: "https://blob-proxy.internal.example.com/some/prefix/account/",
			expected: "https://blob-proxy.internal.example.com/some/prefix/account/",
		},
		{
			name:    "custom cloud rejects an empty endpoint",
			cloud:   model.AzureCloudCustom,
			scheme:  "https",
			wantErr: true,
		},
		{
			name:     "custom cloud rejects an endpoint missing the scheme",
			cloud:    model.AzureCloudCustom,
			scheme:   "https",
			endpoint: "acmemattermost.blob.core.windows.net/",
			wantErr:  true,
		},
		{
			name:     "custom cloud rejects an endpoint with no host",
			cloud:    model.AzureCloudCustom,
			scheme:   "https",
			endpoint: "https:///acmemattermost/",
			wantErr:  true,
		},
		{
			name:     "custom cloud rejects a non-HTTP scheme",
			cloud:    model.AzureCloudCustom,
			scheme:   "https",
			endpoint: "ftp://blob.example.com/",
			wantErr:  true,
		},
		{
			name:    "unknown cloud value is rejected",
			cloud:   "azuregermany",
			scheme:  "https",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			acct := account
			if tt.account != "" {
				acct = tt.account
			}
			got, err := buildAzureServiceURL(tt.cloud, tt.scheme, acct, tt.endpoint)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expected, got)
		})
	}
}

func TestAzureFileBackendPrefix(t *testing.T) {
	tests := []struct {
		name     string
		prefix   string
		input    string
		expected string
	}{
		{name: "no prefix, plain path", prefix: "", input: "team/channel/file", expected: "team/channel/file"},
		{name: "no prefix, with dot-dot", prefix: "", input: "../escape", expected: "../escape"},
		{name: "prefix, plain path", prefix: "mattermost", input: "team/channel/file", expected: "mattermost/team/channel/file"},
		{name: "prefix, exact root", prefix: "mattermost", input: "", expected: "mattermost"},
		{name: "prefix, dot-dot escapes", prefix: "mattermost", input: "../escape", expected: "mattermost/escape"},
		{name: "prefix, nested dot-dot escapes", prefix: "mattermost", input: "sub/../../escape", expected: "mattermost/escape"},
		{name: "prefix, dot-dot in middle stays inside", prefix: "mattermost", input: "a/../b", expected: "mattermost/b"},
		{name: "prefix with trailing slash, dot-dot escapes", prefix: "mattermost/", input: "../escape", expected: "mattermost/escape"},
		{name: "prefix boundary collision must not escape", prefix: "mattermost", input: "../mattermost-evil/file", expected: "mattermost/file"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &AzureFileBackend{pathPrefix: tt.prefix}
			require.Equal(t, tt.expected, b.prefix(tt.input))
		})
	}
}

// azuriteWellKnownAccount and azuriteWellKnownKey are Azurite's published
// development credentials. They are not secrets - they are documented in the
// Azurite README and ship hardcoded in every Azurite distribution.
const (
	azuriteWellKnownAccount = "devstoreaccount1"
	azuriteWellKnownKey     = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
)

// TestAzureFileBackendAppendRefusesNonBlockBlob exercises the safety
// check in AppendFile: when a blob exists with content but no committed
// block list (i.e. it was uploaded via Put Blob by another tool), the
// backend must refuse the append rather than silently destroy the
// existing content.
func TestAzureFileBackendAppendRefusesNonBlockBlob(t *testing.T) {
	be := newAzuriteBackend(t)

	path := "append-refusal-test.bin"
	t.Cleanup(func() { _ = be.RemoveFile(path) })

	// Write the blob via the high-level Upload helper, which calls the
	// Put Blob REST endpoint and leaves the committed-block list empty.
	original := []byte("planted-by-another-tool")
	bb := be.newBlockBlobClient(path)
	_, err := bb.Upload(context.Background(), nopReadSeekCloser{bytes.NewReader(original)}, nil)
	require.NoError(t, err)

	_, err = be.AppendFile(bytes.NewReader([]byte("would-overwrite")), path)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no committed block list")

	// The original content must still be intact.
	got, err := be.ReadFile(path)
	require.NoError(t, err)
	require.Equal(t, original, got)
}

// TestAzureFileBackendMakeContainerIdempotent ensures that calling
// MakeContainer twice on the same backend is a no-op the second time.
// Two nodes can race through TestConnection plus MakeContainer at boot;
// the loser must converge instead of returning an error.
func TestAzureFileBackendMakeContainerIdempotent(t *testing.T) {
	be := newAzuriteBackend(t)

	require.NoError(t, be.MakeContainer())
	require.NoError(t, be.MakeContainer())
}

type nopReadSeekCloser struct {
	*bytes.Reader
}

func (nopReadSeekCloser) Close() error { return nil }

// newAzuriteBackend builds an Azure backend pointed at the Azurite emulator
// and ensures the container exists. Standalone Azure tests should use this
// instead of calling NewAzureFileBackend + TestConnection directly; the
// shared FileBackendTestSuite handles provisioning itself in SetupTest.
func newAzuriteBackend(t *testing.T) *AzureFileBackend {
	t.Helper()
	be, err := NewAzureFileBackend(azuriteSettings(t))
	require.NoError(t, err)

	var noBucket *FileBackendNoBucketError
	if err := be.TestConnection(); errors.As(err, &noBucket) {
		require.NoError(t, be.MakeContainer())
	} else {
		require.NoError(t, err)
	}
	return be
}

func azuriteSettings(t *testing.T) FileBackendSettings {
	t.Helper()
	host := os.Getenv("CI_AZURITE_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("CI_AZURITE_PORT")
	if port == "" {
		port = "10000"
	}
	return FileBackendSettings{
		DriverName:          driverAzure,
		AzureStorageAccount: azuriteWellKnownAccount,
		AzureAuthMode:       model.AzureAuthModeSharedKey,
		AzureAccessKey:      azuriteWellKnownKey,
		AzureContainer:      "mattermost-test",
		AzureCloud:          model.AzureCloudCustom,
		AzureEndpoint:       "http://" + net.JoinHostPort(host, port) + "/" + azuriteWellKnownAccount + "/",
		// The emulator runs on an internal address, so its host must be allowed.
		AllowedUntrustedInternalConnections: host,
		AzureRequestTimeoutMilliseconds:     30000,
	}
}

func TestNewAzureFileBackendAuthMode(t *testing.T) {
	base := FileBackendSettings{
		DriverName:                      driverAzure,
		AzureStorageAccount:             "anaccount",
		AzureContainer:                  "acontainer",
		AzureEndpoint:                   "localhost:10000",
		AzureSSL:                        false,
		AzureRequestTimeoutMilliseconds: 30000,
	}

	t.Run("shared_key constructs a client", func(t *testing.T) {
		s := base
		s.AzureAuthMode = model.AzureAuthModeSharedKey
		s.AzureAccessKey = azuriteWellKnownKey

		be, err := NewAzureFileBackend(s)
		require.NoError(t, err)
		require.NotNil(t, be.client)
	})

	t.Run("default_credential constructs a client without an access key", func(t *testing.T) {
		s := base
		s.AzureAuthMode = model.AzureAuthModeDefaultCredential
		// Intentionally no AzureAccessKey - default credential reads
		// identity from the host environment, not config.

		be, err := NewAzureFileBackend(s)
		require.NoError(t, err)
		require.NotNil(t, be.client)
	})

	t.Run("empty AuthMode is rejected", func(t *testing.T) {
		s := base
		s.AzureAuthMode = ""
		s.AzureAccessKey = azuriteWellKnownKey

		_, err := NewAzureFileBackend(s)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unknown azure auth mode")
	})

	t.Run("unknown AuthMode is rejected", func(t *testing.T) {
		s := base
		s.AzureAuthMode = "oauth2"
		s.AzureAccessKey = azuriteWellKnownKey

		_, err := NewAzureFileBackend(s)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unknown azure auth mode")
	})
}

func TestCheckMandatoryAzureFieldsAuthMode(t *testing.T) {
	base := FileBackendSettings{
		AzureStorageAccount: "anaccount",
		AzureContainer:      "acontainer",
	}

	t.Run("shared_key requires access key", func(t *testing.T) {
		s := base
		s.AzureAuthMode = model.AzureAuthModeSharedKey
		s.AzureAccessKey = ""
		require.Error(t, s.CheckMandatoryAzureFields())

		s.AzureAccessKey = "somekey"
		require.NoError(t, s.CheckMandatoryAzureFields())
	})

	t.Run("default_credential does not require access key", func(t *testing.T) {
		s := base
		s.AzureAuthMode = model.AzureAuthModeDefaultCredential
		s.AzureAccessKey = ""
		require.NoError(t, s.CheckMandatoryAzureFields())
	})
}

func TestAzureFileBackendTestSuite(t *testing.T) {
	suite.Run(t, &FileBackendTestSuite{settings: azuriteSettings(t)})
}

// TestAzureGeneratePublicLink exercises the Service SAS path against Azurite.
// The user-delegation SAS path requires Entra ID and cannot run in CI; it is
// covered by the manual verification recipe in the PR description.
func TestAzureGeneratePublicLink(t *testing.T) {
	t.Run("refuses to issue a link when presign expiration is unset", func(t *testing.T) {
		settings := azuriteSettings(t)
		// Deliberately leave AzurePresignExpiresSeconds at zero - the
		// shape an admin would hit if they enabled the export-direct-
		// download feature without ever configuring the field.
		be, err := NewAzureFileBackend(settings)
		require.NoError(t, err)

		_, _, err = be.GeneratePublicLink("any/path")
		require.Error(t, err)
		require.Contains(t, err.Error(), "presign expiration is not configured")
	})

	t.Run("shared-key SAS round-trips through Azurite", func(t *testing.T) {
		settings := azuriteSettings(t)
		settings.AzurePresignExpiresSeconds = 300
		be, err := NewAzureFileBackend(settings)
		require.NoError(t, err)

		var noBucket *FileBackendNoBucketError
		if connErr := be.TestConnection(); errors.As(connErr, &noBucket) {
			require.NoError(t, be.MakeContainer())
		} else {
			require.NoError(t, connErr)
		}

		path := "tests/presign-" + model.NewId() + ".bin"
		payload := bytes.Repeat([]byte("mattermost"), 4096) // 40 KiB
		_, writeErr := be.WriteFile(bytes.NewReader(payload), path)
		require.NoError(t, writeErr)
		t.Cleanup(func() { _ = be.RemoveFile(path) })

		link, expiry, err := be.GeneratePublicLink(path)
		require.NoError(t, err)
		require.NotEmpty(t, link)
		require.Equal(t, 300*time.Second, expiry)

		// SAS query parameters Azurite expects to see.
		u, err := url.Parse(link)
		require.NoError(t, err)
		require.NotEmpty(t, u.Query().Get("sig"))
		require.Equal(t, "r", u.Query().Get("sp"))
		require.Equal(t, "attachment", u.Query().Get("rscd"))

		resp, err := http.Get(link)
		require.NoError(t, err)
		t.Cleanup(func() { _ = resp.Body.Close() })
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, "attachment", resp.Header.Get("Content-Disposition"))

		got, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, payload, got)
	})

	t.Run("tampered SAS is rejected by the storage service", func(t *testing.T) {
		settings := azuriteSettings(t)
		settings.AzurePresignExpiresSeconds = 300
		be, err := NewAzureFileBackend(settings)
		require.NoError(t, err)

		var noBucket *FileBackendNoBucketError
		if connErr := be.TestConnection(); errors.As(connErr, &noBucket) {
			require.NoError(t, be.MakeContainer())
		} else {
			require.NoError(t, connErr)
		}

		path := "tests/tamper-" + model.NewId() + ".bin"
		_, writeErr := be.WriteFile(bytes.NewReader([]byte("contents")), path)
		require.NoError(t, writeErr)
		t.Cleanup(func() { _ = be.RemoveFile(path) })

		link, _, err := be.GeneratePublicLink(path)
		require.NoError(t, err)

		// Flip the last character of the signature so the link no longer
		// matches what Azurite signed.
		u, err := url.Parse(link)
		require.NoError(t, err)
		q := u.Query()
		sig := q.Get("sig")
		require.NotEmpty(t, sig)
		swapped := sig[:len(sig)-1] + flipBase64Char(sig[len(sig)-1])
		q.Set("sig", swapped)
		u.RawQuery = q.Encode()

		resp, err := http.Get(u.String())
		require.NoError(t, err)
		t.Cleanup(func() { _ = resp.Body.Close() })
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("unknown auth mode is rejected", func(t *testing.T) {
		// Build a backend by hand so we can exercise the default-branch
		// guard. Going through NewAzureFileBackend would be rejected by
		// CheckMandatoryAzureFields first.
		be := &AzureFileBackend{
			authMode:       "totally-not-real",
			presignExpires: time.Minute,
		}
		_, _, err := be.GeneratePublicLink("any/path")
		require.Error(t, err)
		require.Contains(t, err.Error(), "unknown azure auth mode")
	})
}

// flipBase64Char swaps a base64 character for another in the same alphabet
// to produce a still-valid-but-wrong signature character. Used only by the
// tamper test above.
func flipBase64Char(c byte) string {
	if c == 'A' {
		return "B"
	}
	return "A"
}
