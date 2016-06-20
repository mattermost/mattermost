// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Copy of go/src/pkg/sort/sort.go, specialized for []int
// and to remove some array indexing.

package main

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Insertion sort
func insertionSort(data []int, a, b int) {
	for i := a + 1; i < b; i++ {
		for j := i; j > a && data[j] < data[j-1]; j-- {
			data[j], data[j-1] = data[j-1], data[j]
		}
	}
}

// siftDown implements the heap property on data[lo, hi).
// first is an offset into the array where the root of the heap lies.
func siftDown(data []int, lo, hi, first int) {
	root := lo
	for {
		child := 2*root + 1
		if child >= hi {
			break
		}
		if child+1 < hi && data[first+child] < data[first+child+1] {
			child++
		}
		if !(data[first+root] < data[first+child]) {
			return
		}
		data[first+root], data[first+child] = data[first+child], data[first+root]
		root = child
	}
}

func heapSort(data []int, a, b int) {
	first := a
	lo := 0
	hi := b - a

	// Build heap with greatest element at top.
	for i := (hi - 1) / 2; i >= 0; i-- {
		siftDown(data, i, hi, first)
	}

	// Pop elements, largest first, into end of data.
	for i := hi - 1; i >= 0; i-- {
		data[first], data[first+i] = data[first+i], data[first]
		siftDown(data, lo, i, first)
	}
}

// Quicksort, following Bentley and McIlroy,
// ``Engineering a Sort Function,'' SP&E November 1993.

// medianOfThree moves the median of the three values data[a], data[b], data[c] into data[a].
func medianOfThree(data []int, a, b, c int) {
	m0 := b
	m1 := a
	m2 := c
	// bubble sort on 3 elements
	if data[m1] < data[m0] {
		data[m1], data[m0] = data[m0], data[m1]
	}
	if data[m2] < data[m1] {
		data[m2], data[m1] = data[m1], data[m2]
	}
	if data[m1] < data[m0] {
		data[m1], data[m0] = data[m0], data[m1]
	}
	// now data[m0] <= data[m1] <= data[m2]
}

func swapRange(data []int, a, b, n int) {
	for i := 0; i < n; i++ {
		data[a+i], data[b+i] = data[b+i], data[a+i]
	}
}

func doPivot(data []int, lo, hi int) (midlo, midhi int) {
	m := lo + (hi-lo)/2 // Written like this to avoid integer overflow.
	if hi-lo > 40 {
		// Tukey's ``Ninther,'' median of three medians of three.
		s := (hi - lo) / 8
		medianOfThree(data, lo, lo+s, lo+2*s)
		medianOfThree(data, m, m-s, m+s)
		medianOfThree(data, hi-1, hi-1-s, hi-1-2*s)
	}
	medianOfThree(data, lo, m, hi-1)

	// Invariants are:
	//	data[lo] = pivot (set up by ChoosePivot)
	//	data[lo <= i < a] = pivot
	//	data[a <= i < b] < pivot
	//	data[b <= i < c] is unexamined
	//	data[c <= i < d] > pivot
	//	data[d <= i < hi] = pivot
	//
	// Once b meets c, can swap the "= pivot" sections
	// into the middle of the slice.
	pivot := lo
	a, b, c, d := lo+1, lo+1, hi, hi
	dpivot := data[pivot]
	db, dc1 := data[b], data[c-1]
	for b < c {
		if db < dpivot { // data[b] < pivot
			b++
			if b < c {
				db = data[b]
			}
			continue
		}
		if !(dpivot < db) { // data[b] = pivot
			data[a], data[b] = db, data[a]
			a++
			b++
			if b < c {
				db = data[b]
			}
			continue
		}
		if dpivot < dc1 { // data[c-1] > pivot
			c--
			if c > 0 {
				dc1 = data[c-1]
			}
			continue
		}
		if !(dc1 < dpivot) { // data[c-1] = pivot
			data[c-1], data[d-1] = data[d-1], dc1
			c--
			d--
			if c > 0 {
				dc1 = data[c-1]
			}
			continue
		}
		// data[b] > pivot; data[c-1] < pivot
		data[b], data[c-1] = dc1, db
		b++
		c--
		if b < c {
			db = data[b]
			dc1 = data[c-1]
		}
	}

	n := min(b-a, a-lo)
	swapRange(data, lo, b-n, n)

	n = min(hi-d, d-c)
	swapRange(data, c, hi-n, n)

	return lo + b - a, hi - (d - c)
}

func quickSort(data []int, a, b, maxDepth int) {
	for b-a > 7 {
		if maxDepth == 0 {
			heapSort(data, a, b)
			return
		}
		maxDepth--
		mlo, mhi := doPivot(data, a, b)
		// Avoiding recursion on the larger subproblem guarantees
		// a stack depth of at most lg(b-a).
		if mlo-a < b-mhi {
			quickSort(data, a, mlo, maxDepth)
			a = mhi // i.e., quickSort(data, mhi, b)
		} else {
			quickSort(data, mhi, b, maxDepth)
			b = mlo // i.e., quickSort(data, a, mlo)
		}
	}
	if b-a > 1 {
		insertionSort(data, a, b)
	}
}

func sortInts(data []int) {
	// Switch to heapsort if depth of 2*ceil(lg(n)) is reached.
	n := len(data)
	maxDepth := 0
	for 1<<uint(maxDepth) < n {
		maxDepth++
	}
	maxDepth *= 2
	quickSort(data, 0, n, maxDepth)
}
