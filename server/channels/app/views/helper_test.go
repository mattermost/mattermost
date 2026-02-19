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

	boardGroup, err := dbStore.PropertyGroup().Register(model.BoardsPropertyGroupName)
	require.NoError(tb, err, "failed to register boards property group")

	seededField, err := dbStore.PropertyField().Create(&model.PropertyField{
		GroupID:    boardGroup.ID,
		Name:       model.BoardsPropertyFieldNameBoard,
		Type:       model.PropertyFieldTypeText,
		ObjectType: "post",
	})
	require.NoError(tb, err, "failed to seed board property field")

	svc, err := New(ServiceConfig{
		ViewStore:          dbStore.View(),
		PropertyGroupStore: dbStore.PropertyGroup(),
		PropertyFieldStore: dbStore.PropertyField(),
	})
	require.NoError(tb, err)
	require.Equal(tb, seededField.ID, svc.boardPropertyFieldID)

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
