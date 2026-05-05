// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/suite"
)

// azuriteWellKnownAccount and azuriteWellKnownKey are Azurite's published default
// credentials. They are not secrets — they are documented in the Azurite README
// and ship hardcoded in every Azurite distribution.
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
