package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTermsOfServiceStore(t *testing.T) {
	StoreTest(t, storetest.TestTermsOfServiceStore)
}

func TestTermsOfServiceStoreTermsOfServiceCache(t *testing.T) {

	fakeTermsOfService := model.TermsOfService{Id: "123", CreateAt: 11111, UserId: "321", Text: "Terms of service test"}

	t.Run("first call by latest not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		termsOfService, err := cachedStore.TermsOfService().GetLatest(true)
		require.Nil(t, err)
		assert.Equal(t, termsOfService, &fakeTermsOfService)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "GetLatest", 1)
		termsOfService, err = cachedStore.TermsOfService().GetLatest(true)
		require.Nil(t, err)
		assert.Equal(t, termsOfService, &fakeTermsOfService)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "GetLatest", 1)
	})

	t.Run("first call by id not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		termsOfService, err := cachedStore.TermsOfService().Get("123", true)
		require.Nil(t, err)
		assert.Equal(t, termsOfService, &fakeTermsOfService)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 1)
		termsOfService, err = cachedStore.TermsOfService().Get("123", true)
		require.Nil(t, err)
		assert.Equal(t, termsOfService, &fakeTermsOfService)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("first call by id not cached, second force no cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.TermsOfService().Get("123", true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.TermsOfService().Get("123", false)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call latest not cached, second force no cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.TermsOfService().GetLatest(true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "GetLatest", 1)
		cachedStore.TermsOfService().GetLatest(false)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "GetLatest", 2)
	})

	t.Run("first call by id force no cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.TermsOfService().Get("123", false)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.TermsOfService().Get("123", true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 2)
		cachedStore.TermsOfService().Get("123", true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call latest force no cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.TermsOfService().GetLatest(false)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "GetLatest", 1)
		cachedStore.TermsOfService().GetLatest(true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "GetLatest", 2)
		cachedStore.TermsOfService().GetLatest(true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "GetLatest", 2)
	})

	t.Run("first call by id, second call latest cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.TermsOfService().Get("123", true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.TermsOfService().GetLatest(true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "GetLatest", 0)
	})

	t.Run("first call latest, second call by id cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.TermsOfService().GetLatest(true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "GetLatest", 1)
		cachedStore.TermsOfService().Get("123", true)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 0)
	})

	t.Run("first call by id not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.TermsOfService().Get("123", false)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.TermsOfService().Save(&fakeTermsOfService)
		cachedStore.TermsOfService().Get("123", false)
		mockStore.TermsOfService().(*mocks.TermsOfServiceStore).AssertNumberOfCalls(t, "Get", 2)
	})
}
