// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/storetest"
)

type storeType struct {
	Name        string
	SqlSettings *model.SqlSettings
	SqlSupplier *SqlSupplier
	Store       store.Store
}

var storeTypes []*storeType

func StoreTest(t *testing.T, f func(*testing.T, store.Store)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	for _, st := range storeTypes {
		st := st
		t.Run(st.Name, func(t *testing.T) { f(t, st.Store) })
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
		t.Run(st.Name, func(t *testing.T) { f(t, st.Store, st.SqlSupplier) })
	}
}

func initStores() {
	storeTypes = append(storeTypes, &storeType{
		Name:        "MySQL",
		SqlSettings: storetest.MakeSqlSettings(model.DATABASE_DRIVER_MYSQL),
	})
	storeTypes = append(storeTypes, &storeType{
		Name:        "PostgreSQL",
		SqlSettings: storetest.MakeSqlSettings(model.DATABASE_DRIVER_POSTGRES),
	})

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
			st.Store = store.NewLayeredStore(st.SqlSupplier, nil, nil)
			st.Store.DropAllTables()
			st.Store.MarkSystemRanUnitTests()
		}()
	}
	wg.Wait()
}

var tearDownStoresOnce sync.Once

func tearDownStores() {
	tearDownStoresOnce.Do(func() {
		var wg sync.WaitGroup
		wg.Add(len(storeTypes))
		for _, st := range storeTypes {
			st := st
			go func() {
				if st.Store != nil {
					st.Store.Close()
				}
				wg.Done()
			}()
		}
		wg.Wait()
	})
}
