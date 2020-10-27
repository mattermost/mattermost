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
	"math"
	"os"
	"strings"
	"unsafe"
)

var (
	pageSize = os.Getpagesize()
	maxKeys  = (pageSize / 16) - 1
)

// Tree represents the structure for custom mmaped B+ tree.
// It supports keys in range [1, math.MaxUint64-1] and values [1, math.Uint64].
type Tree struct {
	mf       *MmapFile
	nextPage uint64
}

// NewTree returns a memory mapped B+ tree.
func NewTree(mf *MmapFile) *Tree {
	// Tell kernel that we'd be reading pages in random order, so don't do read ahead.
	check(Madvise(mf.Data, false))
	t := &Tree{
		mf:       mf,
		nextPage: 1,
	}
	t.newNode(0)

	// This acts as the rightmost pointer (all the keys are <= this key).
	t.Set(math.MaxUint64-1, 0)
	return t
}

// NumPages returns the number of pages in a B+ tree.
func (t *Tree) NumPages() int {
	return int(t.nextPage - 1)
}

func (t *Tree) newNode(bit byte) node {
	offset := int(t.nextPage) * pageSize
	t.nextPage++
	n := node(t.mf.Data[offset : offset+pageSize])
	ZeroOut(n, 0, len(n))
	n.setBit(bitUsed | bit)
	n.setAt(keyOffset(maxKeys), t.nextPage-1)
	return n
}

func (t *Tree) node(pid uint64) node {
	// page does not exist
	if pid == 0 {
		return nil
	}
	start := pageSize * int(pid)
	return node(t.mf.Data[start : start+pageSize])
}

// Set sets the key-value pair in the tree.
func (t *Tree) Set(k, v uint64) {
	if k == math.MaxUint64 || k == 0 {
		panic("Error setting zero or MaxUint64")
	}
	root := t.node(1)
	t.set(root, k, v)
	if root.isFull() {
		right := t.split(root)
		left := t.newNode(root.bits())
		copy(left[:keyOffset(maxKeys)], root)
		left.setNumKeys(root.numKeys())

		// reset the root node.
		part := root[:keyOffset(maxKeys)]
		ZeroOut(part, 0, len(part))
		root.setNumKeys(0)

		// set the pointers for left and right child in the root node.
		root.set(left.maxKey(), left.pageID())
		root.set(right.maxKey(), right.pageID())
	}
}

// For internal nodes, they contain <key, ptr>.
// where all entries <= key are stored in the corresponding ptr.
func (t *Tree) set(n node, k, v uint64) {
	if n.isLeaf() {
		n.set(k, v)
		return
	}

	// This is an internal node.
	idx := n.search(k)
	if idx >= maxKeys {
		panic("search returned index >= maxKeys")
	}
	// If no key at idx.
	if n.key(idx) == 0 {
		n.setAt(keyOffset(idx), k)
		n.setNumKeys(n.numKeys() + 1)
	}
	child := t.node(n.uint64(valOffset(idx)))
	if child == nil {
		child = t.newNode(bitLeaf)
		n.setAt(valOffset(idx), child.pageID())
	}
	t.set(child, k, v)

	if child.isFull() {
		nn := t.split(child)

		// Set child pointers in the node n.
		// Note that key for right node (nn) already exist in node n, but the
		// pointer is updated.
		n.set(child.maxKey(), child.pageID())
		n.set(nn.maxKey(), nn.pageID())
	}
}

// Get looks for key and returns the corresponding value.
// If key is not found, 0 is returned.
func (t *Tree) Get(k uint64) uint64 {
	if k == math.MaxUint64 || k == 0 {
		panic("Does not support getting MaxUint64/Zero")
	}
	root := t.node(1)
	return t.get(root, k)
}

func (t *Tree) get(n node, k uint64) uint64 {
	if n.isLeaf() {
		return n.get(k)
	}
	// This is internal node
	idx := n.search(k)
	if idx == n.numKeys() || n.key(idx) == 0 {
		return 0
	}
	child := t.node(n.uint64(valOffset(idx)))
	assert(child != nil)
	return t.get(child, k)
}

// DeleteBelow deletes all keys with value under ts.
func (t *Tree) DeleteBelow(ts uint64) {
	fn := func(n node) {
		n.compact(ts)
	}
	t.Iterate(fn)
}

func (t *Tree) iterate(n node, fn func(node)) {
	if n.isLeaf() {
		fn(n)
		return
	}
	for i := 0; i < maxKeys; i++ {
		if n.key(i) == 0 {
			return
		}
		childID := n.uint64(valOffset(i))
		child := t.node(childID)
		t.iterate(child, fn)
	}
}

// Iterate iterates over the tree and executes the fn on each leaf node. It is
// the responsibility of caller to iterate over all the kvs in a leaf node.
func (t *Tree) Iterate(fn func(node)) {
	root := t.node(1)
	t.iterate(root, fn)
}

func (t *Tree) print(n node, parentID uint64) {
	n.print(parentID)
	if n.isLeaf() {
		return
	}
	pid := n.pageID()
	for i := 0; i < maxKeys; i++ {
		if n.key(i) == 0 {
			return
		}
		childID := n.uint64(valOffset(i))
		child := t.node(childID)
		t.print(child, pid)
	}
}

// Print iterates over the tree and prints all valid KVs.
func (t *Tree) Print() {
	root := t.node(1)
	t.print(root, 0)
}

// Splits the node into two. It moves right half of the keys from the original node to a newly
// created right node. It returns the right node.
func (t *Tree) split(n node) node {
	if !n.isFull() {
		panic("This should be called only when n is full")
	}
	rightHalf := n[keyOffset(maxKeys/2):keyOffset(maxKeys)]

	// Create a new node nn, copy over half the keys from n, and set the parent to n's parent.
	nn := t.newNode(n.bits())
	copy(nn, rightHalf)
	nn.setNumKeys(maxKeys - maxKeys/2)

	// Remove entries from node n.
	ZeroOut(rightHalf, 0, len(rightHalf))
	n.setNumKeys(maxKeys / 2)
	return nn
}

// Each node in the node is of size pageSize. Two kinds of nodes. Leaf nodes and internal nodes.
// Leaf nodes only contain the data. Internal nodes would contain the key and the offset to the
// child node.
// Internal node would have first entry as
// <0 offset to child>, <1000 offset>, <5000 offset>, and so on...
// Leaf nodes would just have: <key, value>, <key, value>, and so on...
// Last 16 bytes of the node are off limits.
// | pageID (8 bytes) | metaBits (1 byte) | 3 free bytes | numKeys (4 bytes) |
type node []byte

func (n node) uint64(start int) uint64 { return *(*uint64)(unsafe.Pointer(&n[start])) }
func (n node) uint32(start int) uint32 { return *(*uint32)(unsafe.Pointer(&n[start])) }

func keyOffset(i int) int        { return 16 * i }
func valOffset(i int) int        { return 16*i + 8 }
func (n node) numKeys() int      { return int(n.uint32(valOffset(maxKeys) + 4)) }
func (n node) pageID() uint64    { return n.uint64(keyOffset(maxKeys)) }
func (n node) key(i int) uint64  { return n.uint64(keyOffset(i)) }
func (n node) val(i int) uint64  { return n.uint64(valOffset(i)) }
func (n node) id() uint64        { return n.key(maxKeys) }
func (n node) data(i int) []byte { return n[keyOffset(i):keyOffset(i+1)] }

func (n node) setAt(start int, k uint64) {
	v := (*uint64)(unsafe.Pointer(&n[start]))
	*v = k
}

func (n node) setNumKeys(num int) {
	start := valOffset(maxKeys) + 4
	v := (*uint32)(unsafe.Pointer(&n[start]))
	*v = uint32(num)
}

func (n node) moveRight(lo int) {
	hi := n.numKeys()
	assert(hi != maxKeys)
	// copy works despite of overlap in src and dst.
	// See https://golang.org/pkg/builtin/#copy
	copy(n[keyOffset(lo+1):keyOffset(hi+1)], n[keyOffset(lo):keyOffset(hi)])
}

const (
	bitUsed = byte(1)
	bitLeaf = byte(2)
)

func (n node) setBit(b byte) {
	vo := valOffset(maxKeys)
	n[vo] |= b
}
func (n node) bits() byte {
	vo := valOffset(maxKeys)
	return n[vo]
}
func (n node) isLeaf() bool {
	return n.bits()&bitLeaf > 0
}

// isFull checks that the node is already full.
func (n node) isFull() bool {
	return n.numKeys() == maxKeys
}

// Search returns the index of a smallest key >= k in a node.
func (n node) search(k uint64) int {
	N := n.numKeys()
	lo, hi := 0, N
	// Reduce the search space using binary seach and then do linear search.
	for hi-lo > 32 {
		mid := (hi + lo) / 2
		km := n.key(mid)
		if k == km {
			return mid
		}
		if k > km {
			// key is greater than the key at mid, so move right.
			lo = mid + 1
		} else {
			// else move left.
			hi = mid
		}
	}
	for i := lo; i <= hi; i++ {
		if ki := n.key(i); ki >= k {
			return i
		}
	}
	return N
}
func (n node) maxKey() uint64 {
	idx := n.numKeys()
	// idx points to the first key which is zero.
	if idx > 0 {
		idx--
	}
	return n.key(idx)
}

// compacts the node i.e., remove all the kvs with value <= lo. It returns the remaining number of
// keys.
func (n node) compact(lo uint64) int {
	// compact should be called only on leaf nodes
	assert(n.isLeaf())
	mk := n.maxKey()
	var left, right int
	for right = 0; right < maxKeys; right++ {
		k, v := n.key(right), n.val(right)
		if k == 0 {
			break
		}
		if v <= lo && k < mk {
			// Skip over this key. Don't copy it.
			continue
		}
		// Valid data. Copy it from right to left. Advance left.
		if left != right {
			copy(n.data(left), n.data(right))
		}
		left++
	}
	// zero out rest of the kv pairs.
	ZeroOut(n, keyOffset(left), keyOffset(right))
	n.setNumKeys(left)
	return left
}

func (n node) get(k uint64) uint64 {
	idx := n.search(k)
	// key is not found
	if idx == n.numKeys() {
		return 0
	}
	if ki := n.key(idx); ki == k {
		return n.val(idx)
	}
	return 0
}

func (n node) set(k, v uint64) {
	idx := n.search(k)
	ki := n.key(idx)
	if n.numKeys() == maxKeys {
		// This happens during split of non-root node, when we are updating the child pointer of
		// right node. Hence, the key should already exist.
		assert(ki == k)
	}
	if ki > k {
		// Found the first entry which is greater than k. So, we need to fit k
		// just before it. For that, we should move the rest of the data in the
		// node to the right to make space for k.
		n.moveRight(idx)
	}
	// If the k does not exist already, increment the number of keys.
	if ki != k {
		n.setNumKeys(n.numKeys() + 1)
	}
	if ki == 0 || ki >= k {
		n.setAt(keyOffset(idx), k)
		n.setAt(valOffset(idx), v)
		return
	}
	panic("shouldn't reach here")
}

func (n node) iterate(fn func(node, int)) {
	for i := 0; i < maxKeys; i++ {
		if k := n.key(i); k > 0 {
			fn(n, i)
		} else {
			break
		}
	}
}

func (n node) print(parentID uint64) {
	var keys []string
	n.iterate(func(n node, i int) {
		keys = append(keys, fmt.Sprintf("%d", n.key(i)))
	})
	if len(keys) > 8 {
		copy(keys[4:], keys[len(keys)-4:])
		keys[3] = "..."
		keys = keys[:8]
	}
	fmt.Printf("%d Child of: %d bits: %04b num keys: %d keys: %s\n",
		n.pageID(), parentID, n.bits(), n.numKeys(), strings.Join(keys, " "))
}
