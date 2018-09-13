// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"os"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
)

var storeTypes = []*struct {
	Name        string
	Func        func() (*storetest.RunningContainer, *model.SqlSettings, error)
	Container   *storetest.RunningContainer
	SqlSupplier *SqlSupplier
	Store       store.Store
}{
	{
		Name: "MySQL",
		Func: storetest.NewMySQLContainer,
	},
	{
		Name: "PostgreSQL",
		Func: storetest.NewPostgreSQLContainer,
	},
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
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	var wg sync.WaitGroup
	errCh := make(chan error, len(storeTypes))
	wg.Add(len(storeTypes))
	for _, st := range storeTypes {
		st := st
		go func() {
			defer wg.Done()
			container, settings, err := st.Func()
			if err != nil {
				errCh <- err
				return
			}
			st.Container = container
			st.SqlSupplier = NewSqlSupplier(*settings, nil)
			st.Store = store.NewLayeredStore(st.SqlSupplier, nil, nil)
			st.Store.MarkSystemRanUnitTests()
		}()
	}
	wg.Wait()
	select {
	case err := <-errCh:
		panic(err)
	default:
	}
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
				if st.Container != nil {
					st.Container.Stop()
				}
				wg.Done()
			}()
		}
		wg.Wait()
	})
}

func TestMain(m *testing.M) {
	// Setup a global logger to catch tests logging outside of app context
	// The global logger will be stomped by apps initalizing but that's fine for testing. Ideally this won't happen.
	mlog.InitGlobalLogger(mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	}))

	utils.TranslationsPreInit()

	status := 0

	initStores()
	defer func() {
		tearDownStores()
		os.Exit(status)
	}()

	status = m.Run()
}
