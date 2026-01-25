// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// keygenProductionPublicKey is the Ed25519 public key for production Keygen licenses.
// This key is obtained from the Keygen dashboard: Settings > Public Key
// Format: 64 hex characters (32 bytes)
// TODO: Obtain actual production key from Keygen dashboard
var keygenProductionPublicKey = "94034554a9fcd734f2ea691b5700a7ee77c870cec0ba6d5b480b309f2170065f"

// keygenTestPublicKey is the Ed25519 public key for test/development Keygen licenses.
// This key is used for local development and testing.
// Format: 64 hex characters (32 bytes)
// TODO: Generate or obtain test key for development
var keygenTestPublicKey = "94034554a9fcd734f2ea691b5700a7ee77c870cec0ba6d5b480b309f2170065f"

// GetKeygenPublicKey returns the appropriate Ed25519 public key based on the
// current service environment. Production uses the production key, while
// test and development environments use the test key.
func GetKeygenPublicKey() string {
	switch model.GetServiceEnvironment() {
	case model.ServiceEnvironmentProduction:
		return keygenProductionPublicKey
	case model.ServiceEnvironmentTest, model.ServiceEnvironmentDev:
		return keygenTestPublicKey
	default:
		return keygenTestPublicKey
	}
}

// SetKeygenTestPublicKey allows setting the test public key for testing purposes.
// This should only be used in tests.
func SetKeygenTestPublicKey(key string) {
	keygenTestPublicKey = key
}

// SetKeygenProductionPublicKey allows setting the production public key.
// This could be used for configuration injection.
func SetKeygenProductionPublicKey(key string) {
	keygenProductionPublicKey = key
}
