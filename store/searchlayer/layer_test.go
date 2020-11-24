package searchlayer_test

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v5/store/searchlayer"

	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/testlib"

	"github.com/mattermost/mattermost-server/v5/model"
)

// Test to verify race condition on UpdateConfig. The test must run with -race flag in order to verify
// that there is no race. Ref: (#MM-30868)
func TestUpdateConfigRace(t *testing.T) {
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DATABASE_DRIVER_POSTGRES
	}
	settings := storetest.MakeSqlSettings(driverName)
	store := sqlstore.NewSqlSupplier(*settings, nil)

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ClusterSettings.MaxIdleConns = model.NewInt(1)
	searchEngine := searchengine.NewBroker(cfg, nil)
	layer := searchlayer.NewSearchLayer(&testlib.TestStore{Store: store}, searchEngine, cfg)

	for i := 0; i < 5; i++ {
		go func() {
			layer.UpdateConfig(cfg.Clone())
		}()
	}
}
