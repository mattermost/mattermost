// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import "math/rand/v2"

// PseudoRandomBytes returns n pseudo-random bytes drawn from an unpredictably seeded
// source. Not cryptographically secure; for tests and benchmarks only.
func PseudoRandomBytes(n int) []byte {
	b := make([]byte, n)

	for i := 0; i < len(b); i += 8 {
		v := rand.Uint64()
		for j := 0; j < 8 && i+j < len(b); j++ {
			b[i+j] = byte(v >> (8 * j))
		}
	}

	return b
}
