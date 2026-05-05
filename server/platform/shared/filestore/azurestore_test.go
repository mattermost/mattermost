// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"fmt"
	"net"
	"os"
	"testing"
	"time"

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
		host = "127.0.0.1"
	}
	port := os.Getenv("CI_AZURITE_PORT")
	if port == "" {
		port = "10000"
	}

	// Skip when Azurite isn't reachable. CI doesn't currently bring it up;
	// the dedicated test-infra ticket (MM-68661) wires Azurite into the CI
	// docker-compose so this branch goes away once that lands.
	addr := net.JoinHostPort(host, port)
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil {
		t.Skipf("Azurite not reachable at %s: %v", addr, err)
	}
	conn.Close()

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
