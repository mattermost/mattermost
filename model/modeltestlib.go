package model

import (
	"runtime/debug"
	"testing"
)

func CheckInt(t *testing.T, got int, expected int) {
	if got != expected {
		debug.PrintStack()
		t.Fatalf("Got: %v, Expected: %v", got, expected)
	}
}
