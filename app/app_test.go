// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"flag"
	"os"
	"testing"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
)

func TestMain(m *testing.M) {
	flag.Parse()

	// In the case where a dev just wants to run a single test, it's faster to just use the default
	// store.
	if filter := flag.Lookup("test.run").Value.String(); filter != "" && filter != "." {
		utils.TranslationsPreInit()
		utils.LoadConfig("config.json")
		l4g.Info("-test.run used, not creating temporary containers")
		os.Exit(m.Run())
	}

	utils.TranslationsPreInit()
	utils.LoadConfig("config.json")
	utils.InitTranslations(utils.Cfg.LocalizationSettings)

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
