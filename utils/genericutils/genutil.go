// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package genericutils

import (
	"fmt"
	"sort"

	"golang.org/x/exp/constraints"
)

type sorter[T constraints.Ordered] []T

func (s sorter[T]) Len() int {
	return len(s)
}

func (s sorter[T]) Less(a, b int) bool {
	return s[a] < s[b]
}

func (s sorter[T]) Swap(a, b int) {
	s[a], s[b] = s[b], s[a]
}

func Sort[T constraints.Ordered](sl []T) {
	sort.Sort(sorter[T](sl))
}

func SortRev[T constraints.Ordered](sl []T) {
	sort.Sort(sort.Reverse(sorter[T](sl)))
}

type sorterBy[T any, U constraints.Ordered] struct {
	sl []T
	by func(T) U
}

func (s sorterBy[T, U]) Len() int {
	return len(s.sl)
}

func (s sorterBy[T, U]) Less(a, b int) bool {
	return s.by(s.sl[a]) < s.by(s.sl[b])
}

func (s sorterBy[T, U]) Swap(a, b int) {
	s.sl[a], s.sl[b] = s.sl[b], s.sl[a]
}

func SortBy[T any, U constraints.Ordered](sl []T, by func(T) U) {
	s := sorterBy[T, U]{sl, by}
	sort.Sort(s)
}

func SortByRev[T any, U constraints.Ordered](sl []T, by func(T) U) {
	s := sorterBy[T, U]{sl, by}
	sort.Sort(sort.Reverse(s))
}

func Map[T, U any](ts []T, f func(T) U) []U {
	us := make([]U, len(ts))
	for i, t := range ts {
		us[i] = f(t)
	}
	return us
}

func MapSelf[T any](ts []T, f func(T) T) {
	for i, t := range ts {
		ts[i] = f(t)
	}
}

func InsertAt[T any](ts []T, t T, i int) []T {
	if i < 0 || i > len(ts) {
		panic(fmt.Sprintf("genericutils: invalid insert at index %d in slice of length %d", i, len(ts)))
	}

	out := append(ts, t)
	if len(ts) == i {
		return out
	}

	copy(out[i+1:], out[i:])
	out[i] = t

	return out
}

func InsertSorted[T constraints.Ordered](sl []T, elem T) []T {
	i := sort.Search(len(sl), func(i int) bool {
		return elem <= sl[i]
	})
	return InsertAt(sl, elem, i)
}

func InsertSortedRev[T constraints.Ordered](sl []T, elem T) []T {
	i := sort.Search(len(sl), func(i int) bool {
		return elem >= sl[i]
	})
	return InsertAt(sl, elem, i)
}

func InsertSortedBy[T any, U constraints.Ordered](sl []T, elem T, f func(T) U) []T {
	uelem := f(elem)
	i := sort.Search(len(sl), func(i int) bool {
		return uelem <= f(sl[i])
	})
	return InsertAt(sl, elem, i)
}

func InsertSortedByRev[T any, U constraints.Ordered](sl []T, elem T, f func(T) U) []T {
	uelem := f(elem)
	i := sort.Search(len(sl), func(i int) bool {
		return uelem >= f(sl[i])
	})
	return InsertAt(sl, elem, i)
}

func InsertSortedUnique[T constraints.Ordered](sl []T, elem T) []T {
	i := sort.Search(len(sl), func(i int) bool {
		return elem <= sl[i]
	})
	if i < len(sl) && sl[i] == elem {
		return sl
	}

	return InsertAt(sl, elem, i)
}

func InsertSortedRevUnique[T constraints.Ordered](sl []T, elem T) []T {
	i := sort.Search(len(sl), func(i int) bool {
		return elem >= sl[i]
	})
	if i < len(sl) && sl[i] == elem {
		return sl
	}

	return InsertAt(sl, elem, i)
}

func InsertSortedByUnique[T any, U constraints.Ordered](sl []T, elem T, f func(T) U) []T {
	uelem := f(elem)
	i := sort.Search(len(sl), func(i int) bool {
		return uelem <= f(sl[i])
	})
	if i < len(sl) && f(sl[i]) == uelem {
		return sl
	}

	return InsertAt(sl, elem, i)
}

func InsertSortedByRevUnique[T any, U constraints.Ordered](sl []T, elem T, f func(T) U) []T {
	uelem := f(elem)
	i := sort.Search(len(sl), func(i int) bool {
		return uelem >= f(sl[i])
	})
	if i < len(sl) && f(sl[i]) == uelem {
		return sl
	}

	return InsertAt(sl, elem, i)
}

func Contains[T comparable](sl []T, item T) bool {
	for _, e := range sl {
		if e == item {
			return true
		}
	}

	return false
}

func AppendUnique[T comparable](as, bs []T) []T {
	// make space in the slice
	out := append(as, bs...)[:len(as)]

	for _, b := range bs {
		if !Contains(out, b) {
			out = append(out, b)
		}
	}

	return out
}
