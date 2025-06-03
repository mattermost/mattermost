// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"sync"
	"testing"

	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

// TestPool is used to facilitate the efficient (and safe) use of test stores in parallel tests (e.g. in api4, app, sqlstore).
type TestPool struct {
	entries map[string]*TestPoolEntry
	mut     sync.Mutex
	logger  mlog.LoggerIFace
}

type TestPoolEntry struct {
	Store    *SqlStore
	Settings *model.SqlSettings
}

func NewTestPool(logger mlog.LoggerIFace, driverName string, poolSize int) (*TestPool, error) {
	logger.Info("Creating test store pool", mlog.Int("poolSize", poolSize))

	entries := make(map[string]*TestPoolEntry, poolSize)

	var mut sync.Mutex
	var eg errgroup.Group
	for i := 0; i < poolSize; i++ {
		eg.Go(func() error {
			settings := storetest.MakeSqlSettings(driverName, false)
			sqlStore, err := New(*settings, logger, nil)
			if err != nil {
				return err
			}

			mut.Lock()
			logger.Info("Initializing test store in pool", mlog.String("datasource", *settings.DataSource))
			entries[*settings.DataSource] = &TestPoolEntry{
				Store:    sqlStore,
				Settings: settings,
			}
			mut.Unlock()

			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}

	return &TestPool{
		entries: entries,
		logger:  logger,
	}, nil
}

func (p *TestPool) Get(t testing.TB) *TestPoolEntry {
	p.mut.Lock()
	defer p.mut.Unlock()

	p.logger.Info("Getting from test store pool", mlog.Int("poolSize", len(p.entries)))

	var poolEntry *TestPoolEntry
	for _, entry := range p.entries {
		poolEntry = entry
		delete(p.entries, *entry.Settings.DataSource)
		break
	}

	// No more stores available in the pool
	if poolEntry == nil {
		return nil
	}

	p.logger.Info("Got store from pool", mlog.String("datasource", *poolEntry.Settings.DataSource), mlog.Int("poolSize", len(p.entries)))

	dataSource := *poolEntry.Settings.DataSource

	// Return store to pool on test cleanup
	t.Cleanup(func() {
		p.mut.Lock()
		defer p.mut.Unlock()
		p.logger.Info("Returning to test store pool", mlog.String("datasource", dataSource), mlog.Int("poolSize", len(p.entries)))
		p.entries[dataSource] = poolEntry
	})

	return poolEntry
}

func (p *TestPool) Close() {
	p.mut.Lock()
	defer p.mut.Unlock()

	var wg sync.WaitGroup
	wg.Add(len(p.entries))
	for _, entry := range p.entries {
		entry := entry
		go func() {
			defer wg.Done()
			entry.Store.Close()
			storetest.CleanupSqlSettings(entry.Settings)
		}()
	}
	wg.Wait()
}
