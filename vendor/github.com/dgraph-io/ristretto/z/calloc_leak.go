// +build leak

package z

import "unsafe"

func init() {
	// By initializing dallocs, we can start tracking allocations and deallocations via z.Calloc.
	dallocs = make(map[unsafe.Pointer]*dalloc)
}
