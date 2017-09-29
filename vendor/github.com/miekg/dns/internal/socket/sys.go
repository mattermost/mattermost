package socket

import "unsafe"

var (
	kernelAlign = func() int {
		var p uintptr
		return int(unsafe.Sizeof(p))
	}()
)

func roundup(l int) int {
	return (l + kernelAlign - 1) & ^(kernelAlign - 1)
}
