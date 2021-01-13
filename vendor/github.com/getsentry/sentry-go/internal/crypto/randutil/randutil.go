package randutil

import (
	"crypto/rand"
	"encoding/binary"
)

const (
	floatMax  = 1 << 53
	floatMask = floatMax - 1
)

// Float64 returns a cryptographically secure random number in [0.0, 1.0).
func Float64() float64 {
	// The implementation is, in essence:
	//	return float64(rand.Int63n(1<<53)) / (1<<53)
	b := make([]byte, 8)
	_, err := rand.Read(b)
	if err != nil {
		panic(err)
	}
	return float64(binary.LittleEndian.Uint64(b)&floatMask) / floatMax
}
