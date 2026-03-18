// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

const (
	testPropertyGroupName = "test_property_group"
	testPropertyA         = "test_property_a"
	testPropertyB         = "test_property_b"
	testPropertyC         = "test_property_c"
	testPropertyValueA1   = "value_a1"
	testPropertyValueA2   = "value_a2"
	testPropertyValueB1   = "value_b1"
	testPropertyValueC1   = "option_1"
	testPropertyValueC2   = "option_2"
)

var (
	testTeamID = model.NewId()
)

func TestAttributesStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("RefreshAndGet", func(t *testing.T) { testAttributesStoreRefresh(t, rctx, ss) })
	t.Run("SearchUsers", func(t *testing.T) { testAttributesStoreSearchUsers(t, rctx, ss, s) })
	t.Run("SearchUsersBySubjectID", func(t *testing.T) { testAttributesStoreSearchUsersBySubjectID(t, rctx, ss, s) })
	t.Run("GetChannelMembersToRemove", func(t *testing.T) { testAttributesStoreGetChannelMembersToRemove(t, rctx, ss, s) })
}

// To help mental model of the test users created by this function:
//   - user[0] : {
//     "test_property_a":"value_a1",
//     "test_property_b":"value_b1"
//     }
//   - user[1] : {
//     "test_property_a":"value_a2"
//     }
//   - user[2] : {
//     "test_property_a": "value_a1"
//     "test_property_c": "option_2" // this is select type
//     }
//   - user[3] : {}
func createTestUsers(t *testing.T, rctx request.CTX, ss store.Store) ([]*model.User, string, func()) {
	maxUsersPerTeam := 50

	u1 := model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}

	_, err := ss.User().Save(rctx, &u1)
	require.NoError(t, err, "couldn't save user")

	_, nErr := ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: testTeamID, UserId: u1.Id}, maxUsersPerTeam)
	require.NoError(t, nErr)

	u2 := model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	_, err = ss.User().Save(rctx, &u2)
	require.NoError(t, err, "couldn't save user")

	_, nErr = ss.Team().SaveMember(rctx, &model.TeamMember{TeamId: testTeamID, UserId: u2.Id}, maxUsersPerTeam)
	require.NoError(t, nErr)

	// user3 does not have any attributes
	u3 := model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}

	_, err = ss.User().Save(rctx, &u3)
	require.NoError(t, err, "couldn't save user")

	// user3 does not have any attributes
	u4 := model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}

	_, err = ss.User().Save(rctx, &u4)
	require.NoError(t, err, "couldn't save user")

	group, err := ss.PropertyGroup().Register(testPropertyGroupName)
	require.NoError(t, err)
	require.NotZero(t, group.ID)
	require.Equal(t, testPropertyGroupName, group.Name)
	groupID := group.ID

	fieldA, err := ss.PropertyField().Create(&model.PropertyField{
		GroupID: groupID,
		Name:    testPropertyA,
		Type:    model.PropertyFieldTypeText,
	})
	require.NoError(t, err)
	fieldB, err := ss.PropertyField().Create(&model.PropertyField{
		GroupID: groupID,
		Name:    testPropertyB,
		Type:    model.PropertyFieldTypeText,
	})
	require.NoError(t, err)
	attrs := map[string]any{
		"options": []any{
			map[string]any{"id": model.NewId(), "name": testPropertyValueC1, "color": ""},
			map[string]any{"id": model.NewId(), "name": testPropertyValueC2, "color": ""},
		},
	}
	fieldC, err := ss.PropertyField().Create(&model.PropertyField{
		GroupID: groupID,
		Name:    "test_property_c",
		Type:    model.PropertyFieldTypeSelect,
		Attrs:   attrs,
	})
	require.NoError(t, err)

	vala1, err := json.Marshal(testPropertyValueA1)
	require.NoError(t, err)
	vala2, err := json.Marshal(testPropertyValueA2)
	require.NoError(t, err)
	valab1, err := json.Marshal(testPropertyValueB1)
	require.NoError(t, err)
	valc2, err := json.Marshal(attrs["options"].([]any)[0].(map[string]any)["id"])
	require.NoError(t, err)

	pva1, err := ss.PropertyValue().Create(&model.PropertyValue{
		TargetID:   u1.Id,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    groupID,
		FieldID:    fieldA.ID,
		Value:      vala1,
	})
	require.NoError(t, err)

	pvb1, err := ss.PropertyValue().Create(&model.PropertyValue{
		TargetID:   u1.Id,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    groupID,
		FieldID:    fieldB.ID,
		Value:      valab1,
	})
	require.NoError(t, err)

	pva2, err := ss.PropertyValue().Create(&model.PropertyValue{
		TargetID:   u2.Id,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    groupID,
		FieldID:    fieldA.ID,
		Value:      vala2,
	})
	require.NoError(t, err)

	pva3, err := ss.PropertyValue().Create(&model.PropertyValue{
		TargetID:   u3.Id,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    groupID,
		FieldID:    fieldA.ID,
		Value:      vala1,
	})
	require.NoError(t, err)

	pva4, err := ss.PropertyValue().Create(&model.PropertyValue{
		TargetID:   u3.Id,
		TargetType: model.PropertyValueTargetTypeUser,
		GroupID:    groupID,
		FieldID:    fieldC.ID,
		Value:      valc2,
	})
	require.NoError(t, err)

	return []*model.User{&u1, &u2, &u3}, groupID, func() {
		for _, pv := range []*model.PropertyValue{pva1, pvb1, pva2, pva3, pva4} {
			dErr := ss.PropertyValue().Delete(groupID, pv.ID)
			require.NoError(t, dErr, "couldn't delete property value")
		}
		for _, field := range []*model.PropertyField{fieldA, fieldB, fieldC} {
			dErr := ss.PropertyField().Delete(groupID, field.ID)
			require.NoError(t, dErr, "couldn't delete property field")
		}
		for _, u := range []*model.User{&u1, &u2, &u3, &u4} {
			dErr := ss.User().PermanentDelete(rctx, u.Id)
			require.NoError(t, dErr, "couldn't delete user")
		}
	}
}

func testAttributesStoreRefresh(t *testing.T, rctx request.CTX, ss store.Store) {
	users, groupID, cleanup := createTestUsers(t, rctx, ss)
	t.Cleanup(cleanup)

	t.Run("Refresh attributes", func(t *testing.T) {
		err := ss.Attributes().RefreshAttributes()
		require.NoError(t, err, "couldn't refresh attributes")

		// Check if the attributes are set correctly
		for _, user := range users {
			subject, err := ss.Attributes().GetSubject(rctx, user.Id, groupID)
			require.NoError(t, err, "couldn't get subject")

			require.Equal(t, user.Id, subject.ID)
			require.Equal(t, "user", subject.Type)
		}
	})

	t.Run("Get non-existing subject", func(t *testing.T) {
		subject, err := ss.Attributes().GetSubject(rctx, "non-existing-id", groupID)
		require.Error(t, err, "expected error when getting non-existing subject")
		require.IsType(t, &store.ErrNotFound{}, err, "expected not found error")
		require.Nil(t, subject, "expected nil subject for non-existing ID")
	})
}

func testAttributesStoreSearchUsers(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	users, _, cleanup := createTestUsers(t, rctx, ss)
	t.Cleanup(cleanup)
	require.Len(t, users, 3, "expected 3 users")

	err := ss.Attributes().RefreshAttributes()
	require.NoError(t, err, "couldn't refresh attributes")

	t.Run("Search users without query", func(t *testing.T) {
		subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{})
		require.NoError(t, err, "couldn't search users")
		require.Len(t, subjects, 4, "expected 4 users")
		require.Equal(t, int64(4), count, "expected count 4 users")
	})

	t.Run("Search users without query, limit by team", func(t *testing.T) {
		subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{
			TeamID: testTeamID,
		})
		require.NoError(t, err, "couldn't search users")
		require.Len(t, subjects, 2, "expected 2 users")
		require.Equal(t, int64(2), count, "expected count 2 users")
	})

	t.Run("Search users with a random value query", func(t *testing.T) {
		subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{
			Query: "Attributes ->> '$." + testPropertyA + "' = ?",
			Args:  []any{"random_value"},
		})
		require.NoError(t, err, "couldn't search users")
		require.Empty(t, subjects, "expected no users with the query")
		require.Equal(t, int64(0), count, "expected count 0 users")
	})

	t.Run("Search users with a valid value query", func(t *testing.T) {
		query := "Attributes ->> '" + testPropertyB + "' = $1::text"
		subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{
			Query: query,
			Args:  []any{testPropertyValueB1},
		})
		require.NoError(t, err, "couldn't search users")
		require.Len(t, subjects, 1, "expected 1 user with the query")
		require.Equal(t, subjects[0].Id, users[0].Id, "expected user ID to match")
		require.Equal(t, int64(1), count, "expected count 1 user")
	})

	t.Run("Search users with a valid value query and limit", func(t *testing.T) {
		query := "Attributes ->> '" + testPropertyA + "' = $1::text"
		subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{
			Query: query,
			Args:  []any{testPropertyValueA1},
			Limit: 1,
		})
		require.NoError(t, err, "couldn't search users")
		require.Len(t, subjects, 1, "expected 1 user with the query")
		if users[0].Id < users[2].Id {
			require.Equal(t, subjects[0].Id, users[0].Id, "expected user ID to match")
		} else {
			require.Equal(t, subjects[0].Id, users[2].Id, "expected user ID to match")
		}
		require.Equal(t, int64(2), count, "expected count 1 user")
	})

	t.Run("Search users with pagination", func(t *testing.T) {
		query := "Attributes ->> '" + testPropertyA + "' = $1::text"

		cursor := strings.Repeat("0", 26)
		for range 5 {
			subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{
				Query: query,
				Args:  []any{testPropertyValueA1},
				Limit: 1,
				Cursor: model.SubjectCursor{
					TargetID: cursor,
				},
			})
			if len(subjects) == 0 {
				break
			}
			cursor = subjects[0].Id

			require.NoError(t, err, "couldn't search users")
			require.Len(t, subjects, 1, "expected 1 user with the query")
			require.Equal(t, int64(2), count, "expected count 2 user with the query")
		}
	})
}

func testAttributesStoreGetChannelMembersToRemove(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	users, _, cleanup := createTestUsers(t, rctx, ss)
	t.Cleanup(cleanup)
	require.Len(t, users, 3, "expected 3 users")

	err := ss.Attributes().RefreshAttributes()
	require.NoError(t, err, "couldn't refresh attributes")

	ch, err := ss.Channel().Save(rctx, &model.Channel{
		Name:     "test-channel",
		TeamId:   testTeamID,
		Type:     model.ChannelTypePrivate,
		CreateAt: model.GetMillis(),
	}, 1000)
	require.NoError(t, err, "couldn't save channel")

	defaultNotifyProps := model.GetDefaultChannelNotifyProps()

	cm1, err := ss.Channel().SaveMember(rctx, &model.ChannelMember{
		ChannelId:   ch.Id,
		UserId:      users[0].Id,
		NotifyProps: defaultNotifyProps,
	})
	require.NoError(t, err, "couldn't save channel member for user 1")
	cm2, err := ss.Channel().SaveMember(rctx, &model.ChannelMember{
		ChannelId:   ch.Id,
		UserId:      users[1].Id,
		NotifyProps: defaultNotifyProps,
	})
	require.NoError(t, err, "couldn't save channel member for user 2")
	cm3, err := ss.Channel().SaveMember(rctx, &model.ChannelMember{
		ChannelId:   ch.Id,
		UserId:      users[2].Id,
		NotifyProps: defaultNotifyProps,
	})
	require.NoError(t, err, "couldn't save channel member for user 3")
	t.Cleanup(func() {
		dErr := ss.Channel().RemoveMember(rctx, cm1.ChannelId, cm1.UserId)
		require.NoError(t, dErr, "couldn't delete channel member for user 1")
		dErr = ss.Channel().RemoveMember(rctx, cm2.ChannelId, cm2.UserId)
		require.NoError(t, dErr, "couldn't delete channel member for user 2")
		dErr = ss.Channel().RemoveMember(rctx, cm3.ChannelId, cm3.UserId)
		require.NoError(t, dErr, "couldn't delete channel member for user 3")
		dErr = ss.Channel().Delete(ch.Id, model.GetMillis())
		require.NoError(t, dErr, "couldn't delete channel")
	})

	t.Run("Get channel members to remove single attribute", func(t *testing.T) {
		query := "Attributes ->> '" + testPropertyA + "' = $1::text" // Attributes ->> '$.Clearance' >= $1::text
		members, err := ss.Attributes().GetChannelMembersToRemove(rctx, ch.Id, model.SubjectSearchOptions{
			Query: query,
			Args:  []any{testPropertyValueA1},
		})
		require.NoError(t, err, "couldn't get channel members to remove")
		require.Len(t, members, 1, "expected 1 channel members to remove")
	})

	t.Run("Get channel members to remove multiple attribute", func(t *testing.T) {
		query := "Attributes ->> '" + testPropertyA + "' = $1::text AND Attributes ->> '" + testPropertyB + "' = $2::text"
		members, err := ss.Attributes().GetChannelMembersToRemove(rctx, ch.Id, model.SubjectSearchOptions{
			Query: query,
			Args:  []any{testPropertyValueA1, testPropertyValueB1},
		})
		require.NoError(t, err, "couldn't get channel members to remove")
		require.Len(t, members, 2, "expected 2 channel members to remove")
	})

	t.Run("Get channel members to remove with empty query", func(t *testing.T) {
		members, err := ss.Attributes().GetChannelMembersToRemove(rctx, ch.Id, model.SubjectSearchOptions{
			Query: "",
		})
		require.NoError(t, err, "couldn't get channel members to remove")
		require.Len(t, members, 3, "expected 3 channel members to remove")
	})

	t.Run("Get channel members for select type attribute", func(t *testing.T) {
		query := "Attributes ->> '" + testPropertyC + "' = $1::text"
		members, err := ss.Attributes().GetChannelMembersToRemove(rctx, ch.Id, model.SubjectSearchOptions{
			Query: query,
			Args:  []any{testPropertyValueC1},
		})
		require.NoError(t, err, "couldn't get channel members to remove")
		require.Len(t, members, 2, "expected 2 channel member to remove")
	})
}

func testAttributesStoreSearchUsersBySubjectID(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	users, _, cleanup := createTestUsers(t, rctx, ss)
	t.Cleanup(cleanup)
	require.Len(t, users, 3, "expected 3 users")

	err := ss.Attributes().RefreshAttributes()
	require.NoError(t, err, "couldn't refresh attributes")

	t.Run("Search users by specific SubjectID", func(t *testing.T) {
		// Test searching for the first user by their ID
		subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{
			SubjectID: users[0].Id,
		})
		require.NoError(t, err, "couldn't search users by SubjectID")
		require.Len(t, subjects, 1, "expected 1 user")
		require.Equal(t, int64(1), count, "expected count 1")
		require.Equal(t, users[0].Id, subjects[0].Id, "expected the specific user")
	})

	t.Run("Search users by non-existent SubjectID", func(t *testing.T) {
		// Test with a non-existent user ID
		nonExistentID := model.NewId()
		subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{
			SubjectID: nonExistentID,
		})
		require.NoError(t, err, "couldn't search users by non-existent SubjectID")
		require.Len(t, subjects, 0, "expected 0 users for non-existent ID")
		require.Equal(t, int64(0), count, "expected count 0 for non-existent ID")
	})

	t.Run("Search users by SubjectID with query filter", func(t *testing.T) {
		// Test combining SubjectID with a query filter
		subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{
			SubjectID: users[0].Id,
			Query:     "Attributes ->> '" + testPropertyA + "' = $1::text",
			Args:      []any{testPropertyValueA1},
		})
		require.NoError(t, err, "couldn't search users by SubjectID with query")
		require.Len(t, subjects, 1, "expected 1 user matching both SubjectID and query")
		require.Equal(t, int64(1), count, "expected count 1")
		require.Equal(t, users[0].Id, subjects[0].Id, "expected the specific user")
	})

	t.Run("Search users by SubjectID with non-matching query filter", func(t *testing.T) {
		// Test SubjectID with a query that doesn't match that user
		subjects, count, err := ss.Attributes().SearchUsers(rctx, model.SubjectSearchOptions{
			SubjectID: users[0].Id,
			Query:     "Attributes ->> '" + testPropertyA + "' = $1::text",
			Args:      []any{"non_matching_value"},
		})
		require.NoError(t, err, "couldn't search users by SubjectID with non-matching query")
		require.Len(t, subjects, 0, "expected 0 users when query doesn't match SubjectID")
		require.Equal(t, int64(0), count, "expected count 0")
	})
}
