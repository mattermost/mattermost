package memorystore

import (
	"bytes"
	"encoding/json"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
)

// numRetries is the number of times setAtomicWithRetries will retry before returning an error.
const numRetries = 5

// Store is a implementation of the plugin KV store API for testing.
// It's not meant for production use.
// It is safe for concurrent use by multiple goroutine.
type Store struct {
	mux   sync.RWMutex
	elems map[string]elem
}

type elem struct {
	value     []byte
	expiresAt *time.Time
}

func (e elem) isExpired() bool {
	return e.expiresAt != nil && e.expiresAt.Before(time.Now())
}

// Set stores a key-value pair, unique per plugin.
// Keys prefixed with `mmi_` are reserved for internal use and will fail to be set.
//
// Returns (false, err) if DB error occurred
// Returns (false, nil) if the value was not set
// Returns (true, nil) if the value was set
func (s *Store) Set(key string, value any, options ...pluginapi.KVSetOption) (bool, error) {
	if key == "" {
		return false, errors.New("key must not be empty")
	}

	if strings.HasPrefix(key, pluginapi.InternalKeyPrefix) {
		return false, errors.Errorf("'%s' prefix is not allowed for keys", pluginapi.InternalKeyPrefix)
	}

	if utf8.RuneCountInString(key) > model.KeyValueKeyMaxRunes {
		return false, errors.Errorf("key must not be longer then %d", model.KeyValueKeyMaxRunes)
	}

	opts := pluginapi.KVSetOptions{}
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

	if opts.OldValue != nil {
		oldValueBytes, isOldValueInBytes := opts.OldValue.([]byte)
		if isOldValueInBytes {
			downstreamOpts.OldValue = oldValueBytes
		} else {
			data, err := json.Marshal(opts.OldValue)
			if err != nil {
				return false, errors.Wrapf(err, "failed to marshal value %v", opts.OldValue)
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
		s.elems = make(map[string]elem)
	}

	if !opts.Atomic {
		if value == nil {
			delete(s.elems, key)
		} else {
			s.elems[key] = elem{
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
		s.elems[key] = elem{
			value:     valueBytes,
			expiresAt: expireTime(downstreamOpts.ExpireInSeconds),
		}
	}

	return true, nil
}

func (s *Store) SetAtomicWithRetries(key string, valueFunc func(oldValue []byte) (newValue any, err error)) error {
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

		if saved, err := s.Set(key, newVal, pluginapi.SetAtomic(oldVal)); err != nil {
			return errors.Wrapf(err, "DB failed to set value for key %s", key)
		} else if saved {
			return nil
		}

		// small delay to allow cooperative scheduling to do its thing
		time.Sleep(10 * time.Millisecond)
	}
	return errors.Errorf("failed to set value after %d retries", numRetries)
}

func (s *Store) ListKeys(page int, count int, options ...pluginapi.ListKeysOption) ([]string, error) {
	if page < 0 {
		return nil, errors.New("page number must not be negative")
	}

	if count < 0 {
		return nil, errors.New("count must not be negative")
	}

	if count == 0 {
		return []string{}, nil
	}

	opt := pluginapi.ListKeysOptions{}
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

	// TODO: Use slices.Sort once the toolchain got updated to go1.21
	sort.Strings(allKeys)

	pageKeys := paginateSlice(allKeys, page, count)

	if len(opt.Checkers) == 0 {
		return pageKeys, nil
	}

	n := 0
	for _, k := range pageKeys {
		keep := true
		for _, c := range opt.Checkers {
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

func (s *Store) Get(key string, o any) error {
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

func (s *Store) Delete(key string) error {
	s.mux.Lock()
	delete(s.elems, key)
	s.mux.Unlock()

	return nil
}

// DeleteAll removes all key-value pairs.
func (s *Store) DeleteAll() error {
	s.mux.Lock()
	s.elems = make(map[string]elem)
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
