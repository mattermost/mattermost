package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSchemeStore(t *testing.T) {
	StoreTest(t, storetest.TestSchemeStore)
}

func TestSchemeStoreCache(t *testing.T) {
	fakeScheme := model.Scheme{Name: "scheme-name"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockSchemesStore := mocks.SchemeStore{}
		mockSchemesStore.On("Save", &fakeScheme).Return(&model.Scheme{}, nil)
		mockSchemesStore.On("Delete", &fakeScheme).Return(&model.Scheme{}, nil)
		mockSchemesStore.On("GetByName", "scheme-name").Return(&fakeScheme, nil)
		mockSchemesStore.On("GetByNames", []string{"scheme-name"}).Return([]*model.Scheme{&fakeScheme}, nil)
		mockStore.On("Scheme").Return(&mockSchemesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		scheme, err := cachedStore.Scheme().GetByName("scheme-name")
		require.Nil(t, err)
		assert.Equal(t, scheme, []*model.Scheme{&fakeScheme})
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 1)
		require.Nil(t, err)
		assert.Equal(t, scheme, []*model.Scheme{&fakeScheme})
		cachedStore.Scheme().GetByName("scheme-name")
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 1)
	})

	t.Run("first call not cached, second force no cached", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockSchemesStore := mocks.SchemeStore{}
		mockSchemesStore.On("Save", &fakeScheme).Return(&model.Scheme{}, nil)
		mockSchemesStore.On("Delete", &fakeScheme).Return(&model.Scheme{}, nil)
		mockSchemesStore.On("GetByName", "scheme-name").Return([]*model.Scheme{&fakeScheme}, nil)
		mockStore.On("Scheme").Return(&mockSchemesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Scheme().GetByName("scheme-name")
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Scheme().GetByName("scheme-name")
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockSchemesStore := mocks.SchemeStore{}
		mockSchemesStore.On("Save", &fakeScheme).Return(&model.Scheme{}, nil)
		mockSchemesStore.On("Delete", &fakeScheme).Return(&model.Scheme{}, nil)
		mockSchemesStore.On("GetByName", "scheme-name").Return([]*model.Scheme{&fakeScheme}, nil)
		mockStore.On("Scheme").Return(&mockSchemesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Scheme().GetByName("scheme-name")
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Scheme().Save(&fakeScheme)
		cachedStore.Scheme().GetByName("scheme-name")
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call not cached, delete, and then not cached again", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockSchemesStore := mocks.SchemeStore{}
		mockSchemesStore.On("Save", &fakeScheme).Return(&model.Scheme{}, nil)
		mockSchemesStore.On("Delete", &fakeScheme).Return(&fakeScheme, nil)
		mockSchemesStore.On("GetByName", "scheme-name").Return([]*model.Scheme{&fakeScheme}, nil)
		mockStore.On("Scheme").Return(&mockSchemesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Scheme().GetByName("scheme-name")
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Scheme().Delete("123")
		cachedStore.Scheme().GetByName("scheme-name")
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call not cached, permanent delete all, and then not cached again", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockSchemesStore := mocks.SchemeStore{}
		mockSchemesStore.On("Save", &fakeScheme).Return(&model.Scheme{}, nil)
		mockSchemesStore.On("Delete", &fakeScheme).Return(&model.Scheme{}, nil)
		mockSchemesStore.On("GetByName", "scheme-name").Return([]*model.Scheme{&fakeScheme}, nil)
		mockStore.On("Scheme").Return(&mockSchemesStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Scheme().GetByName("scheme-name")
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Scheme().PermanentDeleteAll()
		cachedStore.Scheme().GetByName("scheme-name")
		mockSchemesStore.AssertNumberOfCalls(t, "GetByName", 2)
	})
}
