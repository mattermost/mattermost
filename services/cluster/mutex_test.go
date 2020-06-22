// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"bytes"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type MockMutexStoreAPI struct {
	t *testing.T

	lock      sync.Mutex
	keyValues map[string][]byte
	failing   bool
}

func NewMockMutexStoreAPI(t *testing.T) *MockMutexStoreAPI {
	return &MockMutexStoreAPI{
		t:         t,
		keyValues: make(map[string][]byte),
	}
}

func (mockAPI *MockMutexStoreAPI) setFailing(failing bool) {
	mockAPI.lock.Lock()
	defer mockAPI.lock.Unlock()

	mockAPI.failing = failing
}

func (mockAPI *MockMutexStoreAPI) clear() {
	mockAPI.lock.Lock()
	defer mockAPI.lock.Unlock()

	for k := range mockAPI.keyValues {
		delete(mockAPI.keyValues, k)
	}
}

func (mockAPI *MockMutexStoreAPI) CompareAndSet(kv *model.AtomicKeyValue, oldValue []byte) (bool, *model.AppError) {
	mockAPI.lock.Lock()
	defer mockAPI.lock.Unlock()

	if mockAPI.failing {
		return false, &model.AppError{Message: "fake error"}
	}
	if bytes.Equal(mockAPI.keyValues[kv.Key], oldValue) {
		mockAPI.keyValues[kv.Key] = kv.Value
		return true, nil
	}
	return false, nil
}

func (mockAPI *MockMutexStoreAPI) CompareAndDelete(key string, oldValue []byte) (bool, *model.AppError) {
	mockAPI.lock.Lock()
	defer mockAPI.lock.Unlock()

	if mockAPI.failing {
		return false, &model.AppError{Message: "fake error"}
	}

	if value := mockAPI.keyValues[key]; !bytes.Equal(value, oldValue) {
		return false, nil
	}

	delete(mockAPI.keyValues, key)

	return true, nil
}

func (mockAPI *MockMutexStoreAPI) LogError(msg string, keyValuePairs ...interface{}) {
	if mockAPI.t == nil {
		return
	}

	mockAPI.t.Helper()

	params := []interface{}{msg}
	params = append(params, keyValuePairs...)

	mockAPI.t.Log(params...)
}

func lock(t *testing.T, m sync.Locker) {
	t.Helper()

	done := make(chan bool)
	go func() {
		defer close(done)
		m.Lock()
	}()

	select {
	case <-time.After(1 * time.Second):
		require.Fail(t, "failed to lock mutex within 1 second")
	case <-done:
	}
}

func unlock(t *testing.T, m sync.Locker, panics bool) {
	t.Helper()

	done := make(chan bool)
	go func() {
		defer close(done)
		if panics {
			assert.Panics(t, m.Unlock)
		} else {
			assert.NotPanics(t, m.Unlock)
		}
	}()

	select {
	case <-time.After(1 * time.Second):
		require.Fail(t, "failed to unlock mutex within 1 second")
	case <-done:
	}
}

func TestDBMutex(t *testing.T) {
	t.Run("successful lock/unlock cycle", func(t *testing.T) {
		mockStoreAPI := NewMockMutexStoreAPI(t)

		m := NewDBMutex("key", mockStoreAPI)
		lock(t, m)
		unlock(t, m, false)
		lock(t, m)
		unlock(t, m, false)
	})

	t.Run("unlock when not locked", func(t *testing.T) {
		mockStoreAPI := NewMockMutexStoreAPI(t)

		m := NewDBMutex("key", mockStoreAPI)
		unlock(t, m, true)
	})

	t.Run("blocking lock", func(t *testing.T) {
		mockStoreAPI := NewMockMutexStoreAPI(t)

		m := NewDBMutex("key", mockStoreAPI)
		lock(t, m)

		done := make(chan bool)
		go func() {
			defer close(done)
			m.Lock()
		}()

		select {
		case <-time.After(1 * time.Second):
		case <-done:
			require.Fail(t, "second goroutine should not have locked")
		}

		unlock(t, m, false)

		select {
		case <-time.After(pollWaitInterval * 2):
			require.Fail(t, "second goroutine should have locked")
		case <-done:
		}
	})

	t.Run("failed lock", func(t *testing.T) {
		mockStoreAPI := NewMockMutexStoreAPI(t)

		m := NewDBMutex("key", mockStoreAPI)

		mockStoreAPI.setFailing(true)

		done := make(chan bool)
		go func() {
			defer close(done)
			m.Lock()
		}()

		select {
		case <-time.After(5 * time.Second):
		case <-done:
			require.Fail(t, "goroutine should not have locked")
		}

		mockStoreAPI.setFailing(false)

		select {
		case <-time.After(15 * time.Second):
			require.Fail(t, "goroutine should have locked")
		case <-done:
		}
	})

	t.Run("failed unlock", func(t *testing.T) {
		mockStoreAPI := NewMockMutexStoreAPI(t)

		m := NewDBMutex("key", mockStoreAPI)
		lock(t, m)

		mockStoreAPI.setFailing(true)

		unlock(t, m, false)

		// Simulate expiry
		mockStoreAPI.clear()
		mockStoreAPI.setFailing(false)

		lock(t, m)
	})

	t.Run("discrete keys", func(t *testing.T) {
		mockStoreAPI := NewMockMutexStoreAPI(t)

		m1 := NewDBMutex("key1", mockStoreAPI)
		lock(t, m1)

		m2 := NewDBMutex("key2", mockStoreAPI)
		lock(t, m2)

		m3 := NewDBMutex("key3", mockStoreAPI)
		lock(t, m3)

		unlock(t, m1, false)
		unlock(t, m3, false)

		lock(t, m1)

		unlock(t, m2, false)
		unlock(t, m1, false)
	})
}
