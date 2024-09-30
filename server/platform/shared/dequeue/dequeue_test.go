// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The following is just a copy of the container/list package
// from the stdlib changed to generic.

// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package dequeue

import "testing"

func checkListLen[T any](t *testing.T, l *List[T], len int) bool {
	if n := l.Len(); n != len {
		t.Errorf("l.Len() = %d, want %d", n, len)
		return false
	}
	return true
}

func checkListPointers[T any](t *testing.T, l *List[T], es []*Element[T]) {
	root := &l.root

	if !checkListLen(t, l, len(es)) {
		return
	}

	// zero length lists must be the zero value or properly initialized (sentinel circle)
	if len(es) == 0 {
		if l.root.next != nil && l.root.next != root || l.root.prev != nil && l.root.prev != root {
			t.Errorf("l.root.next = %p, l.root.prev = %p; both should both be nil or %p", l.root.next, l.root.prev, root)
		}
		return
	}
	// len(es) > 0

	// check internal and external prev/next connections
	for i, e := range es {
		prev := root
		Prev := (*Element[T])(nil)
		if i > 0 {
			prev = es[i-1]
			Prev = prev
		}
		if p := e.prev; p != prev {
			t.Errorf("elt[%d](%p).prev = %p, want %p", i, e, p, prev)
		}
		if p := e.Prev(); p != Prev {
			t.Errorf("elt[%d](%p).Prev() = %p, want %p", i, e, p, Prev)
		}

		next := root
		Next := (*Element[T])(nil)
		if i < len(es)-1 {
			next = es[i+1]
			Next = next
		}
		if n := e.next; n != next {
			t.Errorf("elt[%d](%p).next = %p, want %p", i, e, n, next)
		}
		if n := e.Next(); n != Next {
			t.Errorf("elt[%d](%p).Next() = %p, want %p", i, e, n, Next)
		}
	}
}

func TestList(t *testing.T) {
	l := New[string]()
	checkListPointers(t, l, []*Element[string]{})

	// Single element list
	e := l.PushFront("a")
	checkListPointers(t, l, []*Element[string]{e})
	l.MoveToFront(e)
	checkListPointers(t, l, []*Element[string]{e})
	l.MoveToBack(e)
	checkListPointers(t, l, []*Element[string]{e})
	l.Remove(e)
	checkListPointers(t, l, []*Element[string]{})

	// Bigger list
	e2 := l.PushFront("apple")
	e1 := l.PushFront("orange")
	e3 := l.PushBack("pumpkin")
	e4 := l.PushBack("banana")
	checkListPointers(t, l, []*Element[string]{e1, e2, e3, e4})

	l.Remove(e2)
	checkListPointers(t, l, []*Element[string]{e1, e3, e4})

	l.MoveToFront(e3) // move from middle
	checkListPointers(t, l, []*Element[string]{e3, e1, e4})

	l.MoveToFront(e1)
	l.MoveToBack(e3) // move from middle
	checkListPointers(t, l, []*Element[string]{e1, e4, e3})

	l.MoveToFront(e3) // move from back
	checkListPointers(t, l, []*Element[string]{e3, e1, e4})
	l.MoveToFront(e3) // should be no-op
	checkListPointers(t, l, []*Element[string]{e3, e1, e4})

	l.MoveToBack(e3) // move from front
	checkListPointers(t, l, []*Element[string]{e1, e4, e3})
	l.MoveToBack(e3) // should be no-op
	checkListPointers(t, l, []*Element[string]{e1, e4, e3})

	e2 = l.InsertBefore("apple", e1) // insert before front
	checkListPointers(t, l, []*Element[string]{e2, e1, e4, e3})
	l.Remove(e2)
	e2 = l.InsertBefore("apple", e4) // insert before middle
	checkListPointers(t, l, []*Element[string]{e1, e2, e4, e3})
	l.Remove(e2)
	e2 = l.InsertBefore("apple", e3) // insert before back
	checkListPointers(t, l, []*Element[string]{e1, e4, e2, e3})
	l.Remove(e2)

	e2 = l.InsertAfter("apple", e1) // insert after front
	checkListPointers(t, l, []*Element[string]{e1, e2, e4, e3})
	l.Remove(e2)
	e2 = l.InsertAfter("apple", e4) // insert after middle
	checkListPointers(t, l, []*Element[string]{e1, e4, e2, e3})
	l.Remove(e2)
	e2 = l.InsertAfter("apple", e3) // insert after back
	checkListPointers(t, l, []*Element[string]{e1, e4, e3, e2})
}
