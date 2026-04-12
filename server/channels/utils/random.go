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
	max := int64((r.End - r.Begin) + 1)
	n, err := rand.Int(rand.Reader, big.NewInt(max))
	if err != nil {
		// Fallback to begin value if crypto/rand fails (rare)
		return r.Begin
	}
	return int(n.Int64()) + r.Begin
}
