// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"fmt"
	"os"
	"testing"

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
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &AzureFileBackend{pathPrefix: tt.prefix}
			require.Equal(t, tt.expected, b.prefix(tt.input))
		})
	}
}

// azuriteWellKnownAccount and azuriteWellKnownKey are Azurite's published
// development credentials. They are not secrets — they are documented in the
// Azurite README and ship hardcoded in every Azurite distribution.
const (
	azuriteWellKnownAccount = "devstoreaccount1"
	azuriteWellKnownKey     = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
)

func TestAzureFileBackendTestSuite(t *testing.T) {
	host := os.Getenv("CI_AZURITE_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("CI_AZURITE_PORT")
	if port == "" {
		port = "10000"
	}

	suite.Run(t, &FileBackendTestSuite{
		settings: FileBackendSettings{
			DriverName:                      driverAzure,
			AzureStorageAccount:             azuriteWellKnownAccount,
			AzureAccessKey:                  azuriteWellKnownKey,
			AzureContainer:                  "mattermost-test",
			AzureEndpoint:                   fmt.Sprintf("%s:%s", host, port),
			AzureSSL:                        false,
			AzureRequestTimeoutMilliseconds: 30000,
		},
	})
}
