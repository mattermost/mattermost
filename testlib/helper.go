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
	Settings         *model.SqlSettings
	Store            store.Store
	SqlSupplier      *sqlstore.SqlSupplier
	ClusterInterface *FakeClusterInterface

	status           int
	TestResourcePath string
}

func NewMainHelper() *MainHelper {
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

	settings := storetest.MakeSqlSettings(model.DATABASE_DRIVER_MYSQL)

	clusterInterface := &FakeClusterInterface{}
	sqlSupplier := sqlstore.NewSqlSupplier(*settings, nil)
	testStore := &TestStore{
		store.NewLayeredStore(sqlSupplier, nil, clusterInterface),
	}

	testResourcePath := SetupTestResources()

	return &MainHelper{
		Settings:         settings,
		Store:            testStore,
		SqlSupplier:      sqlSupplier,
		ClusterInterface: clusterInterface,
		TestResourcePath: testResourcePath,
	}
}

func (h *MainHelper) Main(m *testing.M) {
	prevDir, err := os.Getwd()
	if err != nil {
		panic("Failed to get current working directory: " + err.Error())
	}

	err = os.Chdir(h.TestResourcePath)
	if err != nil {
		panic(fmt.Sprintf("Failed to set current working directory to %s: %s", h.TestResourcePath, err.Error()))
	}

	defer func() {
		err := os.Chdir(prevDir)
		if err != nil {
			mlog.Error(fmt.Sprintf("Failed to set current working directory to %s: %s", prevDir, err.Error()))
		}
	}()

	h.status = m.Run()
}

func (h *MainHelper) Close() error {
	storetest.CleanupSqlSettings(h.Settings)
	CleanupTestResources(h.TestResourcePath)

	os.Exit(h.status)

	return nil
}
