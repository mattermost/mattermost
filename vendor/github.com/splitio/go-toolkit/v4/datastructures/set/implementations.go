package set

import (
	"sync"
)

var keyExists = struct{}{} // Value that indicates existance in the set for the key element

// ThreadUnsafeSet structure. Container of unique items with O(1) access time. NOT THREAD SAFE
type ThreadUnsafeSet struct {
	set
}

// NewSet Constructs a new set from an optinal slice of items
func NewSet(items ...interface{}) *ThreadUnsafeSet {
	s := &ThreadUnsafeSet{}
	s.m = make(map[interface{}]struct{})
	s.Add(items...)
	return s
}

// Add adds new items to the set
func (s *ThreadUnsafeSet) Add(items ...interface{}) {
	if len(items) == 0 {
		return
	}

	for _, item := range items {
		s.m[item] = keyExists

	}
}

// Remove removes items from the set
func (s *ThreadUnsafeSet) Remove(items ...interface{}) {
	if len(items) == 0 {
		return
	}

	for _, item := range items {
		delete(s.m, item)
	}
}

// Pop removes an item from the set and returns it.
func (s *set) Pop() interface{} {
	for item := range s.m {
		delete(s.m, item)
		return item
	}
	return nil
}

// Has returns true if the items passed are present in the set
func (s *ThreadUnsafeSet) Has(items ...interface{}) bool {
	// assume checked for empty item, which not exist
	if len(items) == 0 {
		return false
	}

	has := true
	for _, item := range items {
		if _, has = s.m[item]; !has {
			break
		}
	}
	return has
}

// Size returns the size of the set
func (s *ThreadUnsafeSet) Size() int {
	return len(s.m)
}

// Clear removes all elements from the set
func (s *ThreadUnsafeSet) Clear() {
	s.m = make(map[interface{}]struct{})
}

// IsEqual returns true if the received set is equal to this one
func (s *ThreadUnsafeSet) IsEqual(t Set) bool {
	// Force locking only if given set is threadsafe.
	if conv, ok := t.(*ThreadSafeSet); ok {
		conv.l.RLock()
		defer conv.l.RUnlock()
	}

	// return false if they are no the same size
	if sameSize := len(s.m) == t.Size(); !sameSize {
		return false
	}

	equal := true
	t.Each(func(item interface{}) bool {
		_, equal = s.m[item]
		return equal // if false, Each() will end
	})

	return equal
}

// IsSubset returns true if the passed set is a subset of this one
func (s *ThreadUnsafeSet) IsSubset(t Set) (subset bool) {
	subset = true

	t.Each(func(item interface{}) bool {
		_, subset = s.m[item]
		return subset
	})

	return subset
}

// Each executes a passed function on each of the items passed.
func (s *ThreadUnsafeSet) Each(f func(item interface{}) bool) {
	for item := range s.m {
		if !f(item) {
			break
		}
	}
}

// List returns a slice of the items in th set
func (s *ThreadUnsafeSet) List() []interface{} {
	list := make([]interface{}, 0, len(s.m))

	for item := range s.m {
		list = append(list, item)
	}

	return list
}

// Copy returns a new set with a copy of the elements
func (s *ThreadUnsafeSet) Copy() Set {
	return NewSet(s.List()...)
}

// Merge adds all the elefements in the passed set to this one.
func (s *ThreadUnsafeSet) Merge(t Set) {
	t.Each(func(item interface{}) bool {
		s.m[item] = keyExists
		return true
	})
}

// Separate removes all the items that are present in the passed set from this set
func (s *ThreadUnsafeSet) Separate(t Set) {
	s.Remove(t.List()...)
}

// IsEmpty returns true if the set has no elements
func (s *ThreadUnsafeSet) IsEmpty() bool {
	return s.Size() == 0
}

// IsSuperset returns true if the passed set is a supertset of this one
func (s *ThreadUnsafeSet) IsSuperset(t Set) bool {
	return t.IsSubset(s)
}

// ** Thread safe implementation

// ThreadSafeSet is a thread safe implementation of the set data structure
type ThreadSafeSet struct {
	set
	l sync.RWMutex
}

// NewThreadSafeSet instantiates a new ThreadSafeSet
func NewThreadSafeSet(items ...interface{}) *ThreadSafeSet {
	s := &ThreadSafeSet{}
	s.m = make(map[interface{}]struct{})

	// Ensure interface compliance
	var _ Set = s

	s.Add(items...)
	return s
}

// Add adds a new element to the set
func (s *ThreadSafeSet) Add(items ...interface{}) {
	if len(items) == 0 {
		return
	}

	s.l.Lock()
	defer s.l.Unlock()

	for _, item := range items {
		s.m[item] = keyExists
	}
}

// Remove deletes an elemenet from the set.
func (s *ThreadSafeSet) Remove(items ...interface{}) {
	if len(items) == 0 {
		return
	}

	s.l.Lock()
	defer s.l.Unlock()

	for _, item := range items {
		delete(s.m, item)
	}
}

// Pop removes an element from the set and returns it
func (s *ThreadSafeSet) Pop() interface{} {
	s.l.RLock()
	for item := range s.m {
		s.l.RUnlock()
		s.l.Lock()
		delete(s.m, item)
		s.l.Unlock()
		return item
	}
	s.l.RUnlock()
	return nil
}

// Has returns true if the element passed is in the set
func (s *ThreadSafeSet) Has(items ...interface{}) bool {
	// assume checked for empty item, which not exist
	if len(items) == 0 {
		return false
	}

	s.l.RLock()
	defer s.l.RUnlock()

	has := true
	for _, item := range items {
		if _, has = s.m[item]; !has {
			break
		}
	}
	return has
}

// Size returns the number of elements in the set
func (s *ThreadSafeSet) Size() int {
	s.l.RLock()
	defer s.l.RUnlock()

	l := len(s.m)
	return l
}

// Clear removes all the elements in the set
func (s *ThreadSafeSet) Clear() {
	s.l.Lock()
	defer s.l.Unlock()

	s.m = make(map[interface{}]struct{})
}

// IsEqual returns true if the set contains the same elements as the passed one
func (s *ThreadSafeSet) IsEqual(t Set) bool {
	s.l.RLock()
	defer s.l.RUnlock()

	// Force locking only if given set is threadsafe.
	if conv, ok := t.(*ThreadSafeSet); ok {
		conv.l.RLock()
		defer conv.l.RUnlock()
	}

	// return false if they are no the same size
	if sameSize := len(s.m) == t.Size(); !sameSize {
		return false
	}

	equal := true
	t.Each(func(item interface{}) bool {
		_, equal = s.m[item]
		return equal // if false, Each() will end
	})

	return equal
}

// IsSubset returns true if the passed set is a subset of this one
func (s *ThreadSafeSet) IsSubset(t Set) (subset bool) {
	s.l.RLock()
	defer s.l.RUnlock()

	subset = true

	t.Each(func(item interface{}) bool {
		_, subset = s.m[item]
		return subset
	})

	return
}

// Each executes the passed function on each item from the set
func (s *ThreadSafeSet) Each(f func(item interface{}) bool) {
	s.l.RLock()
	defer s.l.RUnlock()

	for item := range s.m {
		if !f(item) {
			break
		}
	}
}

// List returns a list with all the elements of the set
func (s *ThreadSafeSet) List() []interface{} {
	s.l.RLock()
	defer s.l.RUnlock()

	list := make([]interface{}, 0, len(s.m))

	for item := range s.m {
		list = append(list, item)
	}

	return list
}

// Merge adds all the elements of the passed set into this one
func (s *ThreadSafeSet) Merge(t Set) {
	s.l.Lock()
	defer s.l.Unlock()

	t.Each(func(item interface{}) bool {
		s.m[item] = keyExists
		return true
	})
}

// Copy returns a copy of the this thread
func (s *ThreadSafeSet) Copy() Set {
	return NewThreadSafeSet(s.List()...)
}

// Separate removes all the items that are present in the passed set from this set
func (s *ThreadSafeSet) Separate(t Set) {
	s.Remove(t.List()...)
}

// IsEmpty returns true if the set has no elements
func (s *ThreadSafeSet) IsEmpty() bool {
	return s.Size() == 0
}

// IsSuperset returns true if the passed set is a supertset of this one
func (s *ThreadSafeSet) IsSuperset(t Set) bool {
	return t.IsSubset(s)
}
