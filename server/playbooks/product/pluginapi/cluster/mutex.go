// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"context"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
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
)

// MutexPluginAPI is the plugin API interface required to manage mutexes.
type MutexPluginAPI interface {
	KVSetWithOptions(key string, value []byte, options model.PluginKVSetOptions) (bool, error)
}

// Mutex is similar to sync.Mutex, except usable by multiple plugin instances across a cluster.
//
// Internally, a mutex relies on an atomic key-value set operation as exposed by the Mattermost
// plugin API.
//
// Mutexes with different names are unrelated. Mutexes with the same name from different plugins
// are unrelated. Pick a unique name for each mutex your plugin requires.
//
// A Mutex must not be copied after first use.
type Mutex struct {
	pluginAPI MutexPluginAPI
	key       string

	// lock guards the variables used to manage the refresh task, and is not itself related to
	// the cluster-wide lock.
	lock        sync.Mutex
	stopRefresh chan bool
	refreshDone chan bool
}

// NewMutex creates a mutex with the given key name.
//
// Panics if key is empty.
func NewMutex(pluginAPI MutexPluginAPI, key string) (*Mutex, error) {
	key, err := makeLockKey(key)
	if err != nil {
		return nil, err
	}

	return &Mutex{
		pluginAPI: pluginAPI,
		key:       key,
	}, nil
}

// makeLockKey returns the prefixed key used to namespace mutex keys.
func makeLockKey(key string) (string, error) {
	if key == "" {
		return "", errors.New("must specify valid mutex key")
	}

	return mutexPrefix + key, nil
}

// lock makes a single attempt to atomically lock the mutex, returning true only if successful.
func (m *Mutex) tryLock() (bool, error) {
	ok, err := m.pluginAPI.KVSetWithOptions(m.key, []byte{1}, model.PluginKVSetOptions{
		Atomic:          true,
		OldValue:        nil, // No existing key value.
		ExpireInSeconds: int64(ttl / time.Second),
	})
	if err != nil {
		return false, errors.Wrap(err, "failed to set mutex kv")
	}

	return ok, nil
}

// refreshLock rewrites the lock key value with a new expiry, returning true only if successful.
func (m *Mutex) refreshLock() error {
	ok, err := m.pluginAPI.KVSetWithOptions(m.key, []byte{1}, model.PluginKVSetOptions{
		Atomic:          true,
		OldValue:        []byte{1},
		ExpireInSeconds: int64(ttl / time.Second),
	})
	if err != nil {
		return errors.Wrap(err, "failed to refresh mutex kv")
	} else if !ok {
		return errors.New("unexpectedly failed to refresh mutex kv")
	}

	return nil
}

// Lock locks m. If the mutex is already locked by any plugin instance, including the current one,
// the calling goroutine blocks until the mutex can be locked.
func (m *Mutex) Lock() {
	_ = m.LockWithContext(context.Background())
}

// LockWithContext locks m unless the context is canceled. If the mutex is already locked by any plugin
// instance, including the current one, the calling goroutine blocks until the mutex can be locked,
// or the context is canceled.
//
// The mutex is locked only if a nil error is returned.
func (m *Mutex) LockWithContext(ctx context.Context) error {
	var waitInterval time.Duration

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(waitInterval):
		}

		locked, err := m.tryLock()
		if err != nil {
			logrus.WithError(err).WithField("lock_key", m.key).Error("failed to lock mutex")
			waitInterval = nextWaitInterval(waitInterval, err)
			continue
		} else if !locked {
			waitInterval = nextWaitInterval(waitInterval, err)
			continue
		}

		stop := make(chan bool)
		done := make(chan bool)
		go func() {
			defer close(done)
			t := time.NewTicker(refreshInterval)
			for {
				select {
				case <-t.C:
					err := m.refreshLock()
					if err != nil {
						logrus.WithError(err).WithField("lock_key", m.key).Error("failed to refresh mutex")
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

		return nil
	}
}

// Unlock unlocks m. It is a run-time error if m is not locked on entry to Unlock.
//
// Just like sync.Mutex, a locked Lock is not associated with a particular goroutine or plugin
// instance. It is allowed for one goroutine or plugin instance to lock a Lock and then arrange
// for another goroutine or plugin instance to unlock it. In practice, ownership of the lock should
// remain within a single plugin instance.
func (m *Mutex) Unlock() {
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
	_, _ = m.pluginAPI.KVSetWithOptions(m.key, nil, model.PluginKVSetOptions{})
}
