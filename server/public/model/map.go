package model

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
)

func AssertNotSameMap[K comparable, V any](t *testing.T, a, b map[K]V) {
	assert.False(t, reflect.ValueOf(a).UnsafePointer() == reflect.ValueOf(b).UnsafePointer())
}
