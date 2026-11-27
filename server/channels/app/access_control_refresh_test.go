// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

// purgeCountingStore stands in for the local cache layer's subject cache purge, so a test can see
// whether a refresh dropped the cached subjects.
type purgeCountingStore struct {
	store.Store
	purges *int
}

func (s purgeCountingStore) PurgeUserAttributesCacheWithoutBroadcast() { *s.purges++ }

type attributeViewRefreshFixture struct {
	th     *TestHelper
	ch     *Channels
	attrs  *storemocks.AttributesStore
	purges int
}

func setupAttributeViewRefreshFixture(t *testing.T) *attributeViewRefreshFixture {
	th := SetupWithStoreMock(t)
	mockStore := th.App.Srv().Store().(*storemocks.Store)
	attrs := &storemocks.AttributesStore{}
	mockStore.On("Attributes").Return(attrs)

	f := &attributeViewRefreshFixture{th: th, ch: th.App.Srv().Channels(), attrs: attrs}
	th.App.Srv().SetStore(purgeCountingStore{Store: mockStore, purges: &f.purges})
	t.Cleanup(func() { th.App.Srv().SetStore(mockStore) })
	return f
}

// setRefreshedAt makes the view look refreshed at the given time with no follow-up pending.
func (f *attributeViewRefreshFixture) setRefreshedAt(at time.Time) {
	f.ch.attributeViewRefreshMut.Lock()
	f.ch.attributeViewRefreshLast = at
	f.ch.attributeViewRefreshMut.Unlock()
	f.ch.attributeViewNeedsRefresh.Store(false)
}

func TestRefreshAttributeViewAfterFailedRefresh(t *testing.T) {
	t.Run("follow-up flag set during an earlier refresh survives a failed refresh", func(t *testing.T) {
		f := setupAttributeViewRefreshFixture(t)
		f.setRefreshedAt(time.Now())
		f.ch.attributeViewNeedsRefresh.Store(true)

		f.attrs.On("RefreshAttributes").Return(errors.New("refresh failed")).Once()
		f.th.App.refreshAttributeViewIfStale(f.th.Context)

		assert.True(t, f.ch.attributeViewNeedsRefresh.Load(), "a failed refresh must leave the follow-up pending")
		assert.Zero(t, f.purges, "a failed refresh must not drop cached subjects")

		f.attrs.On("RefreshAttributes").Return(nil).Once()
		f.th.App.refreshAttributeViewIfStale(f.th.Context)

		assert.False(t, f.ch.attributeViewNeedsRefresh.Load())
		assert.Equal(t, 1, f.purges, "the retried refresh must drop subjects cached from the replaced view")
		f.attrs.AssertNumberOfCalls(t, "RefreshAttributes", 2)
	})

	t.Run("view marked stale stays stale after a failed refresh", func(t *testing.T) {
		f := setupAttributeViewRefreshFixture(t)
		f.setRefreshedAt(time.Now())
		f.th.App.invalidateAttributeViewCache()

		f.attrs.On("RefreshAttributes").Return(errors.New("refresh failed")).Once()
		f.th.App.refreshAttributeViewIfStale(f.th.Context)
		assert.Zero(t, f.purges)

		f.attrs.On("RefreshAttributes").Return(nil).Once()
		f.th.App.refreshAttributeViewIfStale(f.th.Context)

		assert.Equal(t, 1, f.purges, "the retried refresh must drop subjects cached from the replaced view")
		f.attrs.AssertNumberOfCalls(t, "RefreshAttributes", 2)
	})
}

func TestRefreshAttributeViewInvalidatedDuringPeriodicRefresh(t *testing.T) {
	t.Run("invalidation during a periodic refresh drops cached subjects when it completes", func(t *testing.T) {
		f := setupAttributeViewRefreshFixture(t)
		f.setRefreshedAt(time.Now().Add(-2 * attributeViewRefreshInterval))

		// The invalidation arrives while the refresh holds the lock, as a peer node's message
		// handled during this node's periodic refresh does. Subject reads blocked behind that
		// refresh return what it read, which may predate the change, and a shared cache makes
		// whatever they store visible to every node.
		f.attrs.On("RefreshAttributes").Run(func(mock.Arguments) {
			f.th.App.invalidateAttributeViewCache()
		}).Return(nil).Once()
		f.th.App.refreshAttributeViewIfStale(f.th.Context)

		require.True(t, f.ch.attributeViewNeedsRefresh.Load(), "the invalidation should still flag a follow-up refresh")
		assert.Equal(t, 1, f.purges, "subjects cached from reads overlapping the refresh must be dropped when it completes, not only on the follow-up")
	})

	t.Run("periodic refresh without an overlapping invalidation keeps cached subjects", func(t *testing.T) {
		f := setupAttributeViewRefreshFixture(t)
		f.setRefreshedAt(time.Now().Add(-2 * attributeViewRefreshInterval))

		f.attrs.On("RefreshAttributes").Return(nil).Once()
		f.th.App.refreshAttributeViewIfStale(f.th.Context)

		assert.False(t, f.ch.attributeViewNeedsRefresh.Load())
		assert.Zero(t, f.purges)
		f.attrs.AssertNumberOfCalls(t, "RefreshAttributes", 1)
	})
}
