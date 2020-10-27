/*
 * Copyright 2020 Dgraph Labs, Inc. and Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package z

import (
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/dustin/go-humanize"
)

// Allocator amortizes the cost of small allocations by allocating memory in bigger chunks.
// Internally it uses z.Calloc to allocate memory. Once allocated, the memory is not moved,
// so it is safe to use the allocated bytes to unsafe cast them to Go struct pointers.
type Allocator struct {
	pageSize int
	curBuf   int
	curIdx   int
	buffers  [][]byte
	size     uint64
	Ref      uint64
	Tag      string
}

// allocs keeps references to all Allocators, so we can safely discard them later.
var allocsMu *sync.Mutex
var allocRef uint64
var allocs map[uint64]*Allocator

func init() {
	allocsMu = new(sync.Mutex)
	allocs = make(map[uint64]*Allocator)

	// Set up a unique Ref per process.
	rand.Seed(time.Now().UnixNano())
	allocRef = uint64(rand.Int63n(1<<16)) << 48
	fmt.Printf("Using z.Allocator with starting ref: %x\n", allocRef)
}

// NewAllocator creates an allocator starting with the given size.
func NewAllocator(sz int) *Allocator {
	ref := atomic.AddUint64(&allocRef, 1)
	a := &Allocator{
		pageSize: sz,
		Ref:      ref,
	}

	allocsMu.Lock()
	allocs[ref] = a
	allocsMu.Unlock()
	return a
}

func PrintAllocators() {
	allocsMu.Lock()
	tags := make(map[string]int)
	var total uint64
	for _, ac := range allocs {
		tags[ac.Tag]++
		total += ac.Allocated()
	}
	for tag, count := range tags {
		fmt.Printf("Allocator Tag: %s Count: %d\n", tag, count)
	}
	fmt.Printf("Total allocators: %d. Total Size: %s\n",
		len(allocs), humanize.IBytes(total))
	allocsMu.Unlock()
}

// AllocatorFrom would return the allocator corresponding to the ref.
func AllocatorFrom(ref uint64) *Allocator {
	allocsMu.Lock()
	a := allocs[ref]
	allocsMu.Unlock()
	return a
}

// Size returns the size of the allocations so far.
func (a *Allocator) Size() uint64 {
	return a.size
}

func (a *Allocator) Allocated() uint64 {
	var alloc int
	for _, b := range a.buffers {
		alloc += cap(b)
	}
	return uint64(alloc)
}

// Release would release the memory back. Remember to make this call to avoid memory leaks.
func (a *Allocator) Release() {
	if a == nil {
		return
	}
	for _, b := range a.buffers {
		Free(b)
	}

	allocsMu.Lock()
	delete(allocs, a.Ref)
	allocsMu.Unlock()
}

const maxAlloc = 1 << 30

func (a *Allocator) MaxAlloc() int {
	return maxAlloc
}

const nodeAlign = int(unsafe.Sizeof(uint64(0))) - 1

func (a *Allocator) AllocateAligned(sz int) []byte {
	tsz := sz + nodeAlign
	out := a.Allocate(tsz)
	aligned := (a.curIdx - tsz + nodeAlign) & ^nodeAlign

	start := tsz - (a.curIdx - aligned)
	return out[start : start+sz]
}

func (a *Allocator) Copy(buf []byte) []byte {
	if a == nil {
		return append([]byte{}, buf...)
	}
	out := a.Allocate(len(buf))
	copy(out, buf)
	return out
}

// Allocate would allocate a byte slice of length sz. It is safe to use this memory to unsafe cast
// to Go structs.
func (a *Allocator) Allocate(sz int) []byte {
	if a == nil {
		return make([]byte, sz)
	}
	if len(a.buffers) == 0 {
		buf := Calloc(a.pageSize)
		a.buffers = append(a.buffers, buf)
	}

	if sz >= maxAlloc {
		panic(fmt.Sprintf("Allocate call exceeds max allocation possible."+
			" Requested: %d. Max Allowed: %d\n", sz, maxAlloc))
	}
	cb := a.buffers[a.curBuf]
	if len(cb) < a.curIdx+sz {
		for {
			a.pageSize *= 2 // Do multiply by 2 here.
			if a.pageSize >= sz {
				break
			}
		}
		if a.pageSize > maxAlloc {
			a.pageSize = maxAlloc
		}

		buf := Calloc(a.pageSize)
		a.buffers = append(a.buffers, buf)
		a.curBuf++
		a.curIdx = 0
		cb = a.buffers[a.curBuf]
	}

	slice := cb[a.curIdx : a.curIdx+sz]
	a.curIdx += sz
	a.size += uint64(sz)
	return slice
}
