// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package views

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestNewViewService(t *testing.T) {
	t.Run("fails when ViewStore is nil", func(t *testing.T) {
		_, err := New(ServiceConfig{
			PropertyGroupStore: &mocks.PropertyGroupStore{},
			PropertyFieldStore: &mocks.PropertyFieldStore{},
		})
		require.Error(t, err)
	})

	t.Run("fails when PropertyGroupStore is nil", func(t *testing.T) {
		_, err := New(ServiceConfig{
			ViewStore:          &mocks.ViewStore{},
			PropertyFieldStore: &mocks.PropertyFieldStore{},
		})
		require.Error(t, err)
	})

	t.Run("fails when PropertyFieldStore is nil", func(t *testing.T) {
		_, err := New(ServiceConfig{
			ViewStore:          &mocks.ViewStore{},
			PropertyGroupStore: &mocks.PropertyGroupStore{},
		})
		require.Error(t, err)
	})

	t.Run("fails when boards property group does not exist", func(t *testing.T) {
		propertyGroupStore := &mocks.PropertyGroupStore{}
		propertyGroupStore.On("Get", model.BoardsPropertyGroupName).
			Return(nil, store.NewErrNotFound("PropertyGroup", model.BoardsPropertyGroupName))

		_, err := New(ServiceConfig{
			ViewStore:          &mocks.ViewStore{},
			PropertyGroupStore: propertyGroupStore,
			PropertyFieldStore: &mocks.PropertyFieldStore{},
		})
		require.Error(t, err)
	})

	t.Run("fails when board property field does not exist", func(t *testing.T) {
		boardGroup := &model.PropertyGroup{
			ID:   model.NewId(),
			Name: model.BoardsPropertyGroupName,
		}
		propertyGroupStore := &mocks.PropertyGroupStore{}
		propertyGroupStore.On("Get", model.BoardsPropertyGroupName).Return(boardGroup, nil)

		propertyFieldStore := &mocks.PropertyFieldStore{}
		propertyFieldStore.On("GetFieldByName", boardGroup.ID, "", model.BoardsPropertyFieldNameBoard).
			Return(nil, store.NewErrNotFound("PropertyField", "board"))

		_, err := New(ServiceConfig{
			ViewStore:          &mocks.ViewStore{},
			PropertyGroupStore: propertyGroupStore,
			PropertyFieldStore: propertyFieldStore,
		})
		require.Error(t, err)
	})

	t.Run("succeeds and caches board property field ID", func(t *testing.T) {
		boardGroup := &model.PropertyGroup{
			ID:   model.NewId(),
			Name: model.BoardsPropertyGroupName,
		}
		boardField := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: boardGroup.ID,
			Name:    model.BoardsPropertyFieldNameBoard,
		}
		propertyGroupStore := &mocks.PropertyGroupStore{}
		propertyGroupStore.On("Get", model.BoardsPropertyGroupName).Return(boardGroup, nil)

		propertyFieldStore := &mocks.PropertyFieldStore{}
		propertyFieldStore.On("GetFieldByName", boardGroup.ID, "", model.BoardsPropertyFieldNameBoard).
			Return(boardField, nil)

		svc, err := New(ServiceConfig{
			ViewStore:          &mocks.ViewStore{},
			PropertyGroupStore: propertyGroupStore,
			PropertyFieldStore: propertyFieldStore,
		})
		require.NoError(t, err)
		require.Equal(t, boardField.ID, svc.boardPropertyFieldID)
	})
}
