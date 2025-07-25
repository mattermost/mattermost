// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"testing"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchlayer"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type MainHelper struct {
	Settings         *model.SqlSettings
	Store            store.Store
	SearchEngine     *searchengine.Broker
	SQLStore         *sqlstore.SqlStore
	ClusterInterface *FakeClusterInterface
	Logger           *mlog.Logger
	Options          HelperOptions

	status           int
	testResourcePath string
	replicas         []string
	storePool        *sqlstore.TestPool
}

type HelperOptions struct {
	EnableStore     bool
	EnableResources bool
	RunParallel     bool
	Parallelism     int
}

func NewMainHelper() *MainHelper {
	// Ignore any globally defined datasource if a test dsn defined
	if os.Getenv("TEST_DATABASE_POSTGRESQL_DSN") != "" {
		os.Unsetenv("MM_SQLSETTINGS_DATASOURCE")
	}

	return NewMainHelperWithOptions(&HelperOptions{
		EnableStore:     true,
		EnableResources: true,
	})
}

func NewMainHelperWithOptions(options *HelperOptions) *MainHelper {
	// Ignore any globally defined datasource if a test dsn defined
	if os.Getenv("TEST_DATABASE_POSTGRESQL_DSN") != "" {
		os.Unsetenv("MM_SQLSETTINGS_DATASOURCE")
	}

	// Unset environment variables commonly set for development that interfere with tests.
	os.Unsetenv("MM_SERVICESETTINGS_SITEURL")
	os.Unsetenv("MM_SERVICESETTINGS_LISTENADDRESS")
	os.Unsetenv("MM_SERVICESETTINGS_CONNECTIONSECURITY")
	os.Unsetenv("MM_SERVICESETTINGS_ENABLEDEVELOPER")

	logger := mlog.CreateConsoleLogger()

	mainHelper := MainHelper{
		Logger: logger,
	}

	_, err := mlog.NewLogger()
	if err != nil {
		log.Fatal(err)
	}
	flag.Parse()

	err = utils.TranslationsPreInit()
	if err != nil {
		log.Fatal(err)
	}

	if options != nil {
		mainHelper.Options = *options

		if options.EnableStore && !testing.Short() {
			mainHelper.setupStore()
		}

		if options.EnableResources {
			mainHelper.setupResources()
		}

		if options.RunParallel && options.EnableStore {
			driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
			if driverName == "" {
				driverName = model.DatabaseDriverPostgres
			}
			// NOTE: we use a poolSize higher than the parallelism value (coming from -test.parallel flag) as we need a bit of extra buffer to cover
			// for subtests that might also run in parallel and initialize a new store.
			storePool, err := sqlstore.NewTestPool(mainHelper.Logger, driverName, options.Parallelism*2)
			if err != nil {
				panic(err)
			}
			mainHelper.storePool = storePool
		}
	}

	return &mainHelper
}

func (h *MainHelper) Main(m *testing.M) {
	defer func() {
		err := h.Logger.Shutdown()
		if err != nil {
			log.Fatal(err)
		}
	}()

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

func (h *MainHelper) GetNewStores(tb testing.TB) (store.Store, *sqlstore.SqlStore, *model.SqlSettings, *searchengine.Broker) {
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DatabaseDriverPostgres
	}

	config := &model.Config{}
	config.SetDefaults()

	searchEngine := searchengine.NewBroker(config)

	storePoolEntry := h.storePool.Get(tb)
	if storePoolEntry == nil {
		panic("no store available in the pool")
	}
	settings := storePoolEntry.Settings
	sqlStore := storePoolEntry.Store
	sqlStore.DropAllTables()

	store := searchlayer.NewSearchLayer(&TestStore{
		sqlStore,
	}, searchEngine, config)

	store.MarkSystemRanUnitTests()

	preloadMigrations(driverName, sqlStore)

	return store, sqlStore, settings, searchEngine
}

func (h *MainHelper) setupStore() {
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DatabaseDriverPostgres
	}

	h.Settings = storetest.MakeSqlSettings(driverName)
	h.replicas = h.Settings.DataSourceReplicas

	config := &model.Config{}
	config.SetDefaults()

	h.SearchEngine = searchengine.NewBroker(config)
	h.ClusterInterface = &FakeClusterInterface{}

	var err error
	h.SQLStore, err = sqlstore.New(*h.Settings, h.Logger, nil, sqlstore.DisableMorphLogging())
	if err != nil {
		panic(err)
	}
	h.Store = searchlayer.NewSearchLayer(&TestStore{
		h.SQLStore,
	}, h.SearchEngine, config)
}

func (h *MainHelper) ToggleReplicasOff() {
	if h.SQLStore.GetLicense() == nil {
		panic("expecting a license to use this")
	}
	h.Settings.DataSourceReplicas = []string{}
	lic := h.SQLStore.GetLicense()

	var err error
	h.SQLStore, err = sqlstore.New(*h.Settings, h.Logger, nil, sqlstore.DisableMorphLogging())
	if err != nil {
		panic(err)
	}
	h.SQLStore.UpdateLicense(lic)
}

func (h *MainHelper) ToggleReplicasOn() {
	if h.SQLStore.GetLicense() == nil {
		panic("expecting a license to use this")
	}
	h.Settings.DataSourceReplicas = h.replicas
	lic := h.SQLStore.GetLicense()

	var err error
	h.SQLStore, err = sqlstore.New(*h.Settings, h.Logger, nil, sqlstore.DisableMorphLogging())
	if err != nil {
		panic(err)
	}

	h.SQLStore.UpdateLicense(lic)
}

func (h *MainHelper) setupResources() {
	var err error
	h.testResourcePath, err = SetupTestResources()
	if err != nil {
		panic("failed to setup test resources: " + err.Error())
	}
}

// PreloadMigrations preloads the migrations and roles into the database
// so that they are not run again when the migrations happen every time
// the server is started.
// This change is forward-compatible with new migrations and only new migrations
// will get executed.
// Only if the schema of either roles or systems table changes, this will break.
// In that case, just update the migrations or comment this out for the time being.
// In the worst case, only an optimization is lost.
//
// Re-generate the files with:
// pg_dump -a -h localhost -U mmuser -d <> --no-comments --inserts -t roles -t systems
// mysqldump -u root -p <> --no-create-info --extended-insert=FALSE Systems Roles
// And keep only the permission related rows in the systems table output.
func preloadMigrations(driverName string, sqlStore *sqlstore.SqlStore) {
	var buf []byte
	var err error

	switch driverName {
	case model.DatabaseDriverPostgres:
		finalPath := filepath.Join(server.GetPackagePath(), "channels", "testlib", "testdata", "postgres_migration_warmup.sql")
		buf, err = os.ReadFile(finalPath)
		if err != nil {
			panic(fmt.Errorf("cannot read file: %v", err))
		}
	default:
		panic(fmt.Errorf("unsupported database driver: %s", driverName))
	}
	handle := sqlStore.GetMaster()
	_, err = handle.Exec(string(buf))
	if err != nil {
		panic(errors.Wrap(err, "Error preloading migrations. Perhaps the schema changed? If yes, then update the warmup files accordingly"))
	}
}

func (h *MainHelper) PreloadMigrations() {
	preloadMigrations(*h.Settings.DriverName, h.SQLStore)
}

func (h *MainHelper) Close() error {
	if h.SQLStore != nil {
		h.SQLStore.Close()
	}
	if h.Settings != nil {
		storetest.CleanupSqlSettings(h.Settings)
	}
	if h.testResourcePath != "" {
		os.RemoveAll(h.testResourcePath)
	}

	if h.storePool != nil {
		h.storePool.Close()
	}

	if r := recover(); r != nil {
		log.Fatalln(r)
	}

	os.Exit(h.status)

	return nil
}

func (h *MainHelper) GetSQLSettings() *model.SqlSettings {
	if h.Settings == nil {
		panic("MainHelper not initialized with database access.")
	}

	return h.Settings
}

func (h *MainHelper) GetStore() store.Store {
	if h.Store == nil {
		panic("MainHelper not initialized with store.")
	}

	return h.Store
}

func (h *MainHelper) GetSQLStore() *sqlstore.SqlStore {
	if h.SQLStore == nil {
		panic("MainHelper not initialized with sql store.")
	}

	return h.SQLStore
}

func (h *MainHelper) GetClusterInterface() *FakeClusterInterface {
	if h.ClusterInterface == nil {
		panic("MainHelper not initialized with cluster interface.")
	}

	return h.ClusterInterface
}

func (h *MainHelper) GetSearchEngine() *searchengine.Broker {
	if h.SearchEngine == nil {
		panic("MainHelper not initialized with search engine")
	}

	return h.SearchEngine
}

func (h *MainHelper) Parallel(t *testing.T) {
	if h.Options.RunParallel {
		t.Parallel()
	}
}
