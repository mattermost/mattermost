// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !production

package hashers

import "testing"

// testHasher is used during tests to override the latestHasher with a faster
// alternative. This should only be set via SetTestHasher and only in test code.
var testHasher PasswordHasher

// getLatestHasher returns the hasher to use for password operations.
// In non-production builds, if a test hasher has been set via SetTestHasher,
// it will be returned instead of the production latestHasher.
func getLatestHasher() PasswordHasher {
	if testHasher != nil {
		return testHasher
	}
	return latestHasher
}

// SetTestHasher sets a hasher to be used instead of the latestHasher during tests.
// This is useful for speeding up tests that create many users, as password hashing
// is computationally expensive. Pass nil to restore normal behavior.
//
// This function is only available in non-production builds and should only be
// called from test code, typically in TestMain. It will panic if called outside
// of a test context.
//
// Example usage:
//
//	func TestMain(m *testing.M) {
//	    hashers.SetTestHasher(hashers.FastTestHasher())
//	    os.Exit(m.Run())
//	}
func SetTestHasher(h PasswordHasher) {
	if !testing.Testing() {
		panic("SetTestHasher called outside of test context")
	}
	testHasher = h
}

// FastTestHasher returns a PBKDF2 hasher configured with minimal work factor
// for use in tests while still producing valid password hashes that can be
// verified.
//
// This function is only available in non-production builds.
func FastTestHasher() PasswordHasher {
	h, err := NewPBKDF2(1, defaultKeyLength)
	if err != nil {
		panic("failed to create fast test hasher: " + err.Error())
	}
	return h
}
