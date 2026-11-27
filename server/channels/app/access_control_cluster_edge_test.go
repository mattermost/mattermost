// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// setValueOnPeerNodeWithBroadcast writes on the shared database and then does what the peer
// node's app layer does to the shared store state after a write: drop the shared cache entries and
// broadcast whatever cluster messages the cache layer sends for that. Every captured message is
// then delivered to this node. Unlike setValueOnPeerNode, this follows the cache provider: with a
// shared cache the store sends no invalidation message at all.
func (f *userAttributeClusterFixture) setValueOnPeerNodeWithBroadcast(t *testing.T, userID, v string) {
	t.Helper()
	f.setValueOnPeerNode(t, userID, v)

	f.cluster.reset()
	f.th.App.Srv().Store().Attributes().InvalidateUserPropertyValuesEpoch(userID)
	f.th.App.Srv().Store().Attributes().InvalidateUserAttributes(userID)
	for _, msg := range f.cluster.snapshot() {
		f.cluster.deliver(t, msg)
	}
}

func setupUserAttributeClusterFixtureWithSharedCache(t *testing.T) *userAttributeClusterFixture {
	if testing.Short() {
		t.SkipNow()
	}

	cluster := &handlerRecordingClusterMock{}
	redisHost := "localhost"
	if os.Getenv("IS_CI") == "true" {
		redisHost = "redis"
	}
	useSharedCache := func(cfg *model.Config) {
		cfg.CacheSettings.CacheType = model.NewPointer(model.CacheTypeRedis)
		cfg.CacheSettings.RedisAddress = model.NewPointer(redisHost + ":6379")
		cfg.CacheSettings.DisableClientCache = model.NewPointer(true)
		cfg.CacheSettings.RedisDB = model.NewPointer(0)
		cfg.CacheSettings.RedisCachePrefix = model.NewPointer(model.NewId())
	}

	dbStore, sqlStore, dbSettings, searchEngine := setupStores(t)
	th := setupTestHelper(dbStore, sqlStore, dbSettings, searchEngine, true, true, useSharedCache,
		[]Option{SetCluster(cluster), ForceEnableRedis()}, t).InitBasic(t)
	require.Equal(t, model.CacheTypeRedis, *th.App.Config().CacheSettings.CacheType)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	})
	require.True(t, th.App.attributeBasedAccessControlEnabled())

	cpaGroup, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)
	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)

	return &userAttributeClusterFixture{th: th, cluster: cluster, field: field}
}

// holdRefresh makes the attribute view look mid-refresh, as when another request on this node
// started a refresh whose snapshot predates the write. The returned func ends it the way a
// successful refresh does.
func (f *userAttributeClusterFixture) holdRefresh() (finish func()) {
	ch := f.th.App.Srv().Channels()
	ch.attributeViewRefreshMut.Lock()
	return func() {
		ch.attributeViewRefreshLast = time.Now()
		ch.attributeViewRefreshMut.Unlock()
	}
}

func TestUserAttributeChangeNotRecachedFromOutdatedView(t *testing.T) {
	t.Run("peer node change while a refresh is in flight and the user is active", func(t *testing.T) {
		f := setupUserAttributeClusterFixture(t)
		user := f.th.BasicUser

		f.setValueViaApp(t, user.Id, "before")
		require.Equal(t, "before", f.subjectValue(t, user))
		f.markViewFresh()

		finish := f.holdRefresh()
		f.setValueOnPeerNode(t, user.Id, "after")
		f.cluster.deliver(t, userAttributesInvalidation(user.Id))
		// A subject build for the same user lands while the refresh runs, e.g. websocket delivery.
		f.subjectValue(t, user)
		finish()

		assert.Equal(t, "after", f.subjectValue(t, user), "a build after the follow-up refresh must see the new value, not one cached from the view the refresh was replacing")
	})

	t.Run("same node change while a refresh is in flight and the user is active", func(t *testing.T) {
		f := setupUserAttributeClusterFixture(t)
		user := f.th.BasicUser

		f.setValueViaApp(t, user.Id, "before")
		require.Equal(t, "before", f.subjectValue(t, user))
		f.markViewFresh()

		finish := f.holdRefresh()
		f.setValueViaApp(t, user.Id, "after")
		f.subjectValue(t, user)
		finish()

		assert.Equal(t, "after", f.subjectValue(t, user), "a build after the follow-up refresh must see the new value, not one cached from the view the refresh was replacing")
	})

	t.Run("subject read in flight when the peer invalidation arrives", func(t *testing.T) {
		f := setupUserAttributeClusterFixture(t)
		user := f.th.BasicUser

		f.setValueViaApp(t, user.Id, "before")
		require.Equal(t, "before", f.subjectValue(t, user))
		f.markViewFresh()

		// A build already past its refresh check reads the subject store after the message has
		// dropped the cached entry, so it reads the not-yet-refreshed view and caches the result.
		f.setValueOnPeerNode(t, user.Id, "after")
		f.cluster.deliver(t, userAttributesInvalidation(user.Id))
		group, err := f.th.App.Srv().propertyService.Group(model.AccessControlPropertyGroupName)
		require.NoError(t, err)
		_, err = f.th.App.Srv().Store().Attributes().GetSubject(f.th.Context, user.Id, group.ID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, err)

		assert.Equal(t, "after", f.subjectValue(t, user), "the next build after the invalidation must see the new value, not one cached by a read that raced it")
	})
}

func TestUserAttributeChangeFromPeerNodeVisibleWithSharedCache(t *testing.T) {
	t.Run("local cache provider", func(t *testing.T) {
		f := setupUserAttributeClusterFixture(t)
		user := f.th.BasicUser

		f.setValueViaApp(t, user.Id, "before")
		require.Equal(t, "before", f.subjectValue(t, user))
		f.markViewFresh()

		f.setValueOnPeerNodeWithBroadcast(t, user.Id, "after")
		assert.Equal(t, "after", f.subjectValue(t, user))
	})

	t.Run("redis cache provider", func(t *testing.T) {
		f := setupUserAttributeClusterFixtureWithSharedCache(t)
		user := f.th.BasicUser

		f.setValueViaApp(t, user.Id, "before")
		require.Equal(t, "before", f.subjectValue(t, user))
		f.markViewFresh()

		f.setValueOnPeerNodeWithBroadcast(t, user.Id, "after")
		assert.Equal(t, "after", f.subjectValue(t, user), "with a shared cache, the next build on another node must see the new value rather than re-filling the shared cache from the not-yet-refreshed view")
	})
}
