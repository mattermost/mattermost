// Package dlock is a distributed lock to enable advanced synchronization for Mattermost Plugins.
//
// if you're new to distributed locks and Mattermost Plugins please read sample use case scenarios
// at: https://community.mattermost.com/core/pl/bb376sjsdbym8kj7nz7zrcos7r
package dlock

import (
	"context"

	"sync"
	"time"

	pluginapi "github.com/lieut-data/mattermost-plugin-api"
	"github.com/pkg/errors"
)

const (
	// storePrefix used to prefix lock related keys in KV store.
	storePrefix = "dlock:"
)

const (
	// lockTTL is lock's expiry time.
	lockTTL = time.Second * 15

	// lockRefreshInterval used to determine how long to wait before refreshing
	// a lock's expiry time.
	lockRefreshInterval = time.Second

	// lockTryInterval used to wait before trying to obtain the lock again.
	lockTryInterval = time.Second
)

// API is a portion of pluginapi to keep locks' state and log errors.
type API interface {
	Set(key string, value interface{}, options ...pluginapi.KVSetOption) (bool, error)
	Error(message string, keyValuePairs ...interface{})
}

// DLock is a distributed lock.
type DLock struct {
	// api used to keep locks' state and log errors.
	api API

	// key to lock for.
	key string

	// refreshCancel stops refreshing lock's TTL.
	refreshCancel context.CancelFunc

	// refreshWait is a waiter to make sure refreshing is finished.
	refreshWait *sync.WaitGroup
}

// New creates a new distributed lock for key on given store with options.
// think,
//   `dl := New("my-key", store)`
// as an equivalent of,
//   `var m sync.Mutex`
// and use it in the same way.
func New(key string, api API) *DLock {
	return &DLock{key: buildKey(key), api: api}
}

// Lock obtains a new lock.
// ctx provides a context to locking. when ctx is cancelled, Lock() will stop
// blocking and retries and return with error.
// use Lock() exactly like sync.Mutex.Lock(), avoid missuses like deadlocks.
func (d *DLock) Lock(ctx context.Context) error {
	for {
		isLockObtained, err := d.lock()
		if err != nil {
			return err
		}
		if isLockObtained {
			return nil
		}
		afterC := time.After(lockTryInterval)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-afterC:
		}
	}
}

// TryLock tries to obtain the lock immediately.
// err is only filled on system failure.
func (d *DLock) TryLock() (isLockObtained bool, err error) {
	return d.lock()
}

// lock obtains a new lock and starts refreshing the lock until a call to
// Unlock() to not hit lock's TTL.
func (d *DLock) lock() (isLockObtained bool, err error) {
	setOptions := []pluginapi.KVSetOption{
		pluginapi.SetAtomic(nil),
		pluginapi.SetExpiry(lockTTL),
	}
	isLockObtained, err = d.api.Set(d.key, true, setOptions...)
	if err != nil {
		return false, errors.Wrap(err, "cannot obtain a lock, Store.Set() returned with an error")
	}
	if isLockObtained {
		d.startRefreshLoop()
	}
	return isLockObtained, nil
}

// startRefreshLoop refreshes an obtained lock to not get caught by lock's TTL.
// TTL tends to hit and release the lock automatically when plugin terminates.
func (d *DLock) startRefreshLoop() {
	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		t := time.NewTicker(lockRefreshInterval)
		for {
			select {
			case <-t.C:
				_, err := d.api.Set(d.key, true, pluginapi.SetExpiry(lockTTL))
				if err != nil {
					err = errors.Wrap(err, "cannot refresh a lock, Store.Set() returned with an error")
					d.api.Error(err.Error())
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	d.refreshCancel = cancel
	d.refreshWait = &wg
}

// Unlock unlocks Lock().
// use Unlock() exactly like sync.Mutex.Unlock().
func (d *DLock) Unlock() error {
	d.refreshCancel()
	d.refreshWait.Wait()
	if _, err := d.api.Set(d.key, nil); err != nil {
		return errors.Wrap(err, "cannot release a lock, Store.Set() returned with an error")
	}
	return nil
}

// buildKey builds a lock key for KV store.
func buildKey(key string) string {
	return storePrefix + key
}
