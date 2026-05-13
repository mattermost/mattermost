// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !production

package hashers

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSetTestHasher(t *testing.T) {
	// Ensure testHasher starts as nil
	SetTestHasher(nil)

	// Hash should work with nil testHasher (uses latestHasher)
	hash1, err := Hash("T3stP@ssw0rd!xYz")
	require.NoError(t, err)
	require.NotEmpty(t, hash1)

	// Set a fast test hasher
	fastHasher := FastTestHasher()
	SetTestHasher(fastHasher)
	defer SetTestHasher(nil)

	// Hash should now use the fast test hasher
	hash2, err := Hash("T3stP@ssw0rd!xYz")
	require.NoError(t, err)
	require.NotEmpty(t, hash2)

	// Verify the hash was generated with different parameters
	// The fast hasher uses the FIPS-minimum work factor.
	require.Contains(t, hash2, ",w=1000,")

	// Verify the password can be verified against the hash
	hasher, phc, err := GetHasherFromPHCString(hash2)
	require.NoError(t, err)
	require.NoError(t, hasher.CompareHashAndPassword(phc, "T3stP@ssw0rd!xYz"))
	require.Error(t, hasher.CompareHashAndPassword(phc, "Wr0ngP@ssw0rd!!"))
}

func TestFastTestHasher(t *testing.T) {
	hasher := FastTestHasher()
	require.NotNil(t, hasher)

	// Verify it's a PBKDF2 hasher with the FIPS-minimum work factor.
	pbkdf2Hasher, ok := hasher.(PBKDF2)
	require.True(t, ok, "FastTestHasher should return a PBKDF2 hasher")
	require.Equal(t, fastTestHasherWorkFactor, pbkdf2Hasher.workFactor)

	// Test that it produces valid hashes
	testPassword := "T3stP@ssw0rd!xYz"
	hash, err := hasher.Hash(testPassword)
	require.NoError(t, err)
	require.Contains(t, hash, ",w=1000,")

	// Verify the hash can be validated
	parsedHasher, phc, err := GetHasherFromPHCString(hash)
	require.NoError(t, err)
	require.NoError(t, parsedHasher.CompareHashAndPassword(phc, testPassword))
}

func TestGetLatestHasher(t *testing.T) {
	// Ensure testHasher starts as nil
	SetTestHasher(nil)

	// Without test hasher, should return latestHasher
	require.Equal(t, latestHasher, GetLatestHasher())

	// Set a fast test hasher
	fastHasher := FastTestHasher()
	SetTestHasher(fastHasher)
	defer SetTestHasher(nil)

	// With test hasher set, should return the test hasher
	require.Equal(t, fastHasher, GetLatestHasher())
	require.NotEqual(t, latestHasher, GetLatestHasher())
}

func BenchmarkFastTestHasher(b *testing.B) {
	hasher := FastTestHasher()
	for b.Loop() {
		_, _ = hasher.Hash("password")
	}
}
