package searchlayer_test

import (
	"os"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/v5/store/searchlayer"

	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/testlib"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestUpdateConfigRacePartA(t *testing.T) {
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
	var wg sync.WaitGroup
	values := make(chan int, 5)
	defer close(values)

	wg.Add(5)
	for i := 0; i < 5; i++ {
		go func(num int) {
			defer wg.Done()
			dupConfig := cfg.Clone()
			*dupConfig.ClusterSettings.MaxIdleConns = num
			values <- *dupConfig.ClusterSettings.MaxIdleConns
			layer.UpdateConfig(dupConfig)
		}(i)
	}

	wg.Wait()

	for i := 0; i < 4; i++ {
		<-values
	}

	assert.Equal(t, <-values, *layer.GetConfig().ClusterSettings.MaxIdleConns)

}
