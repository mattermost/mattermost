// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

var sqlStore store.Store

func StoreTest(t *testing.T, f func(*testing.T, store.Store)) {
	if sqlStore == nil {
		utils.TranslationsPreInit()
		utils.LoadConfig("config.json")
		utils.InitTranslations(utils.Cfg.LocalizationSettings)
		sqlStore = store.NewLayeredStore(NewSqlSupplier(nil), nil, nil)

		sqlStore.MarkSystemRanUnitTests()
	}
	f(t, sqlStore)
}
