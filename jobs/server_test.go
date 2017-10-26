// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/utils"
)

func TestJobServer_LoadLicense(t *testing.T) {
	if utils.T == nil {
		utils.TranslationsPreInit()
	}

	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	server := &JobServer{
		Store: mockStore,
	}

	mockStore.SystemStore.On("Get").Return(storetest.NewStoreChannel(store.StoreResult{
		Data: model.StringMap{
			model.SYSTEM_ACTIVE_LICENSE_ID: "thelicenseid00000000000000",
		},
	}))
	mockStore.LicenseStore.On("Get", "thelicenseid00000000000000").Return(storetest.NewStoreChannel(store.StoreResult{
		Data: &model.LicenseRecord{
			Id: "thelicenseid00000000000000",
		},
	}))

	server.LoadLicense()
}
