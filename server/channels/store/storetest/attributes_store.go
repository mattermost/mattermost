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
	testPropertyValueA1   = "value_a1"
	testPropertyValueA2   = "value_a2"
	testPropertyValueB1   = "value_b1"
)

var (
	testTeamID = model.NewId()
)

func TestAttributesStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("RefreshAndGet", func(t *testing.T) { testAttributesStoreRefresh(t, rctx, ss) })
	t.Run("SearchUsers", func(t *testing.T) { testAttributesStoreSearchUsers(t, rctx, ss, s) })
}

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

	vala1, err := json.Marshal(testPropertyValueA1)
	require.NoError(t, err)
	vala2, err := json.Marshal(testPropertyValueA2)
	require.NoError(t, err)
	valab1, err := json.Marshal(testPropertyValueB1)
	require.NoError(t, err)

	pva1, err := ss.PropertyValue().Create(&model.PropertyValue{
		TargetID:   u1.Id,
		TargetType: "user",
		GroupID:    groupID,
		FieldID:    fieldA.ID,
		Value:      vala1,
	})
	require.NoError(t, err)

	pvb1, err := ss.PropertyValue().Create(&model.PropertyValue{
		TargetID:   u1.Id,
		TargetType: "user",
		GroupID:    groupID,
		FieldID:    fieldB.ID,
		Value:      valab1,
	})
	require.NoError(t, err)

	pva2, err := ss.PropertyValue().Create(&model.PropertyValue{
		TargetID:   u2.Id,
		TargetType: "user",
		GroupID:    groupID,
		FieldID:    fieldA.ID,
		Value:      vala2,
	})
	require.NoError(t, err)

	pva3, err := ss.PropertyValue().Create(&model.PropertyValue{
		TargetID:   u3.Id,
		TargetType: "user",
		GroupID:    groupID,
		FieldID:    fieldA.ID,
		Value:      vala1,
	})
	require.NoError(t, err)

	return []*model.User{&u1, &u2, &u3}, groupID, func() {
		for _, pv := range []*model.PropertyValue{pva1, pvb1, pva2, pva3} {
			dErr := ss.PropertyValue().Delete(groupID, pv.ID)
			require.NoError(t, dErr, "couldn't delete property value")
		}
		for _, field := range []*model.PropertyField{fieldA, fieldB} {
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
		var query string
		if s.DriverName() == model.DatabaseDriverMysql {
			query = "Attributes ->> '$." + testPropertyB + "' = ?"
		} else {
			query = "Attributes ->> '" + testPropertyB + "' = $1::text"
		}
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
		var query string
		if s.DriverName() == model.DatabaseDriverMysql {
			query = "Attributes ->> '$." + testPropertyA + "' = ?"
		} else {
			query = "Attributes ->> '" + testPropertyA + "' = $1::text"
		}
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
		var query string
		if s.DriverName() == model.DatabaseDriverMysql {
			query = "Attributes ->> '$." + testPropertyA + "' = ?"
		} else {
			query = "Attributes ->> '" + testPropertyA + "' = $1::text"
		}

		cursor := strings.Repeat("0", 26)
		for i := 0; i < 5; i++ {
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
