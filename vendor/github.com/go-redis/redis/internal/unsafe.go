// +build !appengine

package internal

import (
	"unsafe"
)

// BytesToString converts byte slice to string.
func BytesToString(b []byte) string {
	return *(*string)(unsafe.Pointer(&b))
}
