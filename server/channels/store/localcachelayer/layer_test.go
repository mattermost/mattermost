// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"os"
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"
)

type storeType struct {
	Name        string
	SqlSettings *model.SqlSettings
	SqlStore    *sqlstore.SqlStore
	Store       store.Store
}

var storeTypes []*storeType

func newStoreType(name, driver string) *storeType {
	return &storeType{
		Name:        name,
		SqlSettings: storetest.MakeSqlSettings(driver, false),
	}
}

func StoreTest(t *testing.T, f func(*testing.T, request.CTX, store.Store)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	for _, st := range storeTypes {
		st := st
		rctx := request.TestContext(t)

		t.Run(st.Name, func(t *testing.T) {
			if testing.Short() {
				t.SkipNow()
			}
			f(t, rctx, st.Store)
		})
	}
}

func StoreTestWithSqlStore(t *testing.T, f func(*testing.T, request.CTX, store.Store, storetest.SqlStore)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	for _, st := range storeTypes {
		st := st
		rctx := request.TestContext(t)

		t.Run(st.Name, func(t *testing.T) {
			if testing.Short() {
				t.SkipNow()
			}
			f(t, rctx, st.Store, sqlstore.NewStoreTestWrapper(st.SqlStore))
		})
	}
}

func initStores(logger mlog.LoggerIFace) {
	if testing.Short() {
		return
	}

	// In CI, we already run the entire test suite for both mysql and postgres in parallel.
	// So we just run the tests for the current database set.
	if os.Getenv("IS_CI") == "true" {
		switch os.Getenv("MM_SQLSETTINGS_DRIVERNAME") {
		case "mysql":
			storeTypes = append(storeTypes, newStoreType("LocalCache+MySQL", model.DatabaseDriverMysql))
		case "postgres":
			storeTypes = append(storeTypes, newStoreType("LocalCache+PostgreSQL", model.DatabaseDriverPostgres))
		}
	} else {
		storeTypes = append(storeTypes, newStoreType("LocalCache+MySQL", model.DatabaseDriverMysql),
			newStoreType("LocalCache+PostgreSQL", model.DatabaseDriverPostgres))
	}

	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	var eg errgroup.Group
	for _, st := range storeTypes {
		st := st
		eg.Go(func() error {
			var err error

			st.SqlStore, err = sqlstore.New(*st.SqlSettings, logger, nil)
			if err != nil {
				return err
			}
			st.Store, err = NewLocalCacheLayer(st.SqlStore, nil, nil, cache.NewProvider(), logger)
			if err != nil {
				return err
			}
			st.Store.DropAllTables()
			st.Store.MarkSystemRanUnitTests()

			return nil
		})
	}
	if err := eg.Wait(); err != nil {
		panic(err)
	}
}

var tearDownStoresOnce sync.Once

func tearDownStores() {
	if testing.Short() {
		return
	}
	tearDownStoresOnce.Do(func() {
		var wg sync.WaitGroup
		wg.Add(len(storeTypes))
		for _, st := range storeTypes {
			st := st
			go func() {
				if st.Store != nil {
					st.Store.Close()
				}
				if st.SqlSettings != nil {
					storetest.CleanupSqlSettings(st.SqlSettings)
				}
				wg.Done()
			}()
		}
		wg.Wait()
	})
}

func TestClearCacheCluster(t *testing.T) {
	cluster := &testlib.FakeClusterInterface{}
	lc := &LocalCacheStore{
		cluster: cluster,
	}

	c := cache.NewLRU(&cache.CacheOptions{
		Size:                   10,
		Name:                   "test",
		InvalidateClusterEvent: model.ClusterEventInvalidateCacheForRoles,
	})

	lc.doClearCacheCluster(c)
	assert.Len(t, cluster.GetMessages(), 1)
	expectedMsg := &model.ClusterMessage{
		Event:    model.ClusterEventInvalidateCacheForRoles,
		SendType: model.ClusterSendBestEffort,
		Data:     clearCacheMessageData,
	}
	require.Equal(t, expectedMsg, cluster.GetMessages()[0])

	c = cache.NewLRU(&cache.CacheOptions{
		Size:                   10,
		Name:                   "test",
		InvalidateClusterEvent: model.ClusterEventNone,
	})

	lc.doClearCacheCluster(c)
	assert.Len(t, cluster.GetMessages(), 1)
}
