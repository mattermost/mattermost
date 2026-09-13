// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"crypto/rand"
	"math/big"
)

type Range struct {
	Begin int
	End   int
}

func RandIntFromRange(r Range) int {
	if r.End-r.Begin <= 0 {
		return r.Begin
	}
	// Use big.Int for span calculation to avoid arithmetic overflow
	begin := big.NewInt(int64(r.Begin))
	end := big.NewInt(int64(r.End))
	max := new(big.Int).Sub(end, begin)
	max.Add(max, big.NewInt(1))
	
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		// Fallback to begin value if crypto/rand fails (rare)
		return r.Begin
	}
	return int(n.Int64()) + r.Begin
}
