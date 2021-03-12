package sentry

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"time"
)

func uuid() string {
	id := make([]byte, 16)
	// Prefer rand.Read over rand.Reader, see https://go-review.googlesource.com/c/go/+/272326/.
	_, _ = rand.Read(id)
	id[6] &= 0x0F // clear version
	id[6] |= 0x40 // set version to 4 (random uuid)
	id[8] &= 0x3F // clear variant
	id[8] |= 0x80 // set to IETF variant
	return hex.EncodeToString(id)
}

func fileExists(fileName string) bool {
	_, err := os.Stat(fileName)
	return err == nil
}

// monotonicTimeSince replaces uses of time.Now() to take into account the
// monotonic clock reading stored in start, such that duration = end - start is
// unaffected by changes in the system wall clock.
func monotonicTimeSince(start time.Time) (end time.Time) {
	return start.Add(time.Since(start))
}

//nolint: deadcode, unused
func prettyPrint(data interface{}) {
	dbg, _ := json.MarshalIndent(data, "", "  ")
	fmt.Println(string(dbg))
}
