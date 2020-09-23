// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"os"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/searchtest"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
)

type storeType struct {
	Name        string
	SqlSettings *model.SqlSettings
	SqlSupplier *SqlSupplier
	Store       store.Store
}

var storeTypes []*storeType

func newStoreType(name, driver string) *storeType {
	return &storeType{
		Name:        name,
		SqlSettings: storetest.MakeSqlSettings(driver),
	}
}

func StoreTest(t *testing.T, f func(*testing.T, store.Store)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	for _, st := range storeTypes {
		st := st
		t.Run(st.Name, func(t *testing.T) {
			if testing.Short() {
				t.SkipNow()
			}
			f(t, st.Store)
		})
	}
}

func StoreTestWithSearchTestEngine(t *testing.T, f func(*testing.T, store.Store, *searchtest.SearchTestEngine)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()

	for _, st := range storeTypes {
		st := st
		searchTestEngine := &searchtest.SearchTestEngine{
			Driver: *st.SqlSettings.DriverName,
		}

		t.Run(st.Name, func(t *testing.T) { f(t, st.Store, searchTestEngine) })
	}
}

func StoreTestWithSqlSupplier(t *testing.T, f func(*testing.T, store.Store, storetest.SqlSupplier)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	for _, st := range storeTypes {
		st := st
		t.Run(st.Name, func(t *testing.T) {
			if testing.Short() {
				t.SkipNow()
			}
			f(t, st.Store, st.SqlSupplier)
		})
	}
}

func initStores() {
	if testing.Short() {
		return
	}
	// In CI, we already run the entire test suite for both mysql and postgres in parallel.
	// So we just run the tests for the current database set.
	if os.Getenv("IS_CI") == "true" {
		switch os.Getenv("MM_SQLSETTINGS_DRIVERNAME") {
		case "mysql":
			storeTypes = append(storeTypes, newStoreType("MySQL", model.DATABASE_DRIVER_MYSQL))
		case "postgres":
			storeTypes = append(storeTypes, newStoreType("PostgreSQL", model.DATABASE_DRIVER_POSTGRES))
		}
	} else {
		storeTypes = append(storeTypes, newStoreType("MySQL", model.DATABASE_DRIVER_MYSQL),
			newStoreType("PostgreSQL", model.DATABASE_DRIVER_POSTGRES))
	}

	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	var wg sync.WaitGroup
	for _, st := range storeTypes {
		st := st
		wg.Add(1)
		go func() {
			defer wg.Done()
			st.SqlSupplier = NewSqlSupplier(*st.SqlSettings, nil)
			st.Store = st.SqlSupplier
			st.Store.DropAllTables()
			st.Store.MarkSystemRanUnitTests()
		}()
	}
	wg.Wait()
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
