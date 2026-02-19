// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package views

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type TestHelper struct {
	service *ViewService
	store   store.Store
	Context *request.Context
	TB      testing.TB
}

func Setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}

	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	svc, err := New(ServiceConfig{ViewStore: dbStore.View()})
	require.NoError(tb, err)

	return &TestHelper{
		service: svc,
		store:   dbStore,
		Context: request.EmptyContext(mlog.CreateConsoleTestLogger(tb)),
		TB:      tb,
	}
}

func makeView() *model.View {
	return &model.View{
		ChannelId: model.NewId(),
		Type:      model.ViewTypeBoard,
		CreatorId: model.NewId(),
		Title:     "Test View",
	}
}
