// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"flag"
	"os"
	"testing"

	l4g "github.com/alecthomas/log4go"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
)

func TestMain(m *testing.M) {
	flag.Parse()
	utils.TranslationsPreInit()

	// In the case where a dev just wants to run a single test, it's faster to just use the default
	// store.
	if filter := flag.Lookup("test.run").Value.String(); filter != "" && filter != "." {
		l4g.Info("-test.run used, not creating temporary containers")
		os.Exit(m.Run())
	}

	status := 0

	container, settings, err := storetest.NewMySQLContainer()
	if err != nil {
		panic(err)
	}

	UseTestStore(container, settings)

	defer func() {
		StopTestStore()
		os.Exit(status)
	}()

	status = m.Run()
}

func TestAppRace(t *testing.T) {
	for i := 0; i < 10; i++ {
		a := New()
		a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
		a.StartServer()
		a.Shutdown()
	}
}

func TestUpdateConfig(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	prev := *th.App.Config().ServiceSettings.SiteURL
	defer th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = prev
	})

	listener := utils.AddConfigListener(func(old, current *model.Config) {
		assert.Equal(t, prev, *old.ServiceSettings.SiteURL)
		assert.Equal(t, "foo", *current.ServiceSettings.SiteURL)
	})
	defer utils.RemoveConfigListener(listener)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "foo"
	})
}
