// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func setupAttributeViewRefreshTest(t *testing.T) *TestHelper {
	t.Helper()
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	}).InitBasic(t)
	// The access control property group takes writes only under Enterprise Advanced.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	// The views' last-refresh rows are shared by every test on this database.
	clearRows := func() {
		_, err := th.GetSqlStore().GetMaster().Exec("DELETE FROM Systems WHERE Name LIKE 'AttributeViewLastRefresh_%'")
		require.NoError(t, err)
	}
	clearRows()
	t.Cleanup(clearRows)
	return th
}

func attributeViewLastRefreshStart(t *testing.T, th *TestHelper, objectType string) int64 {
	t.Helper()
	var raw string
	err := th.GetSqlStore().GetMaster().Get(&raw, "SELECT Value FROM Systems WHERE Name = $1", "AttributeViewLastRefresh_"+objectType)
	if err != nil {
		return 0
	}
	var last struct {
		StartMicros int64 `json:"start_micros"`
	}
	require.NoError(t, json.Unmarshal([]byte(raw), &last))
	return last.StartMicros
}

// TestAttributeViewRefreshMakesWritesVisible checks the whole path with the real store: a user
// attribute written through the app shows up in a bulk SearchUsers, which reads the materialized
// view, with nobody refreshing it by hand.
func TestAttributeViewRefreshMakesWritesVisible(t *testing.T) {
	th := setupAttributeViewRefreshTest(t)
	timings := defaultAttributeViewTimings
	timings.quiet, timings.maxWait, timings.minGap = 10*time.Millisecond, 50*time.Millisecond, time.Millisecond
	th.App.Srv().Channels().attributeViews.setTimings(timings)

	group, err := th.App.Srv().propertyService.Group(model.AccessControlPropertyGroupName)
	require.NoError(t, err)
	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "clearance_" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)

	search := func(value string) []*model.User {
		users, _, sErr := th.App.Srv().Store().Attributes().SearchUsers(th.Context, model.SubjectSearchOptions{
			Query: "UserAttributeView.Attributes ->> '" + field.Name + "' = $1",
			Args:  []any{value},
		})
		require.NoError(t, sErr)
		return users
	}

	raw, mErr := json.Marshal("secret")
	require.NoError(t, mErr)
	value, appErr := th.App.CreatePropertyValue(th.Context, &model.PropertyValue{
		TargetID:   th.BasicUser.Id,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    group.ID,
		FieldID:    field.ID,
		Value:      raw,
	})
	require.Nil(t, appErr)

	require.Eventually(t, func() bool {
		users := search("secret")
		return len(users) == 1 && users[0].Id == th.BasicUser.Id
	}, 10*time.Second, 20*time.Millisecond, "the written value reaches the materialized view without a manual refresh")

	value.Value, mErr = json.Marshal("top_secret")
	require.NoError(t, mErr)
	_, appErr = th.App.UpdatePropertyValue(th.Context, group.ID, value)
	require.Nil(t, appErr)

	require.Eventually(t, func() bool {
		return len(search("top_secret")) == 1 && len(search("secret")) == 0
	}, 10*time.Second, 20*time.Millisecond, "and so does an update")
}

func TestRefreshAttributeViewsForSync(t *testing.T) {
	th := setupAttributeViewRefreshTest(t)
	user, channel := model.PropertyFieldObjectTypeUser, model.PropertyFieldObjectTypeChannel

	t.Run("refreshes both views, ignoring the minimum gap", func(t *testing.T) {
		require.NoError(t, th.App.RefreshAttributeViewsForSync(th.Context))
		userStart, channelStart := attributeViewLastRefreshStart(t, th, user), attributeViewLastRefreshStart(t, th, channel)
		require.NotZero(t, userStart)
		require.NotZero(t, channelStart)

		// Straight away again: a background refresh would wait out the gap, the sync doesn't.
		require.NoError(t, th.App.RefreshAttributeViewsForSync(th.Context))
		require.Greater(t, attributeViewLastRefreshStart(t, th, user), userStart)
		require.Greater(t, attributeViewLastRefreshStart(t, th, channel), channelStart)
	})

	t.Run("backs off while another session holds a view's lock, then runs on the view as it is", func(t *testing.T) {
		timings := defaultAttributeViewTimings
		timings.syncBackoffInitial, timings.syncRetries = time.Millisecond, 3
		th.App.Srv().Channels().attributeViews.setTimings(timings)
		t.Cleanup(func() { th.App.Srv().Channels().attributeViews.setTimings(defaultAttributeViewTimings) })

		// Hold the user view's refresh lock, as a refresh running on another node would.
		holder, err := th.GetSqlStore().GetMaster().Begin()
		require.NoError(t, err)
		defer holder.Rollback() //nolint:errcheck
		_, err = holder.Exec("SELECT pg_advisory_xact_lock($1, $2)", 0x4D4D4156, 1)
		require.NoError(t, err)

		userStart, channelStart := attributeViewLastRefreshStart(t, th, user), attributeViewLastRefreshStart(t, th, channel)
		require.NoError(t, th.App.RefreshAttributeViewsForSync(th.Context), "the sync goes ahead without the refresh")
		require.Equal(t, userStart, attributeViewLastRefreshStart(t, th, user), "the locked view isn't refreshed")
		require.Greater(t, attributeViewLastRefreshStart(t, th, channel), channelStart, "the other view is")

		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertLog(t, th.LogBuffer, mlog.LvlWarn.Name, attributeViewSyncGaveUpLog)
	})
}
