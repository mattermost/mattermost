// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"net/http"
	"sync"

	keygen "github.com/keygen-sh/keygen-go/v3"
)

// keygen-go uses package-level globals for configuration.
// Serialize updates to avoid cross-goroutine contamination.
var keygenSDKMu sync.Mutex

type keygenSDKSnapshot struct {
	account    string
	product    string
	licenseKey string
	publicKey  string
	httpClient *http.Client
}

type keygenSDKUpdate struct {
	account       *string
	product       *string
	licenseKey    *string
	publicKey     *string
	httpClient    *http.Client
	setHTTPClient bool
}

func withKeygenSDK(update keygenSDKUpdate, fn func() error) error {
	keygenSDKMu.Lock()
	defer keygenSDKMu.Unlock()

	snapshot := keygenSDKSnapshot{
		account:    keygen.Account,
		product:    keygen.Product,
		licenseKey: keygen.LicenseKey,
		publicKey:  keygen.PublicKey,
		httpClient: keygen.HTTPClient,
	}

	defer func() {
		keygen.Account = snapshot.account
		keygen.Product = snapshot.product
		keygen.LicenseKey = snapshot.licenseKey
		keygen.PublicKey = snapshot.publicKey
		keygen.HTTPClient = snapshot.httpClient
	}()

	if update.account != nil {
		keygen.Account = *update.account
	}
	if update.product != nil {
		keygen.Product = *update.product
	}
	if update.licenseKey != nil {
		keygen.LicenseKey = *update.licenseKey
	}
	if update.publicKey != nil {
		keygen.PublicKey = *update.publicKey
	}
	if update.setHTTPClient {
		keygen.HTTPClient = update.httpClient
	}

	return fn()
}
