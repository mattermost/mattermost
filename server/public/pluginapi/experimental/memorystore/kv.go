package memorystore

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
)

// numRetries is the number of times the setAtomicWithRetries will retry before returning an error.
const numRetries = 5

type Store struct {
	mux   sync.RWMutex
	elems map[string][]byte
}

type elem struct {
	value           []byte
	ExpireInSeconds int64
}

// Set stores a key-value pair, unique per plugin.
// Keys prefixed with `mmi_` are reserved for internal use and will fail to be set.
//
// Returns (false, err) if DB error occurred
// Returns (false, nil) if the value was not set
// Returns (true, nil) if the value was set
func (s *Store) Set(key string, value any, options ...pluginapi.KVSetOption) (bool, error) {
	if strings.HasPrefix(key, pluginapi.InternalKeyPrefix) {
		return false, errors.Errorf("'%s' prefix is not allowed for keys", pluginapi.InternalKeyPrefix)
	}

	s.mux.Lock()
	if s.elems == nil {
		s.elems = make(map[string][]byte)
	}
	s.mux.Unlock()

	opts := pluginapi.KVSetOptions{}
	for _, o := range options {
		o(&opts)
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

	if key == "" {
		return false, errors.New("key must not be empty")
	}
	if utf8.RuneCountInString(key) > model.KeyValueKeyMaxRunes {
		return false, errors.Errorf("key must not be longer then %d", model.KeyValueKeyMaxRunes)
	}

	if !opts.Atomic {
		s.mux.Lock()
		defer s.mux.Unlock()

		if value == nil {
			s.delete(key)
		} else {
			s.elems[key] = valueBytes
		}

		return true, nil // TODO: Double check what to return
	}

	s.mux.RLock()
	oldValue := s.elems[key]
	if bytes.Equal(oldValue, downstreamOpts.OldValue) {
		return false, nil
	}
	s.mux.RUnlock()

	s.mux.Lock()
	defer s.mux.Unlock()
	if value == nil {
		s.delete(key)
	} else {
		s.elems[key] = valueBytes
	}

	return true, nil
}

func (s *Store) SetAtomicWithRetries(key string, valueFunc func(oldValue []byte) (newValue any, err error)) error {
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
	return fmt.Errorf("failed to set value after %d retries", numRetries)
}

func (s *Store) ListKeys(page int, count int, options ...pluginapi.ListKeysOption) ([]string, error) {
	opt := pluginapi.ListKeysOptions{}
	for _, o := range options {
		o(&opt)
	}

	allKeys := make([]string, 0)
	s.mux.RLock()
	for k := range s.elems {
		allKeys = append(allKeys, k)
	}
	s.mux.RUnlock()

	if len(allKeys) == 0 {
		return []string{}, nil
	}

	// TODO: Check boundaries
	pageKeys := allKeys[page*count : page*count+1]
	for i, k := range pageKeys {
		for _, c := range opt.Checkers {
			ok, err := c(k)
			if err != nil {
				return nil, err
			}
			if !ok {
				pageKeys = append(pageKeys[:i], pageKeys[i+1:]...)
			}
		}
	}

	return pageKeys, nil
}

func (s *Store) Get(key string, o any) error {
	s.mux.RLock()
	defer s.mux.RUnlock()

	data, ok := s.elems[key]
	if !ok || len(data) == 0 {
		return nil
	}

	if bytesOut, ok := o.(*[]byte); ok {
		*bytesOut = data
		return nil
	}

	if err := json.Unmarshal(data, o); err != nil {
		return errors.Wrapf(err, "failed to unmarshal value for key %s", key)
	}

	return nil
}

func (s *Store) Delete(key string) error {
	s.delete(key)

	return nil
}

func (s *Store) delete(key string) {
	s.mux.Lock()
	defer s.mux.Unlock()

	delete(s.elems, key)
}

// DeleteAll removes all key-value pairs.
func (s *Store) DeleteAll() error {
	s.mux.Lock()
	defer s.mux.Unlock()

	s.elems = make(map[string][]byte)

	return nil
}
