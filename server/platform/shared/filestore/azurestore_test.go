// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"bytes"
	"context"
	"errors"
	"net"
	"os"
	"testing"

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
			got, err := buildAzureServiceURL(tt.cloud, tt.scheme, account, tt.endpoint)
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
		DriverName:                      driverAzure,
		AzureStorageAccount:             azuriteWellKnownAccount,
		AzureAccessKey:                  azuriteWellKnownKey,
		AzureContainer:                  "mattermost-test",
		AzureCloud:                      model.AzureCloudCustom,
		AzureEndpoint:                   "http://" + net.JoinHostPort(host, port) + "/" + azuriteWellKnownAccount + "/",
		AzureRequestTimeoutMilliseconds: 30000,
	}
}

func TestAzureFileBackendTestSuite(t *testing.T) {
	suite.Run(t, &FileBackendTestSuite{settings: azuriteSettings(t)})
}
