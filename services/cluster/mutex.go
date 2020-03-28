// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"math/rand"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	// mutexPrefix is used to namespace key values created for a mutex from other key values
	// created by a plugin.
	mutexPrefix = "mutex_"
)

const (
	// ttl is the interval after which a locked mutex will expire unless refreshed
	ttl = time.Second * 15

	// refreshInterval is the interval on which the mutex will be refreshed when locked
	refreshInterval = ttl / 2

	// minWaitInterval is the minimum amount of time to wait between locking attempts
	minWaitInterval = 1 * time.Second

	// maxWaitInterval is the maximum amount of time to wait between locking attempts
	maxWaitInterval = 5 * time.Minute

	// pollWaitInterval is the usual time to wait between unsuccessful locking attempts
	pollWaitInterval = 1 * time.Second

	// jitterWaitInterval is the amount of jitter to add when waiting to avoid thundering herds
	jitterWaitInterval = minWaitInterval / 2
)

// StoreAPI is the API interface required to manage mutexes.
type StoreAPI interface {
	CompareAndSet(kv *model.AtomicKeyValue, oldValue []byte) (bool, *model.AppError)
	CompareAndDelete(key string, oldValue []byte) (bool, *model.AppError)
}

// DBMutex mutex usable across cluster that uses database as a backend
type DBMutex struct {
	store StoreAPI
	key   string

	// lock guards the variables used to manage the refresh task, and is not itself related to
	// the cluster-wide lock.
	lock        sync.Mutex
	stopRefresh chan struct{}
	refreshDone chan struct{}
}

// NewDBMutex creates a mutex with the given name.
func NewDBMutex(key string, storeAPI StoreAPI) *DBMutex {
	key = mutexPrefix + key

	return &DBMutex{
		store: storeAPI,
		key:   key,
	}
}

// lock makes a single attempt to atomically lock the mutex, returning true only if successful.
func (m *DBMutex) tryLock() (bool, error) {
	ok, err := m.store.CompareAndSet(&model.AtomicKeyValue{
		Key:          m.key,
		Value:        []byte{1},
		ExpireInSecs: int64(ttl / time.Second),
	}, nil)
	if err != nil {
		return false, errors.Wrap(err, "failed to set mutex kv")
	}

	return ok, nil
}

// refreshLock rewrites the lock key value with a new expiry, returning true only if successful.
//
// Only call this while holding the lock.
func (m *DBMutex) refreshLock() error {
	ok, err := m.store.CompareAndSet(&model.AtomicKeyValue{
		Key:          m.key,
		Value:        nil,
		ExpireInSecs: int64(ttl / time.Second),
	}, []byte{1})
	if err != nil {
		return errors.Wrap(err, "failed to refresh mutex kv")
	} else if !ok {
		return errors.New("unexpectedly failed to refresh mutex kv")
	}

	return nil
}

// Lock locks m. If the mutex is already locked by any plugin instance, including the current one,
// the calling goroutine blocks until the mutex can be locked.
func (m *DBMutex) Lock() {
	m.waitUntilLockAcquired()

	stop := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		t := time.NewTicker(refreshInterval)
		for {
			select {
			case <-t.C:
				err := m.refreshLock()
				if err != nil {
					mlog.Error("failed to refresh mutex", mlog.Err(err), mlog.String("lock_key", m.key))
					return
				}
			case <-stop:
				return
			}
		}
	}()

	m.lock.Lock()
	m.stopRefresh = stop
	m.refreshDone = done
	m.lock.Unlock()
}

// waitUntilLockAcquired will try to acquire the lock in an infinite loop
func (m *DBMutex) waitUntilLockAcquired() {
	var waitInterval time.Duration
	for {
		time.Sleep(waitInterval)

		locked, err := m.tryLock()
		if err != nil {
			mlog.Error("failed to lock mutex", mlog.Err(err), mlog.String("lock_key", m.key))
			waitInterval = nextWaitInterval(waitInterval, err)
			continue
		} else if !locked {
			waitInterval = nextWaitInterval(waitInterval, err)
			continue
		}
		return
	}
}

// Unlock unlocks m. It is a run-time error if m is not locked on entry to Unlock.
//
// Just like sync.Mutex, a locked Lock is not associated with a particular goroutine or plugin
// instance. It is allowed for one goroutine or plugin instance to lock a Lock and then arrange
// for another goroutine or plugin instance to unlock it. In practice, ownership of the lock should
// remain within a single plugin instance.
func (m *DBMutex) Unlock() {
	m.lock.Lock()
	if m.stopRefresh == nil {
		m.lock.Unlock()
		panic("mutex has not been acquired")
	}

	close(m.stopRefresh)
	m.stopRefresh = nil
	<-m.refreshDone
	m.lock.Unlock()

	// If an error occurs deleting, the mutex kv will still expire, allowing later retry.
	_, _ = m.store.CompareAndDelete(m.key, []byte{1})
}

// nextWaitInterval determines how long to wait until the next lock retry.
func nextWaitInterval(lastWaitInterval time.Duration, err error) time.Duration {
	nextWaitInterval := lastWaitInterval

	if nextWaitInterval <= 0 {
		nextWaitInterval = minWaitInterval
	}

	if err != nil {
		nextWaitInterval = nextWaitInterval * 2
		if nextWaitInterval > maxWaitInterval {
			nextWaitInterval = maxWaitInterval
		}
	} else {
		nextWaitInterval = pollWaitInterval
	}

	// Add some jitter to avoid unnecessary collision between competing instances.
	nextWaitInterval = nextWaitInterval + time.Duration(rand.Int63n(int64(jitterWaitInterval))-int64(jitterWaitInterval)/2)

	return nextWaitInterval
}

// DBMutexProvider allows creating new DBMutex instances
type DBMutexProvider struct {
	Store StoreAPI
}

// NewMutex creates a new mutex instance
func (m *DBMutexProvider) NewMutex(name string) sync.Locker {
	return NewDBMutex(name, m.Store)
}

var _ MutexProvider = &DBMutexProvider{}
