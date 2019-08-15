package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRoleStore(t *testing.T) {
	StoreTest(t, storetest.TestRoleStore)
}

func TestRoleStoreCache(t *testing.T) {
	fakeRole := model.Role{Name: "role-name"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockRolesStore := mocks.RoleStore{}
		mockRolesStore.On("Save", &fakeRole).Return(&model.Role{}, nil)
		mockRolesStore.On("Delete", &fakeRole).Return(&model.Role{}, nil)
		mockRolesStore.On("GetByName", "role-name").Return(&fakeRole, nil)
		mockRolesStore.On("GetByNames", []string{"role-name"}).Return([]*model.Role{&fakeRole}, nil)
		mockStore.On("Role").Return(&mockRolesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		role, err := cachedStore.Role().GetByName("role-name")
		require.Nil(t, err)
		assert.Equal(t, role, []*model.Role{&fakeRole})
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 1)
		require.Nil(t, err)
		assert.Equal(t, role, []*model.Role{&fakeRole})
		cachedStore.Role().GetByName("role-name")
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 1)
	})

	t.Run("first call not cached, second force no cached", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockRolesStore := mocks.RoleStore{}
		mockRolesStore.On("Save", &fakeRole).Return(&model.Role{}, nil)
		mockRolesStore.On("Delete", &fakeRole).Return(&model.Role{}, nil)
		mockRolesStore.On("GetByName", "role-name").Return([]*model.Role{&fakeRole}, nil)
		mockStore.On("Role").Return(&mockRolesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Role().GetByName("role-name")
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Role().GetByName("role-name")
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockRolesStore := mocks.RoleStore{}
		mockRolesStore.On("Save", &fakeRole).Return(&model.Role{}, nil)
		mockRolesStore.On("Delete", &fakeRole).Return(&model.Role{}, nil)
		mockRolesStore.On("GetByName", "role-name").Return([]*model.Role{&fakeRole}, nil)
		mockStore.On("Role").Return(&mockRolesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Role().GetByName("role-name")
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Role().Save(&fakeRole)
		cachedStore.Role().GetByName("role-name")
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call not cached, delete, and then not cached again", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockRolesStore := mocks.RoleStore{}
		mockRolesStore.On("Save", &fakeRole).Return(&model.Role{}, nil)
		mockRolesStore.On("Delete", &fakeRole).Return(&fakeRole, nil)
		mockRolesStore.On("GetByName", "role-name").Return([]*model.Role{&fakeRole}, nil)
		mockStore.On("Role").Return(&mockRolesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Role().GetByName("role-name")
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Role().Delete("123")
		cachedStore.Role().GetByName("role-name")
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call not cached, permanent delete all, and then not cached again", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockRolesStore := mocks.RoleStore{}
		mockRolesStore.On("Save", &fakeRole).Return(&model.Role{}, nil)
		mockRolesStore.On("Delete", &fakeRole).Return(&model.Role{}, nil)
		mockRolesStore.On("GetByName", "role-name").Return([]*model.Role{&fakeRole}, nil)
		mockStore.On("Role").Return(&mockRolesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Role().GetByName("role-name")
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Role().PermanentDeleteAll()
		cachedStore.Role().GetByName("role-name")
		mockRolesStore.AssertNumberOfCalls(t, "GetByName", 2)
	})
}
