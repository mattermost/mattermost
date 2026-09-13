// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"math/rand/v2"
)

type Range struct {
	Begin int
	End   int
}

func RandIntFromRange(r Range) int {
	if r.End-r.Begin <= 0 {
		return r.Begin
	}
	return rand.IntN((r.End-r.Begin)+1) + r.Begin
}

// FillPseudoRandom fills b with pseudo-random bytes drawn from r. math/rand/v2
// has no Read method, unlike the v1 *rand.Rand it replaces. Not cryptographically
// secure; for tests and benchmarks only.
func FillPseudoRandom(r *rand.Rand, b []byte) {
	for i := 0; i < len(b); i += 8 {
		v := r.Uint64()
		for j := 0; j < 8 && i+j < len(b); j++ {
			b[i+j] = byte(v >> (8 * j))
		}
	}
}

// PseudoRandomBytes returns n pseudo-random bytes drawn from an unpredictably seeded
// source. Not cryptographically secure; for tests and benchmarks only.
func PseudoRandomBytes(n int) []byte {
	b := make([]byte, n)
	FillPseudoRandom(rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64())), b)
	return b
}
