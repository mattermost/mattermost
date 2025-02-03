package pluginapi

import (
	"bytes"
	"encoding/json"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/pkg/errors"
)

// MemoryStore is an implementation of the plugin KV store API for testing.
// It's not meant for production use.
// It's safe for concurrent use by multiple goroutines.
type MemoryStore struct {
	mux   sync.RWMutex
	elems map[string]kvElem
}

type kvElem struct {
	value     []byte
	expiresAt *time.Time
}

func (e kvElem) isExpired() bool {
	return e.expiresAt != nil && e.expiresAt.Before(time.Now())
}

// Set stores a key-value pair, unique per plugin.
// Keys prefixed with `mmi_` are reserved for internal use and will fail to be set.
//
// Returns (false, err) if DB error occurred
// Returns (false, nil) if the value was not set
// Returns (true, nil) if the value was set
func (s *MemoryStore) Set(key string, value any, options ...KVSetOption) (bool, error) {
	if key == "" {
		return false, errors.New("key must not be empty")
	}

	if strings.HasPrefix(key, internalKeyPrefix) {
		return false, errors.Errorf("'%s' prefix is not allowed for keys", internalKeyPrefix)
	}

	if utf8.RuneCountInString(key) > model.KeyValueKeyMaxRunes {
		return false, errors.Errorf("key must not be longer then %d", model.KeyValueKeyMaxRunes)
	}

	opts := KVSetOptions{}
	for _, o := range options {
		if o != nil {
			o(&opts)
		}
	}

	var valueBytes []byte
	if value != nil {
		// Assume JSON encoding, unless explicitly given a byte slice.
		var isValueInBytes bool
		valueBytes, isValueInBytes = value.([]byte)
		if !isValueInBytes {
			var err error
			valueBytes, err = json.Marshal(value)
			if err != nil {
				return false, errors.Wrapf(err, "failed to marshal value %v", value)
			}
		}
	}

	downstreamOpts := model.PluginKVSetOptions{
		Atomic:          opts.Atomic,
		ExpireInSeconds: opts.ExpireInSeconds,
	}

	if opts.oldValue != nil {
		oldValueBytes, isOldValueInBytes := opts.oldValue.([]byte)
		if isOldValueInBytes {
			downstreamOpts.OldValue = oldValueBytes
		} else {
			data, err := json.Marshal(opts.oldValue)
			if err != nil {
				return false, errors.Wrapf(err, "failed to marshal value %v", opts.oldValue)
			}

			downstreamOpts.OldValue = data
		}
	}

	if err := downstreamOpts.IsValid(); err != nil {
		return false, err
	}

	s.mux.Lock()
	defer s.mux.Unlock()

	if s.elems == nil {
		s.elems = make(map[string]kvElem)
	}

	if !opts.Atomic {
		if value == nil {
			delete(s.elems, key)
		} else {
			s.elems[key] = kvElem{
				value:     valueBytes,
				expiresAt: expireTime(downstreamOpts.ExpireInSeconds),
			}
		}

		return true, nil
	}

	oldElem := s.elems[key]
	if !oldElem.isExpired() && !bytes.Equal(oldElem.value, downstreamOpts.OldValue) {
		return false, nil
	}

	if value == nil {
		delete(s.elems, key)
	} else {
		s.elems[key] = kvElem{
			value:     valueBytes,
			expiresAt: expireTime(downstreamOpts.ExpireInSeconds),
		}
	}

	return true, nil
}

func (s *MemoryStore) SetAtomicWithRetries(key string, valueFunc func(oldValue []byte) (newValue any, err error)) error {
	if valueFunc == nil {
		return errors.New("function must not be nil")
	}

	for i := 0; i < numRetries; i++ {
		var oldVal []byte
		if err := s.Get(key, &oldVal); err != nil {
			return errors.Wrapf(err, "failed to get value for key %s", key)
		}

		newVal, err := valueFunc(oldVal)
		if err != nil {
			return errors.Wrap(err, "valueFunc failed")
		}

		if saved, err := s.Set(key, newVal, SetAtomic(oldVal)); err != nil {
			return errors.Wrapf(err, "DB failed to set value for key %s", key)
		} else if saved {
			return nil
		}

		// small delay to allow cooperative scheduling to do its thing
		time.Sleep(10 * time.Millisecond)
	}
	return errors.Errorf("failed to set value after %d retries", numRetries)
}

func (s *MemoryStore) ListKeys(page int, count int, options ...ListKeysOption) ([]string, error) {
	if page < 0 {
		return nil, errors.New("page number must not be negative")
	}

	if count < 0 {
		return nil, errors.New("count must not be negative")
	}

	if count == 0 {
		return []string{}, nil
	}

	opt := listKeysOptions{}
	for _, o := range options {
		if o != nil {
			o(&opt)
		}
	}

	allKeys := make([]string, 0)
	s.mux.RLock()
	for k, e := range s.elems {
		if e.isExpired() {
			continue
		}
		allKeys = append(allKeys, k)
	}
	s.mux.RUnlock()

	if len(allKeys) == 0 {
		return []string{}, nil
	}

	slices.Sort(allKeys)

	pageKeys := paginateSlice(allKeys, page, count)

	if len(opt.checkers) == 0 {
		return pageKeys, nil
	}

	n := 0
	for _, k := range pageKeys {
		keep := true
		for _, c := range opt.checkers {
			ok, err := c(k)
			if err != nil {
				return nil, err
			}
			if !ok {
				keep = false
				break
			}
		}

		if keep {
			pageKeys[n] = k
			n++
		}
	}

	return pageKeys[:n], nil
}

func (s *MemoryStore) Get(key string, o any) error {
	s.mux.RLock()
	e, ok := s.elems[key]
	s.mux.RUnlock()
	if !ok || len(e.value) == 0 || e.isExpired() {
		return nil
	}

	if bytesOut, ok := o.(*[]byte); ok {
		*bytesOut = e.value
		return nil
	}

	if err := json.Unmarshal(e.value, o); err != nil {
		return errors.Wrapf(err, "failed to unmarshal value for key %s", key)
	}

	return nil
}

func (s *MemoryStore) Delete(key string) error {
	s.mux.Lock()
	delete(s.elems, key)
	s.mux.Unlock()

	return nil
}

// DeleteAll removes all key-value pairs.
func (s *MemoryStore) DeleteAll() error {
	s.mux.Lock()
	s.elems = make(map[string]kvElem)
	s.mux.Unlock()

	return nil
}

func expireTime(expireInSeconds int64) *time.Time {
	if expireInSeconds == 0 {
		return nil
	}
	t := time.Now().Add(time.Second * time.Duration(expireInSeconds))
	return &t
}

func paginateSlice[T any](list []T, page int, perPage int) []T {
	i := page * perPage
	j := (page + 1) * perPage
	l := len(list)
	if j > l {
		j = l
	}
	if i > l {
		i = l
	}
	return list[i:j]
}
