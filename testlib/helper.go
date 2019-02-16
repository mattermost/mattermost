// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testlib

import (
	"flag"
	"fmt"
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
)

type MainHelper struct {
	settings         *model.SqlSettings
	store            store.Store
	sqlSupplier      *sqlstore.SqlSupplier
	clusterInterface *FakeClusterInterface

	status           int
	testResourcePath string
}

type HelperOptions struct {
	EnableStore bool
	EnableResources bool
}

func newMainHelper() *MainHelper {
	var mainHelper MainHelper
	flag.Parse()

	// Setup a global logger to catch tests logging outside of app context
	// The global logger will be stomped by apps initalizing but that's fine for testing.
	// Ideally this won't happen.
	mlog.InitGlobalLogger(mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	}))

	utils.TranslationsPreInit()

	return &mainHelper
}

func NewMainHelper() *MainHelper {
	mainHelper := newMainHelper()
	mainHelper.setupStore()
	return mainHelper
}

func NewMainHelperWithOptions(options *HelperOptions) *MainHelper {
	mainHelper := newMainHelper()

	if options != nil {
		if options.EnableStore {
			mainHelper.setupStore()
		}

		if options.EnableResources {
			mainHelper.setupResources()
		}
	}

	return mainHelper
}

func (h *MainHelper) Main(m *testing.M) {
	if h.testResourcePath != "" {
		prevDir, err := os.Getwd()
		if err != nil {
			panic("Failed to get current working directory: " + err.Error())
		}

		err = os.Chdir(h.testResourcePath)
		if err != nil {
			panic(fmt.Sprintf("Failed to set current working directory to %s: %s", h.testResourcePath, err.Error()))
		}

		defer func() {
			err := os.Chdir(prevDir)
			if err != nil {
				panic(fmt.Sprintf("Failed to restore current working directory to %s: %s", prevDir, err.Error()))
			}
		}()
	}

	h.status = m.Run()
}

func (h *MainHelper) setupStore() {
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DATABASE_DRIVER_MYSQL
	}

	h.settings = storetest.MakeSqlSettings(driverName)

	h.clusterInterface = &FakeClusterInterface{}
	h.sqlSupplier = sqlstore.NewSqlSupplier(*h.settings, nil)
	h.store = &TestStore{
		store.NewLayeredStore(h.sqlSupplier, nil, h.clusterInterface),
	}
}

func (h *MainHelper) setupResources()  {
	var err error
	h.testResourcePath, err = SetupTestResources()
	if err != nil {
		panic("failed to setup test resources: " + err.Error())
	}
}

func (h *MainHelper) Close() error {
	if h.settings != nil {
		storetest.CleanupSqlSettings(h.settings)
	}
	if h.testResourcePath != "" {
		os.RemoveAll(h.testResourcePath)
	}

	os.Exit(h.status)

	return nil
}

func (h *MainHelper) GetSqlSettings() *model.SqlSettings {
	if h.settings == nil {
		panic("MainHelper not initialized with database access.")
	}

	return h.settings
}

func (h *MainHelper) GetStore() store.Store {
	if h.store == nil {
		panic("MainHelper not initialized with store.")
	}

	return h.store
}

func (h *MainHelper) GetSqlSupplier() *sqlstore.SqlSupplier {
	if h.sqlSupplier == nil {
		panic("MainHelper not initialized with sql supplier.")
	}

	return h.sqlSupplier
}

func (h *MainHelper) GetClusterInterface() *FakeClusterInterface {
	if h.clusterInterface == nil {
		panic("MainHelper not initialized with sql supplier.")
	}

	return h.clusterInterface
}
