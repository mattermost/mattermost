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

type MockMutexPluginAPI struct {
	t *testing.T

	lock      sync.Mutex
	keyValues map[string][]byte
	failing   bool
}

func NewMockMutexPluginAPI(t *testing.T) *MockMutexPluginAPI {
	return &MockMutexPluginAPI{
		t:         t,
		keyValues: make(map[string][]byte),
	}
}

func (pluginAPI *MockMutexPluginAPI) setFailing(failing bool) {
	pluginAPI.lock.Lock()
	defer pluginAPI.lock.Unlock()

	pluginAPI.failing = failing
}

func (pluginAPI *MockMutexPluginAPI) clear() {
	pluginAPI.lock.Lock()
	defer pluginAPI.lock.Unlock()

	for k := range pluginAPI.keyValues {
		delete(pluginAPI.keyValues, k)
	}
}

func (pluginAPI *MockMutexPluginAPI) KVGet(key string) ([]byte, *model.AppError) {
	pluginAPI.lock.Lock()
	defer pluginAPI.lock.Unlock()

	if pluginAPI.failing {
		return nil, &model.AppError{Message: "fake error"}
	}

	return pluginAPI.keyValues[key], nil
}

func (pluginAPI *MockMutexPluginAPI) KVSetWithOptions(key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError) {
	pluginAPI.lock.Lock()
	defer pluginAPI.lock.Unlock()

	if pluginAPI.failing {
		return false, &model.AppError{Message: "fake error"}
	}

	if options.Atomic {
		if value := pluginAPI.keyValues[key]; !bytes.Equal(value, options.OldValue) {
			return false, nil
		}
	}

	if value == nil {
		delete(pluginAPI.keyValues, key)
	} else {
		pluginAPI.keyValues[key] = value
	}

	return true, nil
}

func (pluginAPI *MockMutexPluginAPI) LogError(msg string, keyValuePairs ...interface{}) {
	if pluginAPI.t == nil {
		return
	}

	pluginAPI.t.Helper()

	params := []interface{}{msg}
	params = append(params, keyValuePairs...)

	pluginAPI.t.Log(params...)
}

func lock(t *testing.T, m *Mutex) {
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

func unlock(t *testing.T, m *Mutex, panics bool) {
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

func TestMutex(t *testing.T) {
	t.Run("successful lock/unlock cycle", func(t *testing.T) {
		mockPluginAPI := NewMockMutexPluginAPI(t)

		m := NewMutex("key", mockPluginAPI)
		lock(t, m)
		unlock(t, m, false)
		lock(t, m)
		unlock(t, m, false)
	})

	t.Run("unlock when not locked", func(t *testing.T) {
		mockPluginAPI := NewMockMutexPluginAPI(t)

		m := NewMutex("key", mockPluginAPI)
		unlock(t, m, true)
	})

	t.Run("blocking lock", func(t *testing.T) {
		mockPluginAPI := NewMockMutexPluginAPI(t)

		m := NewMutex("key", mockPluginAPI)
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
		mockPluginAPI := NewMockMutexPluginAPI(t)

		m := NewMutex("key", mockPluginAPI)

		mockPluginAPI.setFailing(true)

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

		mockPluginAPI.setFailing(false)

		select {
		case <-time.After(15 * time.Second):
			require.Fail(t, "goroutine should have locked")
		case <-done:
		}
	})

	t.Run("failed unlock", func(t *testing.T) {
		mockPluginAPI := NewMockMutexPluginAPI(t)

		m := NewMutex("key", mockPluginAPI)
		lock(t, m)

		mockPluginAPI.setFailing(true)

		unlock(t, m, false)

		// Simulate expiry
		mockPluginAPI.clear()
		mockPluginAPI.setFailing(false)

		lock(t, m)
	})

	t.Run("discrete keys", func(t *testing.T) {
		mockPluginAPI := NewMockMutexPluginAPI(t)

		m1 := NewMutex("key1", mockPluginAPI)
		lock(t, m1)

		m2 := NewMutex("key2", mockPluginAPI)
		lock(t, m2)

		m3 := NewMutex("key3", mockPluginAPI)
		lock(t, m3)

		unlock(t, m1, false)
		unlock(t, m3, false)

		lock(t, m1)

		unlock(t, m2, false)
		unlock(t, m1, false)
	})
}
