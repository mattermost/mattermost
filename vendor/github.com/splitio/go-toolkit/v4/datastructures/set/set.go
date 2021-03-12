package set

// Set interface shared between Thread-Safe and Thread-Unsafe implementations
type Set interface {
	Add(items ...interface{})
	Remove(items ...interface{})
	Pop() interface{}
	Has(items ...interface{}) bool
	Size() int
	Clear()
	IsEmpty() bool
	IsEqual(s Set) bool
	IsSubset(s Set) bool
	IsSuperset(s Set) bool
	Each(func(interface{}) bool)
	List() []interface{}
	Copy() Set
	Merge(s Set)
	Separate(t Set)
}

type set struct {
	m map[interface{}]struct{}
}
