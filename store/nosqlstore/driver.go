// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package nosqlstore

import (
	"errors"
)

var ErrAlreadyExists = errors.New("already exists")
var ErrNotFound = errors.New("not found")

type RangeOrder int

const (
	RANGE_ORDER_ASC RangeOrder = iota
	RANGE_ORDER_DESC
)

type RangeKey struct {
	Min        []byte
	ExcludeMin bool
	Max        []byte
	ExcludeMax bool
	Order      RangeOrder
	Offset     int
	Limit      int
}

func Range(min, max []byte) *RangeKey {
	return &RangeKey{Min: min, Max: max}
}

func RangeLessThan(key []byte) *RangeKey {
	return &RangeKey{Max: key, ExcludeMax: true}
}

func RangeLessThanOrEqualTo(key []byte) *RangeKey {
	return &RangeKey{Max: key}
}

func RangeEqualTo(key []byte) *RangeKey {
	return &RangeKey{Min: key, Max: key}
}

func RangeGreaterThanOrEqual(key []byte) *RangeKey {
	return &RangeKey{Min: key}
}

func RangeGreaterThan(key []byte) *RangeKey {
	return &RangeKey{Min: key, ExcludeMin: true}
}

func RangeSubset(offset, limit int) *RangeKey {
	return &RangeKey{
		Offset: offset,
		Limit:  limit,
	}
}

func (k RangeKey) Subset(offset, limit int) *RangeKey {
	k.Offset = offset
	k.Limit = limit
	return &k
}

type LookupResult struct {
	TotalCount *int
}

type ObjectStore interface {
	// Count returns the number of objects indexed by the given keys.
	Count(index string, hashKey []byte, rangeKey *RangeKey) (int, error)

	// Delete deletes an object by id.
	Delete(id string) error

	// Get gets an object by id.
	Get(id string, dest interface{}) error

	// Lookup gets the objects indexed by the given keys. If no range key is given, all results in
	// ascending order from the beginning will be returned.
	Lookup(index string, hashKey []byte, rangeKey *RangeKey, dest interface{}) error

	// Upsert inserts or updates an object.
	Upsert(id string, object interface{}) error

	// AddIndex creates a named index for each object.
	//
	// The function should return two elements: The hash key can be used to perform lookups based on
	// exact matches. The range key is used to order elements matches by the hash key. Objects with
	// the same hash key cannot have the same range key.
	//
	// If the index does not already exist, re-indexing will occur.
	AddIndex(name string, keys func(interface{}) (hashKey []byte, rangeKey []byte)) error
}

type Driver interface {
	// ObjectStore returns an object store with the given name.
	ObjectStore(name string, serialize func(interface{}) ([]byte, error), deserialize func([]byte) (interface{}, error)) ObjectStore
}
