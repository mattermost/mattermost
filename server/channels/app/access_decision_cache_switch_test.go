// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

// setupAccessDecisionCacheOffTest is setupAccessDecisionCacheTest on a server started with
// AccessControlSettings.EnableDecisionCache off.
func setupAccessDecisionCacheOffTest(t *testing.T) *accessDecisionCacheHarness {
	t.Helper()
	h := setupChannelReadAccessTestWithConfig(t, func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableDecisionCache = false
	})
	acs := h.mockACS(t)
	governed(acs)
	channelPolicyGoverns(acs, h.th.BasicChannel.Id, false)
	return &accessDecisionCacheHarness{channelReadAccessHarness: h, acs: acs, session: h.rctx.Session()}
}

func TestAccessDecisionCacheSwitchedOff(t *testing.T) {
	t.Run("the cache isn't allocated and nothing sweeps it", func(t *testing.T) {
		h := setupAccessDecisionCacheOffTest(t)
		ch := h.th.App.Srv().Channels()

		assert.Nil(t, ch.accessDecisions)
		assert.Nil(t, ch.accessDecisionStop, "no maintenance goroutine runs")
		require.NotNil(t, ch.accessDecisionBroadcaster)

		require.NoError(t, h.th.TestLogger.Flush())
		logs := h.th.LogBuffer.String()
		testlib.AssertLog(t, strings.NewReader(logs), mlog.LvlInfo.Name, accessDecisionCacheDisabledLog)
		testlib.AssertNoLog(t, strings.NewReader(logs), mlog.LvlInfo.Name, accessDecisionCacheEnabledLog)
	})

	t.Run("every read check asks the PDP", func(t *testing.T) {
		h := setupAccessDecisionCacheOffTest(t)
		decides(h.acs, true)

		for range 3 {
			require.True(t, h.check(t))
		}
		require.Equal(t, 3, h.evaluations())
	})

	t.Run("every denied read check asks the PDP", func(t *testing.T) {
		h := setupAccessDecisionCacheOffTest(t)
		decides(h.acs, false)

		require.False(t, h.check(t))
		require.False(t, h.check(t))
		require.Equal(t, 2, h.evaluations())
	})

	t.Run("invalidations are still batched and sent to peers", func(t *testing.T) {
		h := setupAccessDecisionCacheOffTest(t)
		broadcaster := h.th.App.Srv().Channels().accessDecisionBroadcaster
		broadcaster.mu.Lock()
		broadcaster.delay = time.Hour
		broadcaster.mu.Unlock()
		broadcaster.flush()
		cluster := &testlib.FakeClusterInterface{}
		h.th.Server.Platform().SetCluster(cluster)

		h.th.App.Srv().Platform().InvalidateCacheForUser(h.th.BasicUser.Id)
		h.th.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeChannel, h.th.BasicChannel.Id)
		broadcaster.flush()

		msgs := cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			return msg.Event == model.ClusterEventInvalidateAccessDecisions
		})
		require.Len(t, msgs, 1, "both invalidations go out in one batch")
		var inv accessDecisionInvalidation
		require.NoError(t, json.Unmarshal(msgs[0].Data, &inv))
		assert.Contains(t, inv.Users, h.th.BasicUser.Id)
		assert.Equal(t, []string{h.th.BasicChannel.Id}, inv.Resources)
	})

	t.Run("shutdown flushes pending invalidations", func(t *testing.T) {
		h := setupAccessDecisionCacheOffTest(t)
		ch := h.th.App.Srv().Channels()
		ch.accessDecisionBroadcaster.mu.Lock()
		ch.accessDecisionBroadcaster.delay = time.Hour
		ch.accessDecisionBroadcaster.mu.Unlock()
		cluster := &testlib.FakeClusterInterface{}
		h.th.Server.Platform().SetCluster(cluster)

		h.th.App.Srv().Platform().InvalidateCacheForUser(h.th.BasicUser.Id)
		ch.stopAccessDecisionMaintenance()

		require.Len(t, cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			return msg.Event == model.ClusterEventInvalidateAccessDecisions
		}), 1)
	})

	t.Run("a received invalidation still evicts membership roles", func(t *testing.T) {
		h := setupAccessDecisionCacheOffTest(t)
		userID, channelID := h.th.BasicUser.Id, h.th.BasicChannel.Id
		cachedRoles := func() store.ChannelMemberRoles {
			t.Helper()
			roles, err := h.th.App.Srv().Store().Channel().GetChannelMemberRoles(h.th.Context, userID, []string{channelID}, true)
			require.NoError(t, err)
			return roles[channelID]
		}
		wasAdmin := cachedRoles().SchemeAdmin

		// The peer's write reaches the database, but not its eviction of this node's cache.
		member, err := h.th.GetSqlStore().Channel().GetMember(h.th.Context, channelID, userID)
		require.NoError(t, err)
		member.SchemeAdmin = !wasAdmin
		_, err = h.th.GetSqlStore().Channel().UpdateMember(h.th.Context, member)
		require.NoError(t, err)
		require.Equal(t, wasAdmin, cachedRoles().SchemeAdmin, "the old role is still cached")

		data, err := json.Marshal(accessDecisionInvalidation{UserResources: [][2]string{{userID, channelID}}})
		require.NoError(t, err)
		h.th.App.Srv().Channels().clusterInvalidateAccessDecisionsHandler(&model.ClusterMessage{Data: data})

		assert.Equal(t, !wasAdmin, cachedRoles().SchemeAdmin)
	})

	t.Run("a received invalidation still evicts user attributes", func(t *testing.T) {
		h := setupAccessDecisionCacheOffTest(t)
		userID := h.th.BasicUser.Id

		group, appErr := h.th.App.GetPropertyGroup(h.th.Context, model.AccessControlPropertyGroupName)
		require.Nil(t, appErr)
		field, appErr := h.th.App.CreatePropertyField(h.th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "department_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}, false, "")
		require.Nil(t, appErr)
		value := func(department string) *model.PropertyValue {
			return &model.PropertyValue{
				GroupID:    group.ID,
				FieldID:    field.ID,
				TargetType: model.PropertyFieldObjectTypeUser,
				TargetID:   userID,
				Value:      json.RawMessage(`"` + department + `"`),
			}
		}
		_, appErr = h.th.App.CreatePropertyValue(h.th.Context, value("Sales"))
		require.Nil(t, appErr)
		require.NoError(t, h.th.GetSqlStore().Attributes().RefreshAttributes())

		cachedDepartment := func() any {
			t.Helper()
			subject, err := h.th.App.Srv().Store().Attributes().GetSubject(h.th.Context, userID, group.ID, model.PropertyFieldObjectTypeUser)
			require.NoError(t, err)
			return subject.Attributes[field.Name]
		}
		require.Equal(t, "Sales", cachedDepartment())

		// The peer's write reaches the database, but not its eviction of this node's subject.
		_, err := h.th.GetSqlStore().PropertyValue().Upsert([]*model.PropertyValue{value("Engineering")})
		require.NoError(t, err)
		require.NoError(t, h.th.GetSqlStore().Attributes().RefreshAttributes())
		require.Equal(t, "Sales", cachedDepartment(), "the old subject is still cached")

		data, err := json.Marshal(accessDecisionInvalidation{Users: []string{userID}})
		require.NoError(t, err)
		h.th.App.Srv().Channels().clusterInvalidateAccessDecisionsHandler(&model.ClusterMessage{Data: data})

		assert.Equal(t, "Engineering", cachedDepartment())
	})

	t.Run("turning it on needs a restart", func(t *testing.T) {
		h := setupAccessDecisionCacheOffTest(t)
		decides(h.acs, true)

		h.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.AccessControlSettings.EnableDecisionCache = true })

		assert.Nil(t, h.th.App.Srv().Channels().accessDecisions)
		require.True(t, h.check(t))
		require.True(t, h.check(t))
		require.Equal(t, 2, h.evaluations())

		require.NoError(t, h.th.TestLogger.Flush())
		testlib.AssertLog(t, h.th.LogBuffer, mlog.LvlInfo.Name, accessDecisionCacheSwitchChangedLog)
	})
}

func TestAccessDecisionCacheSwitchedOn(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	require.NotNil(t, h.th.App.Srv().Channels().accessDecisions)

	require.NoError(t, h.th.TestLogger.Flush())
	logs := h.th.LogBuffer.String()
	testlib.AssertLog(t, strings.NewReader(logs), mlog.LvlInfo.Name, accessDecisionCacheEnabledLog)
	testlib.AssertNoLog(t, strings.NewReader(logs), mlog.LvlInfo.Name, accessDecisionCacheSwitchChangedLog)

	// Turning it off at runtime keeps the cache until a restart.
	decides(h.acs, true)
	h.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.AccessControlSettings.EnableDecisionCache = false })
	require.NotNil(t, h.th.App.Srv().Channels().accessDecisions)
	require.True(t, h.check(t))
	require.True(t, h.check(t))
	require.Equal(t, 1, h.evaluations())

	require.NoError(t, h.th.TestLogger.Flush())
	testlib.AssertLog(t, h.th.LogBuffer, mlog.LvlInfo.Name, accessDecisionCacheSwitchChangedLog)
}
