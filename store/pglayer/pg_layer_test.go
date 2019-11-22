package pglayer

import (
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/store/storetest"
)

var pgStore *PgLayer

func StoreTest(t *testing.T, f func(*testing.T, store.Store)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	t.Run("PG", func(t *testing.T) { f(t, pgStore) })
}

func StoreTestWithSqlSupplier(t *testing.T, f func(*testing.T, store.Store, storetest.SqlSupplier)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	t.Run("PG", func(t *testing.T) { f(t, pgStore, pgStore) })
}

func initStores() {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	pgStore = NewPgLayer(*sqlstore.NewSqlSupplier(*storetest.MakeSqlSettings(model.DATABASE_DRIVER_POSTGRES), nil))
	pgStore.DropAllTables()
	pgStore.MarkSystemRanUnitTests()
}

var tearDownStoresOnce sync.Once

func tearDownStores() {
	pgStore.Close()
}
