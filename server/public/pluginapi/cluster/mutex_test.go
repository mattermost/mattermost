package cluster

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func mustNewMutex(pluginAPI MutexPluginAPI, key string) *Mutex {
	m, err := NewMutex(pluginAPI, key)
	if err != nil {
		panic(err)
	}

	return m
}

func TestMakeLockKey(t *testing.T) {
	t.Run("fails when empty", func(t *testing.T) {
		key, err := makeLockKey("")
		assert.Error(t, err)
		assert.Empty(t, key)
	})

	t.Run("not-empty", func(t *testing.T) {
		testCases := map[string]string{
			"key":   mutexPrefix + "key",
			"other": mutexPrefix + "other",
		}

		for key, expected := range testCases {
			actual, err := makeLockKey(key)
			require.NoError(t, err)
			assert.Equal(t, expected, actual)
		}
	})
}

func lock(t *testing.T, m *Mutex) {
	t.Helper()

	done := make(chan bool)
	go func() {
		t.Helper()

		defer close(done)
		m.Lock()
	}()

	select {
	case <-time.After(2 * time.Second):
		require.Fail(t, "failed to lock mutex within 2 seconds")
	case <-done:
	}
}

func unlock(t *testing.T, m *Mutex, panics bool) {
	t.Helper()

	done := make(chan bool)
	go func() {
		t.Helper()

		defer close(done)
		if panics {
			assert.Panics(t, m.Unlock)
		} else {
			assert.NotPanics(t, m.Unlock)
		}
	}()

	select {
	case <-time.After(2 * time.Second):
		require.Fail(t, "failed to unlock mutex within 2 seconds")
	case <-done:
	}
}

func TestMutex(t *testing.T) {
	t.Parallel()

	makeKey := model.NewId

	t.Run("successful lock/unlock cycle", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		m := mustNewMutex(mockPluginAPI, makeKey())
		lock(t, m)
		unlock(t, m, false)
		lock(t, m)
		unlock(t, m, false)
	})

	t.Run("unlock when not locked", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		m := mustNewMutex(mockPluginAPI, makeKey())
		unlock(t, m, true)
	})

	t.Run("blocking lock", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		m := mustNewMutex(mockPluginAPI, makeKey())
		lock(t, m)

		done := make(chan bool)
		go func() {
			defer close(done)
			m.Lock()
		}()

		select {
		case <-time.After(2 * time.Second):
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
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		m := mustNewMutex(mockPluginAPI, makeKey())

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
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		key := makeKey()
		m := mustNewMutex(mockPluginAPI, key)
		lock(t, m)

		mockPluginAPI.setFailing(true)

		unlock(t, m, false)

		// Simulate expiry
		mockPluginAPI.clear()
		mockPluginAPI.setFailing(false)

		lock(t, m)
	})

	t.Run("discrete keys", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		m1 := mustNewMutex(mockPluginAPI, makeKey())
		lock(t, m1)

		m2 := mustNewMutex(mockPluginAPI, makeKey())
		lock(t, m2)

		m3 := mustNewMutex(mockPluginAPI, makeKey())
		lock(t, m3)

		unlock(t, m1, false)
		unlock(t, m3, false)

		lock(t, m1)

		unlock(t, m2, false)
		unlock(t, m1, false)
	})

	t.Run("with uncancelled context", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		key := makeKey()
		m := mustNewMutex(mockPluginAPI, key)

		m.Lock()

		ctx := context.Background()
		done := make(chan bool)
		go func() {
			defer close(done)
			err := m.LockWithContext(ctx)
			require.Nil(t, err)
		}()

		select {
		case <-time.After(ttl + pollWaitInterval*2):
		case <-done:
			require.Fail(t, "goroutine should not have locked")
		}

		m.Unlock()

		select {
		case <-time.After(pollWaitInterval * 2):
			require.Fail(t, "goroutine should have locked after unlock")
		case <-done:
		}
	})

	t.Run("with canceled context", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		m := mustNewMutex(mockPluginAPI, makeKey())

		m.Lock()

		ctx, cancel := context.WithCancel(context.Background())
		done := make(chan bool)
		go func() {
			defer close(done)
			err := m.LockWithContext(ctx)
			require.NotNil(t, err)
		}()

		select {
		case <-time.After(ttl + pollWaitInterval*2):
		case <-done:
			require.Fail(t, "goroutine should not have locked")
		}

		cancel()

		select {
		case <-time.After(pollWaitInterval * 2):
			require.Fail(t, "goroutine should have aborted after cancellation")
		case <-done:
		}
	})
}
