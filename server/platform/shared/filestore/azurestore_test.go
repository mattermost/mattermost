// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

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
		AzureAuthMode:                   model.AzureAuthModeSharedKey,
		AzureAccessKey:                  azuriteWellKnownKey,
		AzureContainer:                  "mattermost-test",
		AzureEndpoint:                   fmt.Sprintf("%s:%s", host, port),
		AzureSSL:                        false,
		AzureRequestTimeoutMilliseconds: 30000,
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

	t.Run("empty AuthMode falls back to shared key for direct callers", func(t *testing.T) {
		s := base
		s.AzureAuthMode = ""
		s.AzureAccessKey = azuriteWellKnownKey

		be, err := NewAzureFileBackend(s)
		require.NoError(t, err)
		require.NotNil(t, be.client)
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
