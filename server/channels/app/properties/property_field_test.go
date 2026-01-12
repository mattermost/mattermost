// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// mockPropertyFieldStore is a mock implementation of PropertyFieldStore interface
type mockPropertyFieldStore struct {
	mock.Mock
}

func (m *mockPropertyFieldStore) Create(field *model.PropertyField) (*model.PropertyField, error) {
	args := m.Called(field)
	return args.Get(0).(*model.PropertyField), args.Error(1)
}

func (m *mockPropertyFieldStore) Get(groupID, id string) (*model.PropertyField, error) {
	args := m.Called(groupID, id)
	return args.Get(0).(*model.PropertyField), args.Error(1)
}

func (m *mockPropertyFieldStore) GetMany(groupID string, ids []string) ([]*model.PropertyField, error) {
	args := m.Called(groupID, ids)
	return args.Get(0).([]*model.PropertyField), args.Error(1)
}

func (m *mockPropertyFieldStore) GetFieldByName(groupID, targetID, name string) (*model.PropertyField, error) {
	args := m.Called(groupID, targetID, name)
	return args.Get(0).(*model.PropertyField), args.Error(1)
}

func (m *mockPropertyFieldStore) CountForGroup(groupID string, includeDeleted bool) (int64, error) {
	args := m.Called(groupID, includeDeleted)
	return args.Get(0).(int64), args.Error(1)
}

func (m *mockPropertyFieldStore) CountForTarget(groupID, targetType, targetID string, includeDeleted bool) (int64, error) {
	args := m.Called(groupID, targetType, targetID, includeDeleted)
	return args.Get(0).(int64), args.Error(1)
}

func (m *mockPropertyFieldStore) SearchPropertyFields(opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	args := m.Called(opts)
	return args.Get(0).([]*model.PropertyField), args.Error(1)
}

func (m *mockPropertyFieldStore) Update(groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	args := m.Called(groupID, fields)
	return args.Get(0).([]*model.PropertyField), args.Error(1)
}

func (m *mockPropertyFieldStore) Delete(groupID string, id string) error {
	args := m.Called(groupID, id)
	return args.Error(0)
}

func TestPropertyService_CountActivePropertyFieldsForGroup(t *testing.T) {
	t.Run("should return count of active property fields for a group", func(t *testing.T) {
		// Create a mock store
		mockStore := &mockPropertyFieldStore{}
		mockStore.On("CountForGroup", "group1", false).Return(int64(5), nil)

		// Create the service
		service := &PropertyService{
			fieldStore: mockStore,
		}

		// Call the method
		count, err := service.CountActivePropertyFieldsForGroup("group1")

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, int64(5), count)
		mockStore.AssertExpectations(t)
	})

	t.Run("should return error when store fails", func(t *testing.T) {
		// Create a mock store
		mockStore := &mockPropertyFieldStore{}
		mockStore.On("CountForGroup", "group1", false).Return(int64(0), model.NewAppError("test", "test.error", nil, "", 500))

		// Create the service
		service := &PropertyService{
			fieldStore: mockStore,
		}

		// Call the method
		count, err := service.CountActivePropertyFieldsForGroup("group1")

		// Verify the results
		require.Error(t, err)
		assert.Equal(t, int64(0), count)
		mockStore.AssertExpectations(t)
	})

	t.Run("should return 0 for empty group", func(t *testing.T) {
		// Create a mock store
		mockStore := &mockPropertyFieldStore{}
		mockStore.On("CountForGroup", "empty-group", false).Return(int64(0), nil)

		// Create the service
		service := &PropertyService{
			fieldStore: mockStore,
		}

		// Call the method
		count, err := service.CountActivePropertyFieldsForGroup("empty-group")

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
		mockStore.AssertExpectations(t)
	})
}

func TestPropertyService_CountAllPropertyFieldsForGroup(t *testing.T) {
	t.Run("should return count of all property fields including deleted for a group", func(t *testing.T) {
		// Create a mock store
		mockStore := &mockPropertyFieldStore{}
		mockStore.On("CountForGroup", "group1", true).Return(int64(8), nil)

		// Create the service
		service := &PropertyService{
			fieldStore: mockStore,
		}

		// Call the method
		count, err := service.CountAllPropertyFieldsForGroup("group1")

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, int64(8), count)
		mockStore.AssertExpectations(t)
	})

	t.Run("should return error when store fails", func(t *testing.T) {
		// Create a mock store
		mockStore := &mockPropertyFieldStore{}
		mockStore.On("CountForGroup", "group1", true).Return(int64(0), model.NewAppError("test", "test.error", nil, "", 500))

		// Create the service
		service := &PropertyService{
			fieldStore: mockStore,
		}

		// Call the method
		count, err := service.CountAllPropertyFieldsForGroup("group1")

		// Verify the results
		require.Error(t, err)
		assert.Equal(t, int64(0), count)
		mockStore.AssertExpectations(t)
	})

	t.Run("should return 0 for empty group", func(t *testing.T) {
		// Create a mock store
		mockStore := &mockPropertyFieldStore{}
		mockStore.On("CountForGroup", "empty-group", true).Return(int64(0), nil)

		// Create the service
		service := &PropertyService{
			fieldStore: mockStore,
		}

		// Call the method
		count, err := service.CountAllPropertyFieldsForGroup("empty-group")

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
		mockStore.AssertExpectations(t)
	})

	t.Run("should return higher count than active fields when there are deleted fields", func(t *testing.T) {
		// Create a mock store
		mockStore := &mockPropertyFieldStore{}
		mockStore.On("CountForGroup", "group1", false).Return(int64(5), nil)
		mockStore.On("CountForGroup", "group1", true).Return(int64(8), nil)

		// Create the service
		service := &PropertyService{
			fieldStore: mockStore,
		}

		// Call both methods
		activeCount, err := service.CountActivePropertyFieldsForGroup("group1")
		require.NoError(t, err)

		allCount, err := service.CountAllPropertyFieldsForGroup("group1")
		require.NoError(t, err)

		// Verify that all count is higher than active count
		assert.Equal(t, int64(5), activeCount)
		assert.Equal(t, int64(8), allCount)
		assert.True(t, allCount > activeCount)
		mockStore.AssertExpectations(t)
	})
}
