// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package memorystore

import (
	"reflect"
	"strings"
	"sync"

	"github.com/ccbrown/go-immutable"

	"github.com/mattermost/mattermost-server/store/nosqlstore"
)

type Driver struct{}

func (d *Driver) ObjectStore(name string, serialize func(interface{}) ([]byte, error), deserialize func([]byte) (interface{}, error)) nosqlstore.ObjectStore {
	return &ObjectStore{
		objects:     make(map[string][]byte),
		serialize:   serialize,
		deserialize: deserialize,
	}
}

type ObjectStoreIndex struct {
	keys   func(obj interface{}) ([]byte, []byte)
	lookup map[string]*immutable.OrderedMap
}

type ObjectStore struct {
	mutex       sync.RWMutex
	objects     map[string][]byte
	indexes     map[string]*ObjectStoreIndex
	serialize   func(interface{}) ([]byte, error)
	deserialize func([]byte) (interface{}, error)
}

func (s *ObjectStore) Count(index string, hashKey []byte, rangeKey *nosqlstore.RangeKey) (int, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	begin := s.rangeMin(index, hashKey, rangeKey)
	end := s.rangeMax(index, hashKey, rangeKey)
	if begin == nil {
		return 0, nil
	}
	count := begin.CountGreater() - end.CountGreater() + 1
	if rangeKey != nil {
		if rangeKey.Offset >= count {
			return 0, nil
		}
		count -= rangeKey.Offset
		if rangeKey.Limit > 0 && count > rangeKey.Limit {
			return rangeKey.Limit, nil
		}
	}
	return count, nil
}

func (s *ObjectStore) Delete(id string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	return s.delete(id)
}

func (s *ObjectStore) delete(id string) error {
	if obj, ok := s.objects[id]; ok {
		for _, index := range s.indexes {
			deserialized, err := s.deserialize(obj)
			if err != nil {
				return err
			}
			hashKey, rangeKey := index.keys(deserialized)
			index.lookup[string(hashKey)] = index.lookup[string(hashKey)].Delete(string(rangeKey))
		}
		delete(s.objects, id)
	}
	return nil
}

func (s *ObjectStore) Get(id string, dest interface{}) error {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if obj, ok := s.objects[id]; ok {
		deserialized, err := s.deserialize(obj)
		if err != nil {
			return err
		}
		objv := reflect.ValueOf(deserialized)
		destv := reflect.ValueOf(dest).Elem()
		if destv.Type() == objv.Type() {
			destv.Set(objv)
		} else {
			destv.Set(objv.Elem())
		}
		return nil
	}

	return nosqlstore.ErrNotFound
}

func (s *ObjectStore) insert(id string, object interface{}) error {
	if _, ok := s.objects[id]; ok {
		return nosqlstore.ErrAlreadyExists
	}
	data, err := s.serialize(object)
	if err != nil {
		return err
	}
	s.objects[id] = data
	for _, index := range s.indexes {
		hashKey, rangeKey := index.keys(object)
		index.lookup[string(hashKey)] = index.lookup[string(hashKey)].Set(string(rangeKey), id)
	}
	return nil
}

func (s *ObjectStore) Lookup(index string, hashKey []byte, rangeKey *nosqlstore.RangeKey, dest interface{}) error {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	var ids []string
	if err := s.iterate(index, hashKey, rangeKey, func(id string) {
		ids = append(ids, id)
	}); err != nil {
		return err
	}

	v := reflect.ValueOf(dest).Elem()
	t := reflect.TypeOf(dest).Elem()
	v.Set(reflect.MakeSlice(t, len(ids), len(ids)))
	for i, id := range ids {
		obj, err := s.deserialize(s.objects[id])
		if err != nil {
			return err
		}
		v.Index(i).Set(reflect.ValueOf(obj))
	}

	return nil
}

func (s *ObjectStore) rangeMax(index string, hashKey []byte, rangeKey *nosqlstore.RangeKey) *immutable.OrderedMapElement {
	lookup := s.indexes[index].lookup[string(hashKey)]

	if rangeKey == nil || rangeKey.Max == nil {
		return lookup.Max()
	}

	ret := lookup.MaxBefore(string(rangeKey.Max))
	if !rangeKey.ExcludeMax {
		var next *immutable.OrderedMapElement
		if ret == nil {
			next = lookup.Min()
		} else {
			next = ret.Next()
		}
		if next != nil && next.Key().(string) == string(rangeKey.Max) {
			return next
		}
	}
	return ret
}

func (s *ObjectStore) rangeMin(index string, hashKey []byte, rangeKey *nosqlstore.RangeKey) *immutable.OrderedMapElement {
	lookup := s.indexes[index].lookup[string(hashKey)]

	if rangeKey == nil || rangeKey.Min == nil {
		return lookup.Min()
	}

	ret := lookup.MinAfter(string(rangeKey.Min))
	if !rangeKey.ExcludeMin {
		var prev *immutable.OrderedMapElement
		if ret == nil {
			prev = lookup.Max()
		} else {
			prev = ret.Prev()
		}
		if prev != nil && prev.Key().(string) == string(rangeKey.Min) {
			return prev
		}
	}
	return ret
}

func (s *ObjectStore) iterate(index string, hashKey []byte, rangeKey *nosqlstore.RangeKey, f func(string)) error {
	var offset, limit int
	var order nosqlstore.RangeOrder

	if rangeKey != nil {
		order = rangeKey.Order
		offset = rangeKey.Offset
		limit = rangeKey.Limit
	}

	if order == nosqlstore.RANGE_ORDER_ASC {
		next := s.rangeMin(index, hashKey, rangeKey)

		for i := 0; i < offset && next != nil; i++ {
			next = next.Next()
		}

		for i := 0; next != nil; i++ {
			if limit > 0 && i >= limit {
				break
			} else if rangeKey != nil && rangeKey.Max != nil {
				cmp := strings.Compare(next.Key().(string), string(rangeKey.Max))
				if cmp == 1 || (rangeKey.ExcludeMax && cmp == 0) {
					break
				}
			}
			f(next.Value().(string))
			next = next.Next()
		}
	} else {
		next := s.rangeMax(index, hashKey, rangeKey)

		for i := 0; i < offset && next != nil; i++ {
			next = next.Prev()
		}

		for i := 0; next != nil; i++ {
			if limit > 0 && i >= limit {
				break
			} else if rangeKey != nil && rangeKey.Min != nil {
				cmp := strings.Compare(next.Key().(string), string(rangeKey.Min))
				if cmp == -1 || (rangeKey.ExcludeMin && cmp == 0) {
					break
				}
			}
			f(next.Value().(string))
			next = next.Prev()
		}
	}

	return nil
}

func (s *ObjectStore) Upsert(id string, object interface{}) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if err := s.delete(id); err != nil {
		return err
	}
	return s.insert(id, object)
}

func (s *ObjectStore) AddIndex(name string, keys func(interface{}) (hashKey []byte, rangeKey []byte)) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.indexes == nil {
		s.indexes = make(map[string]*ObjectStoreIndex)
	}
	s.indexes[name] = &ObjectStoreIndex{
		keys:   keys,
		lookup: make(map[string]*immutable.OrderedMap),
	}
	return nil
}
