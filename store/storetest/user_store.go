// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

const (
	DayMilliseconds   = 24 * 60 * 60 * 1000
	MonthMilliseconds = 31 * DayMilliseconds
)

func cleanupStatusStore(t *testing.T, s SqlStore) {
	_, execerr := s.GetMasterX().Exec(`DELETE FROM Status`)
	require.NoError(t, execerr)
}

func TestUserStore(t *testing.T, ss store.Store, s SqlStore) {
	users, err := ss.User().GetAll()
	require.NoError(t, err, "failed cleaning up test users")

	for _, u := range users {
		err := ss.User().PermanentDelete(u.Id)
		require.NoError(t, err, "failed cleaning up test user %s", u.Username)
	}

	t.Run("IsEmpty", func(t *testing.T) { testIsEmpty(t, ss) })
	t.Run("Count", func(t *testing.T) { testCount(t, ss) })
	t.Run("AnalyticsActiveCount", func(t *testing.T) { testUserStoreAnalyticsActiveCount(t, ss, s) })
	t.Run("AnalyticsActiveCountForPeriod", func(t *testing.T) { testUserStoreAnalyticsActiveCountForPeriod(t, ss, s) })
	t.Run("AnalyticsGetInactiveUsersCount", func(t *testing.T) { testUserStoreAnalyticsGetInactiveUsersCount(t, ss) })
	t.Run("AnalyticsGetSystemAdminCount", func(t *testing.T) { testUserStoreAnalyticsGetSystemAdminCount(t, ss) })
	t.Run("AnalyticsGetGuestCount", func(t *testing.T) { testUserStoreAnalyticsGetGuestCount(t, ss) })
	t.Run("AnalyticsGetExternalUsers", func(t *testing.T) { testUserStoreAnalyticsGetExternalUsers(t, ss) })
	t.Run("Save", func(t *testing.T) { testUserStoreSave(t, ss) })
	t.Run("Update", func(t *testing.T) { testUserStoreUpdate(t, ss) })
	t.Run("UpdateUpdateAt", func(t *testing.T) { testUserStoreUpdateUpdateAt(t, ss) })
	t.Run("UpdateFailedPasswordAttempts", func(t *testing.T) { testUserStoreUpdateFailedPasswordAttempts(t, ss) })
	t.Run("Get", func(t *testing.T) { testUserStoreGet(t, ss) })
	t.Run("GetAllUsingAuthService", func(t *testing.T) { testGetAllUsingAuthService(t, ss) })
	t.Run("GetAllProfiles", func(t *testing.T) { testUserStoreGetAllProfiles(t, ss) })
	t.Run("GetProfiles", func(t *testing.T) { testUserStoreGetProfiles(t, ss) })
	t.Run("GetProfilesInChannel", func(t *testing.T) { testUserStoreGetProfilesInChannel(t, ss) })
	t.Run("GetProfilesInChannelByStatus", func(t *testing.T) { testUserStoreGetProfilesInChannelByStatus(t, ss, s) })
	t.Run("GetProfilesInChannelByAdmin", func(t *testing.T) { testUserStoreGetProfilesInChannelByAdmin(t, ss, s) })
	t.Run("GetProfilesWithoutTeam", func(t *testing.T) { testUserStoreGetProfilesWithoutTeam(t, ss) })
	t.Run("GetAllProfilesInChannel", func(t *testing.T) { testUserStoreGetAllProfilesInChannel(t, ss) })
	t.Run("GetProfilesNotInChannel", func(t *testing.T) { testUserStoreGetProfilesNotInChannel(t, ss) })
	t.Run("GetProfilesByIds", func(t *testing.T) { testUserStoreGetProfilesByIds(t, ss) })
	t.Run("GetProfileByGroupChannelIdsForUser", func(t *testing.T) { testUserStoreGetProfileByGroupChannelIdsForUser(t, ss) })
	t.Run("GetProfilesByUsernames", func(t *testing.T) { testUserStoreGetProfilesByUsernames(t, ss) })
	t.Run("GetSystemAdminProfiles", func(t *testing.T) { testUserStoreGetSystemAdminProfiles(t, ss) })
	t.Run("GetByEmail", func(t *testing.T) { testUserStoreGetByEmail(t, ss) })
	t.Run("GetByAuthData", func(t *testing.T) { testUserStoreGetByAuthData(t, ss) })
	t.Run("GetByUsername", func(t *testing.T) { testUserStoreGetByUsername(t, ss) })
	t.Run("GetForLogin", func(t *testing.T) { testUserStoreGetForLogin(t, ss) })
	t.Run("UpdatePassword", func(t *testing.T) { testUserStoreUpdatePassword(t, ss) })
	t.Run("Delete", func(t *testing.T) { testUserStoreDelete(t, ss) })
	t.Run("UpdateAuthData", func(t *testing.T) { testUserStoreUpdateAuthData(t, ss) })
	t.Run("ResetAuthDataToEmailForUsers", func(t *testing.T) { testUserStoreResetAuthDataToEmailForUsers(t, ss) })
	t.Run("UserUnreadCount", func(t *testing.T) { testUserUnreadCount(t, ss) })
	t.Run("UpdateMfaSecret", func(t *testing.T) { testUserStoreUpdateMfaSecret(t, ss) })
	t.Run("UpdateMfaActive", func(t *testing.T) { testUserStoreUpdateMfaActive(t, ss) })
	t.Run("GetRecentlyActiveUsersForTeam", func(t *testing.T) { testUserStoreGetRecentlyActiveUsersForTeam(t, ss, s) })
	t.Run("GetNewUsersForTeam", func(t *testing.T) { testUserStoreGetNewUsersForTeam(t, ss) })
	t.Run("Search", func(t *testing.T) { testUserStoreSearch(t, ss) })
	t.Run("SearchNotInChannel", func(t *testing.T) { testUserStoreSearchNotInChannel(t, ss) })
	t.Run("SearchInChannel", func(t *testing.T) { testUserStoreSearchInChannel(t, ss) })
	t.Run("SearchNotInTeam", func(t *testing.T) { testUserStoreSearchNotInTeam(t, ss) })
	t.Run("SearchWithoutTeam", func(t *testing.T) { testUserStoreSearchWithoutTeam(t, ss) })
	t.Run("SearchInGroup", func(t *testing.T) { testUserStoreSearchInGroup(t, ss) })
	t.Run("SearchNotInGroup", func(t *testing.T) { testUserStoreSearchNotInGroup(t, ss) })
	t.Run("GetProfilesNotInTeam", func(t *testing.T) { testUserStoreGetProfilesNotInTeam(t, ss) })
	t.Run("ClearAllCustomRoleAssignments", func(t *testing.T) { testUserStoreClearAllCustomRoleAssignments(t, ss) })
	t.Run("GetAllAfter", func(t *testing.T) { testUserStoreGetAllAfter(t, ss) })
	t.Run("GetUsersBatchForIndexing", func(t *testing.T) { testUserStoreGetUsersBatchForIndexing(t, ss) })
	t.Run("GetTeamGroupUsers", func(t *testing.T) { testUserStoreGetTeamGroupUsers(t, ss) })
	t.Run("GetChannelGroupUsers", func(t *testing.T) { testUserStoreGetChannelGroupUsers(t, ss) })
	t.Run("PromoteGuestToUser", func(t *testing.T) { testUserStorePromoteGuestToUser(t, ss) })
	t.Run("DemoteUserToGuest", func(t *testing.T) { testUserStoreDemoteUserToGuest(t, ss) })
	t.Run("DeactivateGuests", func(t *testing.T) { testDeactivateGuests(t, ss) })
	t.Run("ResetLastPictureUpdate", func(t *testing.T) { testUserStoreResetLastPictureUpdate(t, ss) })
	t.Run("GetKnownUsers", func(t *testing.T) { testGetKnownUsers(t, ss) })
	t.Run("GetUsersWithInvalidEmails", func(t *testing.T) { testGetUsersWithInvalidEmails(t, ss) })
	t.Run("GetFirstSystemAdminID", func(t *testing.T) { testUserStoreGetFirstSystemAdminID(t, ss) })
}

func testUserStoreSave(t *testing.T, ss store.Store) {
	teamId := model.NewId()
	maxUsersPerTeam := 50

	u1 := model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}

	_, err := ss.User().Save(&u1)
	require.NoError(t, err, "couldn't save user")

	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, maxUsersPerTeam)
	require.NoError(t, nErr)

	_, err = ss.User().Save(&u1)
	require.Error(t, err, "shouldn't be able to update user from save")

	u2 := model.User{
		Email:    u1.Email,
		Username: model.NewId(),
	}
	_, err = ss.User().Save(&u2)
	require.Error(t, err, "should be unique email")

	u2.Email = MakeEmail()
	u2.Username = u1.Username
	_, err = ss.User().Save(&u2)
	require.Error(t, err, "should be unique username")

	u2.Username = ""
	_, err = ss.User().Save(&u2)
	require.Error(t, err, "should be non-empty username")

	u3 := model.User{
		Email:       MakeEmail(),
		Username:    model.NewId(),
		NotifyProps: make(map[string]string, 1),
	}
	maxPostSize := ss.Post().GetMaxPostSize()
	u3.NotifyProps[model.AutoResponderMessageNotifyProp] = strings.Repeat("a", maxPostSize+1)
	_, err = ss.User().Save(&u3)
	require.Error(t, err, "auto responder message size should not be greater than maxPostSize")

	for i := 0; i < 49; i++ {
		u := model.User{
			Email:    MakeEmail(),
			Username: model.NewId(),
		}
		_, err = ss.User().Save(&u)
		require.NoError(t, err, "couldn't save item")

		defer func() { require.NoError(t, ss.User().PermanentDelete(u.Id)) }()

		_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u.Id}, maxUsersPerTeam)
		require.NoError(t, nErr)
	}

	u2.Id = ""
	u2.Email = MakeEmail()
	u2.Username = model.NewId()
	_, err = ss.User().Save(&u2)
	require.NoError(t, err, "couldn't save item")

	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, maxUsersPerTeam)
	require.Error(t, nErr, "should be the limit")
}

func testUserStoreUpdate(t *testing.T, ss store.Store) {
	u1 := &model.User{
		Email: MakeEmail(),
	}
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2 := &model.User{
		Email:       MakeEmail(),
		AuthService: "ldap",
	}
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	_, err = ss.User().Update(u1, false)
	require.NoError(t, err)

	missing := &model.User{}
	_, err = ss.User().Update(missing, false)
	require.Error(t, err, "Update should have failed because of missing key")

	newId := &model.User{
		Id: model.NewId(),
	}
	_, err = ss.User().Update(newId, false)
	require.Error(t, err, "Update should have failed because id change")

	u2.Email = MakeEmail()
	_, err = ss.User().Update(u2, false)
	require.Error(t, err, "Update should have failed because you can't modify AD/LDAP fields")

	u3 := &model.User{
		Email:       MakeEmail(),
		AuthService: "gitlab",
	}
	oldEmail := u3.Email
	_, err = ss.User().Save(u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u3.Id}, -1)
	require.NoError(t, nErr)

	u3.Email = MakeEmail()
	userUpdate, err := ss.User().Update(u3, false)
	require.NoError(t, err, "Update should not have failed")
	assert.Equal(t, oldEmail, userUpdate.New.Email, "Email should not have been updated as the update is not trusted")

	u3.Email = MakeEmail()
	userUpdate, err = ss.User().Update(u3, true)
	require.NoError(t, err, "Update should not have failed")
	assert.NotEqual(t, oldEmail, userUpdate.New.Email, "Email should have been updated as the update is trusted")

	err = ss.User().UpdateLastPictureUpdate(u1.Id)
	require.NoError(t, err, "Update should not have failed")

	// Test UpdateNotifyProps
	u1, err = ss.User().Get(context.Background(), u1.Id)
	require.NoError(t, err)

	props := u1.NotifyProps
	props["hello"] = "world"

	err = ss.User().UpdateNotifyProps(u1.Id, props)
	require.NoError(t, err)

	ss.User().InvalidateProfileCacheForUser(u1.Id)

	uNew, err := ss.User().Get(context.Background(), u1.Id)
	require.NoError(t, err)
	assert.Equal(t, props, uNew.NotifyProps)

	u4 := model.User{
		Email:       MakeEmail(),
		Username:    model.NewId(),
		NotifyProps: make(map[string]string, 1),
	}
	maxPostSize := ss.Post().GetMaxPostSize()
	u4.NotifyProps[model.AutoResponderMessageNotifyProp] = strings.Repeat("a", maxPostSize+1)
	_, err = ss.User().Update(&u4, false)
	require.Error(t, err, "auto responder message size should not be greater than maxPostSize")
	err = ss.User().UpdateNotifyProps(u4.Id, u4.NotifyProps)
	require.Error(t, err, "auto responder message size should not be greater than maxPostSize")
}

func testUserStoreUpdateUpdateAt(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	// Ensure UpdateAt has a change to be different below.
	time.Sleep(2 * time.Millisecond)

	_, err = ss.User().UpdateUpdateAt(u1.Id)
	require.NoError(t, err)

	user, err := ss.User().Get(context.Background(), u1.Id)
	require.NoError(t, err)
	require.Less(t, u1.UpdateAt, user.UpdateAt, "UpdateAt not updated correctly")
}

func testUserStoreUpdateFailedPasswordAttempts(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	err = ss.User().UpdateFailedPasswordAttempts(u1.Id, 3)
	require.NoError(t, err)

	user, err := ss.User().Get(context.Background(), u1.Id)
	require.NoError(t, err)
	require.Equal(t, 3, user.FailedAttempts, "FailedAttempts not updated correctly")
}

func testUserStoreGet(t *testing.T, ss store.Store) {
	u1 := &model.User{
		Email: MakeEmail(),
	}
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2, _ := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	})
	_, nErr := ss.Bot().Save(&model.Bot{
		UserId:      u2.Id,
		Username:    u2.Username,
		Description: "bot description",
		OwnerId:     u1.Id,
	})
	require.NoError(t, nErr)
	u2.IsBot = true
	u2.BotDescription = "bot description"
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u2.Id)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	t.Run("fetch empty id", func(t *testing.T) {
		_, err := ss.User().Get(context.Background(), "")
		require.Error(t, err)
	})

	t.Run("fetch user 1", func(t *testing.T) {
		actual, err := ss.User().Get(context.Background(), u1.Id)
		require.NoError(t, err)
		require.Equal(t, u1, actual)
		require.False(t, actual.IsBot)
	})

	t.Run("fetch user 2, also a bot", func(t *testing.T) {
		actual, err := ss.User().Get(context.Background(), u2.Id)
		require.NoError(t, err)
		require.Equal(t, u2, actual)
		require.True(t, actual.IsBot)
		require.Equal(t, "bot description", actual.BotDescription)
	})
}

func testGetAllUsingAuthService(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:       MakeEmail(),
		Username:    "u1" + model.NewId(),
		AuthService: "service",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:       MakeEmail(),
		Username:    "u2" + model.NewId(),
		AuthService: "service",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:       MakeEmail(),
		Username:    "u3" + model.NewId(),
		AuthService: "service2",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()

	t.Run("get by unknown auth service", func(t *testing.T) {
		users, err := ss.User().GetAllUsingAuthService("unknown")
		require.NoError(t, err)
		assert.Equal(t, []*model.User{}, users)
	})

	t.Run("get by auth service", func(t *testing.T) {
		users, err := ss.User().GetAllUsingAuthService("service")
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u1, u2}, users)
	})

	t.Run("get by other auth service", func(t *testing.T) {
		users, err := ss.User().GetAllUsingAuthService("service2")
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u3}, users)
	})
}

func sanitized(user *model.User) *model.User {
	clonedUser := user.DeepCopy()
	clonedUser.Sanitize(map[string]bool{})

	return clonedUser
}

func testUserStoreGetAllProfiles(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
		Roles:    model.SystemUserRoleId,
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
		Roles:    model.SystemUserRoleId,
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	_, nErr := ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()

	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
		Roles:    "system_user some-other-role",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()

	u5, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u5" + model.NewId(),
		Roles:    "system_admin",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u5.Id)) }()

	u6, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u6" + model.NewId(),
		DeleteAt: model.GetMillis(),
		Roles:    "system_admin",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u6.Id)) }()

	u7, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u7" + model.NewId(),
		DeleteAt: model.GetMillis(),
		Roles:    model.SystemUserRoleId,
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u7.Id)) }()

	t.Run("get offset 0, limit 100", func(t *testing.T) {
		options := &model.UserGetOptions{Page: 0, PerPage: 100}
		actual, _, userErr := ss.User().GetAllProfiles(options)
		require.NoError(t, userErr)

		require.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u2),
			sanitized(u3),
			sanitized(u4),
			sanitized(u5),
			sanitized(u6),
			sanitized(u7),
		}, actual)
	})

	t.Run("get offset 0, limit 1", func(t *testing.T) {
		actual, _, userErr := ss.User().GetAllProfiles(&model.UserGetOptions{
			Page:    0,
			PerPage: 1,
		})
		require.NoError(t, userErr)
		require.Equal(t, []*model.User{
			sanitized(u1),
		}, actual)
	})

	t.Run("get all", func(t *testing.T) {
		actual, userErr := ss.User().GetAll()
		require.NoError(t, userErr)

		require.Equal(t, []*model.User{
			u1,
			u2,
			u3,
			u4,
			u5,
			u6,
			u7,
		}, actual)
	})

	t.Run("etag changes for all after user creation", func(t *testing.T) {
		etag := ss.User().GetEtagForAllProfiles()

		uNew := &model.User{}
		uNew.Email = MakeEmail()
		_, userErr := ss.User().Save(uNew)
		require.NoError(t, userErr)
		defer func() { require.NoError(t, ss.User().PermanentDelete(uNew.Id)) }()

		updatedEtag := ss.User().GetEtagForAllProfiles()
		require.NotEqual(t, etag, updatedEtag)
	})

	t.Run("filter to system_admin role", func(t *testing.T) {
		actual, _, userErr := ss.User().GetAllProfiles(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
			Role:    "system_admin",
		})
		require.NoError(t, userErr)
		require.Equal(t, []*model.User{
			sanitized(u5),
			sanitized(u6),
		}, actual)
	})

	t.Run("filter to system_admin role, inactive", func(t *testing.T) {
		actual, _, userErr := ss.User().GetAllProfiles(&model.UserGetOptions{
			Page:     0,
			PerPage:  10,
			Role:     "system_admin",
			Inactive: true,
		})
		require.NoError(t, userErr)
		require.Equal(t, []*model.User{
			sanitized(u6),
		}, actual)
	})

	t.Run("filter to inactive", func(t *testing.T) {
		actual, _, userErr := ss.User().GetAllProfiles(&model.UserGetOptions{
			Page:     0,
			PerPage:  10,
			Inactive: true,
		})
		require.NoError(t, userErr)
		require.Equal(t, []*model.User{
			sanitized(u6),
			sanitized(u7),
		}, actual)
	})

	t.Run("filter to active", func(t *testing.T) {
		actual, _, userErr := ss.User().GetAllProfiles(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
			Active:  true,
		})
		require.NoError(t, userErr)
		require.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u2),
			sanitized(u3),
			sanitized(u4),
			sanitized(u5),
		}, actual)
	})

	t.Run("try to filter to active and inactive", func(t *testing.T) {
		actual, _, userErr := ss.User().GetAllProfiles(&model.UserGetOptions{
			Page:     0,
			PerPage:  10,
			Inactive: true,
			Active:   true,
		})
		require.NoError(t, userErr)
		require.Equal(t, []*model.User{
			sanitized(u6),
			sanitized(u7),
		}, actual)
	})

	u8, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u8" + model.NewId(),
		DeleteAt: model.GetMillis(),
		Roles:    "system_user_manager system_user",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u8.Id)) }()

	u9, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u9" + model.NewId(),
		DeleteAt: model.GetMillis(),
		Roles:    "system_manager system_user",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u9.Id)) }()

	u10, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u10" + model.NewId(),
		DeleteAt: model.GetMillis(),
		Roles:    "system_read_only_admin system_user",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u10.Id)) }()

	t.Run("filter by system_user_manager role", func(t *testing.T) {
		actual, _, userErr := ss.User().GetAllProfiles(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
			Roles:   []string{"system_user_manager"},
		})
		require.NoError(t, userErr)
		require.Equal(t, []*model.User{
			sanitized(u8),
		}, actual)
	})

	t.Run("filter by multiple system roles", func(t *testing.T) {
		actual, _, userErr := ss.User().GetAllProfiles(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
			Roles:   []string{"system_manager", "system_user_manager", "system_read_only_admin", "system_admin"},
		})
		require.NoError(t, userErr)
		require.Equal(t, []*model.User{
			sanitized(u10),
			sanitized(u5),
			sanitized(u6),
			sanitized(u8),
			sanitized(u9),
		}, actual)
	})

	t.Run("filter by system_user only", func(t *testing.T) {
		actual, _, userErr := ss.User().GetAllProfiles(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
			Roles:   []string{"system_user"},
		})
		require.NoError(t, userErr)
		require.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u2),
			sanitized(u7),
		}, actual)
	})
}

func testUserStoreGetProfiles(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)

	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
		Roles:    "system_admin",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u4.Id}, -1)
	require.NoError(t, nErr)

	u5, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u5" + model.NewId(),
		DeleteAt: model.GetMillis(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u5.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u5.Id}, -1)
	require.NoError(t, nErr)

	t.Run("get page 0, perPage 100", func(t *testing.T) {
		actual, err := ss.User().GetProfiles(&model.UserGetOptions{
			InTeamId: teamId,
			Page:     0,
			PerPage:  100,
		})
		require.NoError(t, err)

		require.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u2),
			sanitized(u3),
			sanitized(u4),
			sanitized(u5),
		}, actual)
	})

	t.Run("get page 0, perPage 1", func(t *testing.T) {
		actual, err := ss.User().GetProfiles(&model.UserGetOptions{
			InTeamId: teamId,
			Page:     0,
			PerPage:  1,
		})
		require.NoError(t, err)

		require.Equal(t, []*model.User{sanitized(u1)}, actual)
	})

	t.Run("get unknown team id", func(t *testing.T) {
		actual, err := ss.User().GetProfiles(&model.UserGetOptions{
			InTeamId: "123",
			Page:     0,
			PerPage:  100,
		})
		require.NoError(t, err)

		require.Equal(t, []*model.User{}, actual)
	})

	t.Run("etag changes for all after user creation", func(t *testing.T) {
		etag := ss.User().GetEtagForProfiles(teamId)

		uNew := &model.User{}
		uNew.Email = MakeEmail()
		_, err := ss.User().Save(uNew)
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(uNew.Id)) }()
		_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: uNew.Id}, -1)
		require.NoError(t, nErr)

		updatedEtag := ss.User().GetEtagForProfiles(teamId)
		require.NotEqual(t, etag, updatedEtag)
	})

	t.Run("filter to system_admin role", func(t *testing.T) {
		actual, err := ss.User().GetProfiles(&model.UserGetOptions{
			InTeamId: teamId,
			Page:     0,
			PerPage:  10,
			Role:     "system_admin",
		})
		require.NoError(t, err)
		require.Equal(t, []*model.User{
			sanitized(u4),
		}, actual)
	})

	t.Run("filter to inactive", func(t *testing.T) {
		actual, err := ss.User().GetProfiles(&model.UserGetOptions{
			InTeamId: teamId,
			Page:     0,
			PerPage:  10,
			Inactive: true,
		})
		require.NoError(t, err)
		require.Equal(t, []*model.User{
			sanitized(u5),
		}, actual)
	})

	t.Run("filter to active", func(t *testing.T) {
		actual, err := ss.User().GetProfiles(&model.UserGetOptions{
			InTeamId: teamId,
			Page:     0,
			PerPage:  10,
			Active:   true,
		})
		require.NoError(t, err)
		require.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u2),
			sanitized(u3),
			sanitized(u4),
		}, actual)
	})

	t.Run("try to filter to active and inactive", func(t *testing.T) {
		actual, err := ss.User().GetProfiles(&model.UserGetOptions{
			InTeamId: teamId,
			Page:     0,
			PerPage:  10,
			Inactive: true,
			Active:   true,
		})
		require.NoError(t, err)
		require.Equal(t, []*model.User{
			sanitized(u5),
		}, actual)
	})
}

func testUserStoreGetProfilesInChannel(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u4.Id}, -1)
	require.NoError(t, nErr)

	ch1 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in channel",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	c1, nErr := ss.Channel().Save(ch1, -1)
	require.NoError(t, nErr)

	ch2 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in private",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	c2, nErr := ss.Channel().Save(ch2, -1)
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u4.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	u4.DeleteAt = 1
	_, err = ss.User().Update(u4, true)
	require.NoError(t, err)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	t.Run("get all users in channel 1, offset 0, limit 100", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannel(&model.UserGetOptions{
			InChannelId: c1.Id,
			Page:        0,
			PerPage:     100,
		})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u1), sanitized(u2), sanitized(u3), sanitized(u4)}, users)
	})

	t.Run("get only active users in channel 1, offset 0, limit 100", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannel(&model.UserGetOptions{
			InChannelId: c1.Id,
			Page:        0,
			PerPage:     100,
			Active:      true,
		})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u1), sanitized(u2), sanitized(u3)}, users)
	})

	t.Run("get inactive users in channel 1, offset 0, limit 100", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannel(&model.UserGetOptions{
			InChannelId: c1.Id,
			Page:        0,
			PerPage:     100,
			Inactive:    true,
		})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u4)}, users)
	})

	t.Run("get in channel 1, offset 1, limit 2", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannel(&model.UserGetOptions{
			InChannelId: c1.Id,
			Page:        1,
			PerPage:     1,
		})
		require.NoError(t, err)
		users_p2, err2 := ss.User().GetProfilesInChannel(&model.UserGetOptions{
			InChannelId: c1.Id,
			Page:        2,
			PerPage:     1,
		})
		require.NoError(t, err2)
		users = append(users, users_p2...)
		assert.Equal(t, []*model.User{sanitized(u2), sanitized(u3)}, users)
	})

	t.Run("get in channel 2, offset 0, limit 1", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannel(&model.UserGetOptions{
			InChannelId: c2.Id,
			Page:        0,
			PerPage:     1,
		})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u1)}, users)
	})

	t.Run("Filter by channel members and channel admins", func(t *testing.T) {
		// save admin for c1
		user2Admin, err := ss.User().Save(&model.User{
			Email:    MakeEmail(),
			Username: "bbb" + model.NewId(),
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user2Admin.Id)) }()
		_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user2Admin.Id}, -1)
		require.NoError(t, nErr)

		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:     c1.Id,
			UserId:        user2Admin.Id,
			NotifyProps:   model.GetDefaultChannelNotifyProps(),
			ExplicitRoles: "channel_admin",
		})
		require.NoError(t, nErr)
		ss.Channel().UpdateMembersRole(c1.Id, []string{user2Admin.Id})

		users, err := ss.User().GetProfilesInChannel(&model.UserGetOptions{
			InChannelId:  c1.Id,
			ChannelRoles: []string{model.ChannelAdminRoleId},
			Page:         0,
			PerPage:      5,
		})
		require.NoError(t, err)
		assert.Equal(t, user2Admin.Id, users[0].Id)
	})
}

func testUserStoreGetProfilesInChannelByAdmin(t *testing.T, ss store.Store, s SqlStore) {

	cleanupStatusStore(t, s)

	teamId := model.NewId()

	user1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "aaa" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(user1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user1.Id}, -1)
	require.NoError(t, nErr)

	user2Admin, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "bbb" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(user2Admin.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user2Admin.Id}, -1)
	require.NoError(t, nErr)

	user3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "ccc" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(user3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user3.Id}, -1)
	require.NoError(t, nErr)

	ch1 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in channel by admin",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	c1, nErr := ss.Channel().Save(ch1, -1)
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      user1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:     c1.Id,
		UserId:        user2Admin.Id,
		NotifyProps:   model.GetDefaultChannelNotifyProps(),
		ExplicitRoles: "channel_admin",
	})
	require.NoError(t, nErr)
	ss.Channel().UpdateMembersRole(c1.Id, []string{user2Admin.Id})

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      user3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	t.Run("get users in admin, offset 0, limit 100", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannelByAdmin(&model.UserGetOptions{
			InChannelId: c1.Id,
			Page:        0,
			PerPage:     100,
		})
		require.NoError(t, err)
		require.Len(t, users, 3)
		require.Equal(t, user2Admin.Username, users[0].Username)
		require.Equal(t, user1.Username, users[1].Username)
		require.Equal(t, user3.Username, users[2].Username)
	})
}

func testUserStoreGetProfilesInChannelByStatus(t *testing.T, ss store.Store, s SqlStore) {

	cleanupStatusStore(t, s)

	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u4.Id}, -1)
	require.NoError(t, nErr)

	ch1 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in channel",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	c1, nErr := ss.Channel().Save(ch1, -1)
	require.NoError(t, nErr)

	ch2 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in private",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	c2, nErr := ss.Channel().Save(ch2, -1)
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u4.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	u4.DeleteAt = 1
	_, err = ss.User().Update(u4, true)
	require.NoError(t, err)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{
		UserId: u1.Id,
		Status: model.StatusDnd,
	}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{
		UserId: u2.Id,
		Status: model.StatusAway,
	}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{
		UserId: u3.Id,
		Status: model.StatusOnline,
	}))

	t.Run("get all users in channel 1, offset 0, limit 100", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannel(&model.UserGetOptions{
			InChannelId: c1.Id,
			Page:        0,
			PerPage:     100,
		})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u1), sanitized(u2), sanitized(u3), sanitized(u4)}, users)
	})

	t.Run("get active in channel 1 by status, offset 0, limit 100", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannelByStatus(&model.UserGetOptions{
			InChannelId: c1.Id,
			Page:        0,
			PerPage:     100,
			Active:      true,
		})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u3), sanitized(u2), sanitized(u1)}, users)
	})

	t.Run("get inactive users in channel 1, offset 0, limit 100", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannel(&model.UserGetOptions{
			InChannelId: c1.Id,
			Page:        0,
			PerPage:     100,
			Inactive:    true,
		})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u4)}, users)
	})

	t.Run("get in channel 2 by status, offset 0, limit 1", func(t *testing.T) {
		users, err := ss.User().GetProfilesInChannelByStatus(&model.UserGetOptions{
			InChannelId: c2.Id,
			Page:        0,
			PerPage:     1,
		})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u1)}, users)
	})
}

func testUserStoreGetProfilesWithoutTeam(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
		DeleteAt: 1,
		Roles:    "system_admin",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	t.Run("get, page 0, per_page 100", func(t *testing.T) {
		users, err := ss.User().GetProfilesWithoutTeam(&model.UserGetOptions{Page: 0, PerPage: 100})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u2), sanitized(u3)}, users)
	})

	t.Run("get, page 1, per_page 1", func(t *testing.T) {
		users, err := ss.User().GetProfilesWithoutTeam(&model.UserGetOptions{Page: 1, PerPage: 1})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u3)}, users)
	})

	t.Run("get, page 2, per_page 1", func(t *testing.T) {
		users, err := ss.User().GetProfilesWithoutTeam(&model.UserGetOptions{Page: 2, PerPage: 1})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{}, users)
	})

	t.Run("get, page 0, per_page 100, inactive", func(t *testing.T) {
		users, err := ss.User().GetProfilesWithoutTeam(&model.UserGetOptions{Page: 0, PerPage: 100, Inactive: true})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u3)}, users)
	})

	t.Run("get, page 0, per_page 100, role", func(t *testing.T) {
		users, err := ss.User().GetProfilesWithoutTeam(&model.UserGetOptions{Page: 0, PerPage: 100, Role: "system_admin"})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{sanitized(u3)}, users)
	})
}

func testUserStoreGetAllProfilesInChannel(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	ch1 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in channel",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	c1, nErr := ss.Channel().Save(ch1, -1)
	require.NoError(t, nErr)

	ch2 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in private",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	c2, nErr := ss.Channel().Save(ch2, -1)
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	t.Run("all profiles in channel 1, no caching", func(t *testing.T) {
		var profiles map[string]*model.User
		profiles, err = ss.User().GetAllProfilesInChannel(context.Background(), c1.Id, false)
		require.NoError(t, err)
		assert.Equal(t, map[string]*model.User{
			u1.Id: sanitized(u1),
			u2.Id: sanitized(u2),
			u3.Id: sanitized(u3),
		}, profiles)
	})

	t.Run("all profiles in channel 2, no caching", func(t *testing.T) {
		var profiles map[string]*model.User
		profiles, err = ss.User().GetAllProfilesInChannel(context.Background(), c2.Id, false)
		require.NoError(t, err)
		assert.Equal(t, map[string]*model.User{
			u1.Id: sanitized(u1),
		}, profiles)
	})

	t.Run("all profiles in channel 2, caching", func(t *testing.T) {
		var profiles map[string]*model.User
		profiles, err = ss.User().GetAllProfilesInChannel(context.Background(), c2.Id, true)
		require.NoError(t, err)
		assert.Equal(t, map[string]*model.User{
			u1.Id: sanitized(u1),
		}, profiles)
	})

	t.Run("all profiles in channel 2, caching [repeated]", func(t *testing.T) {
		var profiles map[string]*model.User
		profiles, err = ss.User().GetAllProfilesInChannel(context.Background(), c2.Id, true)
		require.NoError(t, err)
		assert.Equal(t, map[string]*model.User{
			u1.Id: sanitized(u1),
		}, profiles)
	})

	ss.User().InvalidateProfilesInChannelCacheByUser(u1.Id)
	ss.User().InvalidateProfilesInChannelCache(c2.Id)
}

func testUserStoreGetProfilesNotInChannel(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	ch1 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in channel",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	c1, nErr := ss.Channel().Save(ch1, -1)
	require.NoError(t, nErr)

	ch2 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in private",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	c2, nErr := ss.Channel().Save(ch2, -1)
	require.NoError(t, nErr)

	t.Run("get team 1, channel 1, offset 0, limit 100", func(t *testing.T) {
		var profiles []*model.User
		profiles, err = ss.User().GetProfilesNotInChannel(teamId, c1.Id, false, 0, 100, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u2),
			sanitized(u3),
		}, profiles)
	})

	t.Run("get team 1, channel 2, offset 0, limit 100", func(t *testing.T) {
		var profiles []*model.User
		profiles, err = ss.User().GetProfilesNotInChannel(teamId, c2.Id, false, 0, 100, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u2),
			sanitized(u3),
		}, profiles)
	})

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	t.Run("get team 1, channel 1, offset 0, limit 100, after update", func(t *testing.T) {
		var profiles []*model.User
		profiles, err = ss.User().GetProfilesNotInChannel(teamId, c1.Id, false, 0, 100, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{}, profiles)
	})

	t.Run("get team 1, channel 2, offset 0, limit 100, after update", func(t *testing.T) {
		var profiles []*model.User
		profiles, err = ss.User().GetProfilesNotInChannel(teamId, c2.Id, false, 0, 100, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u2),
			sanitized(u3),
		}, profiles)
	})

	t.Run("get team 1, channel 2, offset 0, limit 0, setting group constrained when it's not", func(t *testing.T) {
		var profiles []*model.User
		profiles, err = ss.User().GetProfilesNotInChannel(teamId, c2.Id, true, 0, 100, nil)
		require.NoError(t, err)
		assert.Empty(t, profiles)
	})

	// create a group
	group, err := ss.Group().Create(&model.Group{
		Name:        model.NewString("n_" + model.NewId()),
		DisplayName: "dn_" + model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString("ri_" + model.NewId()),
	})
	require.NoError(t, err)

	// add two members to the group
	for _, u := range []*model.User{u1, u2} {
		_, err = ss.Group().UpsertMember(group.Id, u.Id)
		require.NoError(t, err)
	}

	// associate the group with the channel
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    group.Id,
		SyncableId: c2.Id,
		Type:       model.GroupSyncableTypeChannel,
	})
	require.NoError(t, err)

	t.Run("get team 1, channel 2, offset 0, limit 0, setting group constrained", func(t *testing.T) {
		profiles, err := ss.User().GetProfilesNotInChannel(teamId, c2.Id, true, 0, 100, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u2),
		}, profiles)
	})
}

func testUserStoreGetProfilesByIds(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	time.Sleep(time.Millisecond)
	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()

	t.Run("get u1 by id, no caching", func(t *testing.T) {
		users, err := ss.User().GetProfileByIds(context.Background(), []string{u1.Id}, nil, false)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u1}, users)
	})

	t.Run("get u1 by id, caching", func(t *testing.T) {
		users, err := ss.User().GetProfileByIds(context.Background(), []string{u1.Id}, nil, true)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u1}, users)
	})

	t.Run("get u1, u2, u3 by id, no caching", func(t *testing.T) {
		users, err := ss.User().GetProfileByIds(context.Background(), []string{u1.Id, u2.Id, u3.Id}, nil, false)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u1, u2, u3}, users)
	})

	t.Run("get u1, u2, u3 by id, caching", func(t *testing.T) {
		users, err := ss.User().GetProfileByIds(context.Background(), []string{u1.Id, u2.Id, u3.Id}, nil, true)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u1, u2, u3}, users)
	})

	t.Run("get unknown id, caching", func(t *testing.T) {
		users, err := ss.User().GetProfileByIds(context.Background(), []string{"123"}, nil, true)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{}, users)
	})

	t.Run("should only return users with UpdateAt greater than the since time", func(t *testing.T) {
		users, err := ss.User().GetProfileByIds(context.Background(), []string{u1.Id, u2.Id, u3.Id, u4.Id}, &store.UserGetByIdsOpts{
			Since: u2.CreateAt,
		}, true)
		require.NoError(t, err)

		// u3 comes from the cache, and u4 does not
		assert.Equal(t, []*model.User{u3, u4}, users)
	})
}

func testUserStoreGetProfileByGroupChannelIdsForUser(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()

	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()

	gc1, nErr := ss.Channel().Save(&model.Channel{
		DisplayName: "Profiles in private",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypeGroup,
	}, -1)
	require.NoError(t, nErr)

	for _, uId := range []string{u1.Id, u2.Id, u3.Id} {
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   gc1.Id,
			UserId:      uId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)
	}

	gc2, nErr := ss.Channel().Save(&model.Channel{
		DisplayName: "Profiles in private",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypeGroup,
	}, -1)
	require.NoError(t, nErr)

	for _, uId := range []string{u1.Id, u3.Id, u4.Id} {
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   gc2.Id,
			UserId:      uId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)
	}

	testCases := []struct {
		Name                       string
		UserId                     string
		ChannelIds                 []string
		ExpectedUserIdsByChannel   map[string][]string
		EnsureChannelsNotInResults []string
	}{
		{
			Name:       "Get group 1 as user 1",
			UserId:     u1.Id,
			ChannelIds: []string{gc1.Id},
			ExpectedUserIdsByChannel: map[string][]string{
				gc1.Id: {u2.Id, u3.Id},
			},
			EnsureChannelsNotInResults: []string{},
		},
		{
			Name:       "Get groups 1 and 2 as user 1",
			UserId:     u1.Id,
			ChannelIds: []string{gc1.Id, gc2.Id},
			ExpectedUserIdsByChannel: map[string][]string{
				gc1.Id: {u2.Id, u3.Id},
				gc2.Id: {u3.Id, u4.Id},
			},
			EnsureChannelsNotInResults: []string{},
		},
		{
			Name:       "Get groups 1 and 2 as user 2",
			UserId:     u2.Id,
			ChannelIds: []string{gc1.Id, gc2.Id},
			ExpectedUserIdsByChannel: map[string][]string{
				gc1.Id: {u1.Id, u3.Id},
			},
			EnsureChannelsNotInResults: []string{gc2.Id},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			res, err := ss.User().GetProfileByGroupChannelIdsForUser(tc.UserId, tc.ChannelIds)
			require.NoError(t, err)

			for channelId, expectedUsers := range tc.ExpectedUserIdsByChannel {
				users, ok := res[channelId]
				require.True(t, ok)

				var userIds []string
				for _, user := range users {
					userIds = append(userIds, user.Id)
				}
				require.ElementsMatch(t, expectedUsers, userIds)
			}

			for _, channelId := range tc.EnsureChannelsNotInResults {
				_, ok := res[channelId]
				require.False(t, ok)
			}
		})
	}
}

func testUserStoreGetProfilesByUsernames(t *testing.T, ss store.Store) {
	teamId := model.NewId()
	team2Id := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: team2Id, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	t.Run("get by u1 and u2 usernames, team id 1", func(t *testing.T) {
		users, err := ss.User().GetProfilesByUsernames([]string{u1.Username, u2.Username}, &model.ViewUsersRestrictions{Teams: []string{teamId}})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u1, u2}, users)
	})

	t.Run("get by u1 username, team id 1", func(t *testing.T) {
		users, err := ss.User().GetProfilesByUsernames([]string{u1.Username}, &model.ViewUsersRestrictions{Teams: []string{teamId}})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u1}, users)
	})

	t.Run("get by u1 and u3 usernames, no team id", func(t *testing.T) {
		users, err := ss.User().GetProfilesByUsernames([]string{u1.Username, u3.Username}, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u1, u3}, users)
	})

	t.Run("get by u1 and u3 usernames, team id 1", func(t *testing.T) {
		users, err := ss.User().GetProfilesByUsernames([]string{u1.Username, u3.Username}, &model.ViewUsersRestrictions{Teams: []string{teamId}})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u1}, users)
	})

	t.Run("get by u1 and u3 usernames, team id 2", func(t *testing.T) {
		users, err := ss.User().GetProfilesByUsernames([]string{u1.Username, u3.Username}, &model.ViewUsersRestrictions{Teams: []string{team2Id}})
		require.NoError(t, err)
		assert.Equal(t, []*model.User{u3}, users)
	})
}

func testUserStoreGetSystemAdminProfiles(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Roles:    model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Roles:    model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	t.Run("all system admin profiles", func(t *testing.T) {
		result, userError := ss.User().GetSystemAdminProfiles()
		require.NoError(t, userError)
		assert.Equal(t, map[string]*model.User{
			u1.Id: sanitized(u1),
			u3.Id: sanitized(u3),
		}, result)
	})
}

func testUserStoreGetByEmail(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	t.Run("get u1 by email", func(t *testing.T) {
		u, err := ss.User().GetByEmail(u1.Email)
		require.NoError(t, err)
		assert.Equal(t, u1, u)
	})

	t.Run("get u2 by email", func(t *testing.T) {
		u, err := ss.User().GetByEmail(u2.Email)
		require.NoError(t, err)
		assert.Equal(t, u2, u)
	})

	t.Run("get u3 by email", func(t *testing.T) {
		u, err := ss.User().GetByEmail(u3.Email)
		require.NoError(t, err)
		assert.Equal(t, u3, u)
	})

	t.Run("get by empty email", func(t *testing.T) {
		_, err := ss.User().GetByEmail("")
		require.Error(t, err)
	})

	t.Run("get by unknown", func(t *testing.T) {
		_, err := ss.User().GetByEmail("unknown")
		require.Error(t, err)
	})
}

func testUserStoreGetByAuthData(t *testing.T, ss store.Store) {
	teamId := model.NewId()
	auth1 := model.NewId()
	auth3 := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:       MakeEmail(),
		Username:    "u1" + model.NewId(),
		AuthData:    &auth1,
		AuthService: "service",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:       MakeEmail(),
		Username:    "u3" + model.NewId(),
		AuthData:    &auth3,
		AuthService: "service2",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	t.Run("get by u1 auth", func(t *testing.T) {
		u, err := ss.User().GetByAuth(u1.AuthData, u1.AuthService)
		require.NoError(t, err)
		assert.Equal(t, u1, u)
	})

	t.Run("get by u3 auth", func(t *testing.T) {
		u, err := ss.User().GetByAuth(u3.AuthData, u3.AuthService)
		require.NoError(t, err)
		assert.Equal(t, u3, u)
	})

	t.Run("get by u1 auth, unknown service", func(t *testing.T) {
		_, err := ss.User().GetByAuth(u1.AuthData, "unknown")
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		require.True(t, errors.As(err, &nfErr))
	})

	t.Run("get by unknown auth, u1 service", func(t *testing.T) {
		unknownAuth := ""
		_, err := ss.User().GetByAuth(&unknownAuth, u1.AuthService)
		require.Error(t, err)
		var invErr *store.ErrInvalidInput
		require.True(t, errors.As(err, &invErr))
	})

	t.Run("get by unknown auth, unknown service", func(t *testing.T) {
		unknownAuth := ""
		_, err := ss.User().GetByAuth(&unknownAuth, "unknown")
		require.Error(t, err)
		var invErr *store.ErrInvalidInput
		require.True(t, errors.As(err, &invErr))
	})
}

func testUserStoreGetByUsername(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	t.Run("get u1 by username", func(t *testing.T) {
		result, err := ss.User().GetByUsername(u1.Username)
		require.NoError(t, err)
		assert.Equal(t, u1, result)
	})

	t.Run("get u2 by username", func(t *testing.T) {
		result, err := ss.User().GetByUsername(u2.Username)
		require.NoError(t, err)
		assert.Equal(t, u2, result)
	})

	t.Run("get u3 by username", func(t *testing.T) {
		result, err := ss.User().GetByUsername(u3.Username)
		require.NoError(t, err)
		assert.Equal(t, u3, result)
	})

	t.Run("get by empty username", func(t *testing.T) {
		_, err := ss.User().GetByUsername("")
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		require.True(t, errors.As(err, &nfErr))
	})

	t.Run("get by unknown", func(t *testing.T) {
		_, err := ss.User().GetByUsername("unknown")
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		require.True(t, errors.As(err, &nfErr))
	})
}

func testUserStoreGetForLogin(t *testing.T, ss store.Store) {
	teamId := model.NewId()
	auth := model.NewId()
	auth2 := model.NewId()
	auth3 := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:       MakeEmail(),
		Username:    "u1" + model.NewId(),
		AuthService: model.UserAuthServiceGitlab,
		AuthData:    &auth,
	})

	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:       MakeEmail(),
		Username:    "u2" + model.NewId(),
		AuthService: model.UserAuthServiceLdap,
		AuthData:    &auth2,
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:       MakeEmail(),
		Username:    "u3" + model.NewId(),
		AuthService: model.UserAuthServiceLdap,
		AuthData:    &auth3,
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	t.Run("get u1 by username, allow both", func(t *testing.T) {
		user, err := ss.User().GetForLogin(u1.Username, true, true)
		require.NoError(t, err)
		assert.Equal(t, u1, user)
	})

	t.Run("get u1 by username, check for case issues", func(t *testing.T) {
		user, err := ss.User().GetForLogin(strings.ToUpper(u1.Username), true, true)
		require.NoError(t, err)
		assert.Equal(t, u1, user)
	})

	t.Run("get u1 by username, allow only email", func(t *testing.T) {
		_, err := ss.User().GetForLogin(u1.Username, false, true)
		require.Error(t, err)
		require.Equal(t, "user not found", err.Error())
	})

	t.Run("get u1 by email, allow both", func(t *testing.T) {
		user, err := ss.User().GetForLogin(u1.Email, true, true)
		require.NoError(t, err)
		assert.Equal(t, u1, user)
	})

	t.Run("get u1 by email, check for case issues", func(t *testing.T) {
		user, err := ss.User().GetForLogin(strings.ToUpper(u1.Email), true, true)
		require.NoError(t, err)
		assert.Equal(t, u1, user)
	})

	t.Run("get u1 by email, allow only username", func(t *testing.T) {
		_, err := ss.User().GetForLogin(u1.Email, true, false)
		require.Error(t, err)
		require.Equal(t, "user not found", err.Error())
	})

	t.Run("get u2 by username, allow both", func(t *testing.T) {
		user, err := ss.User().GetForLogin(u2.Username, true, true)
		require.NoError(t, err)
		assert.Equal(t, u2, user)
	})

	t.Run("get u2 by email, allow both", func(t *testing.T) {
		user, err := ss.User().GetForLogin(u2.Email, true, true)
		require.NoError(t, err)
		assert.Equal(t, u2, user)
	})

	t.Run("get u2 by username, allow neither", func(t *testing.T) {
		_, err := ss.User().GetForLogin(u2.Username, false, false)
		require.Error(t, err)
		require.Equal(t, "sign in with username and email are disabled", err.Error())
	})
}

func testUserStoreUpdatePassword(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	hashedPassword := model.HashPassword("newpwd")

	err = ss.User().UpdatePassword(u1.Id, hashedPassword)
	require.NoError(t, err)

	user, err := ss.User().GetByEmail(u1.Email)
	require.NoError(t, err)
	require.Equal(t, user.Password, hashedPassword, "Password was not updated correctly")
}

func testUserStoreDelete(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	err = ss.User().PermanentDelete(u1.Id)
	require.NoError(t, err)
}

func testUserStoreUpdateAuthData(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1 := &model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	service := "someservice"
	authData := model.NewId()

	_, err = ss.User().UpdateAuthData(u1.Id, service, &authData, "", true)
	require.NoError(t, err)

	user, err := ss.User().GetByEmail(u1.Email)
	require.NoError(t, err)
	require.Equal(t, service, user.AuthService, "AuthService was not updated correctly")
	require.Equal(t, authData, *user.AuthData, "AuthData was not updated correctly")
	require.Equal(t, "", user.Password, "Password was not cleared properly")
}

func testUserStoreResetAuthDataToEmailForUsers(t *testing.T, ss store.Store) {
	user := &model.User{}
	user.Username = "user1" + model.NewId()
	user.Email = MakeEmail()
	_, err := ss.User().Save(user)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

	resetAuthDataToID := func() {
		_, err = ss.User().UpdateAuthData(
			user.Id, model.UserAuthServiceSaml, model.NewString("some-id"), "", false)
		require.NoError(t, err)
	}
	resetAuthDataToID()

	// dry run
	numAffected, err := ss.User().ResetAuthDataToEmailForUsers(model.UserAuthServiceSaml, nil, false, true)
	require.NoError(t, err)
	require.Equal(t, 1, numAffected)
	// real run
	numAffected, err = ss.User().ResetAuthDataToEmailForUsers(model.UserAuthServiceSaml, nil, false, false)
	require.NoError(t, err)
	require.Equal(t, 1, numAffected)
	user, appErr := ss.User().Get(context.Background(), user.Id)
	require.NoError(t, appErr)
	require.Equal(t, *user.AuthData, user.Email)

	resetAuthDataToID()
	// with specific user IDs
	numAffected, err = ss.User().ResetAuthDataToEmailForUsers(model.UserAuthServiceSaml, []string{model.NewId()}, false, true)
	require.NoError(t, err)
	require.Equal(t, 0, numAffected)
	numAffected, err = ss.User().ResetAuthDataToEmailForUsers(model.UserAuthServiceSaml, []string{user.Id}, false, true)
	require.NoError(t, err)
	require.Equal(t, 1, numAffected)

	// delete user
	user.DeleteAt = model.GetMillisForTime(time.Now())
	ss.User().Update(user, true)
	// without deleted user
	numAffected, err = ss.User().ResetAuthDataToEmailForUsers(model.UserAuthServiceSaml, nil, false, true)
	require.NoError(t, err)
	require.Equal(t, 0, numAffected)
	// with deleted user
	numAffected, err = ss.User().ResetAuthDataToEmailForUsers(model.UserAuthServiceSaml, nil, true, true)
	require.NoError(t, err)
	require.Equal(t, 1, numAffected)
}

func testUserUnreadCount(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	c1 := model.Channel{}
	c1.TeamId = teamId
	c1.DisplayName = "Unread Messages"
	c1.Name = "unread-messages-" + model.NewId()
	c1.Type = model.ChannelTypeOpen

	c2 := model.Channel{}
	c2.TeamId = teamId
	c2.DisplayName = "Unread Direct"
	c2.Name = "unread-direct-" + model.NewId()
	c2.Type = model.ChannelTypeDirect

	u1 := &model.User{}
	u1.Username = "user1" + model.NewId()
	u1.Email = MakeEmail()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Username = "user2" + model.NewId()
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3 := &model.User{}
	u3.Email = MakeEmail()
	u3.Username = "user3" + model.NewId()
	_, err = ss.User().Save(u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)

	_, nErr = ss.Channel().Save(&c1, -1)
	require.NoError(t, nErr, "couldn't save item")

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = c1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	_, nErr = ss.Channel().SaveMember(&m2)
	require.NoError(t, nErr)

	m3 := model.ChannelMember{}
	m3.ChannelId = c1.Id
	m3.UserId = u3.Id
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()

	_, nErr = ss.Channel().SaveMember(&m3)
	require.NoError(t, nErr)

	m1.ChannelId = c2.Id
	m2.ChannelId = c2.Id

	_, nErr = ss.Channel().SaveDirectChannel(&c2, &m1, &m2)
	require.NoError(t, nErr, "couldn't save direct channel")

	p1 := model.Post{}
	p1.ChannelId = c1.Id
	p1.UserId = u1.Id
	p1.Message = "this is a message for @" + u2.Username + " and " + "@" + u3.Username

	// Post one message with mention to open channel
	_, nErr = ss.Post().Save(&p1)
	require.NoError(t, nErr)
	nErr = ss.Channel().IncrementMentionCount(c1.Id, []string{u2.Id, u3.Id}, false, false)
	require.NoError(t, nErr)

	// Post 2 messages without mention to direct channel
	p2 := model.Post{}
	p2.ChannelId = c2.Id
	p2.UserId = u1.Id
	p2.Message = "first message"

	_, nErr = ss.Post().Save(&p2)
	require.NoError(t, nErr)
	nErr = ss.Channel().IncrementMentionCount(c2.Id, []string{u2.Id}, false, false)
	require.NoError(t, nErr)

	p3 := model.Post{}
	p3.ChannelId = c2.Id
	p3.UserId = u1.Id
	p3.Message = "second message"
	_, nErr = ss.Post().Save(&p3)
	require.NoError(t, nErr)

	nErr = ss.Channel().IncrementMentionCount(c2.Id, []string{u2.Id}, false, false)
	require.NoError(t, nErr)

	badge, unreadCountErr := ss.User().GetUnreadCount(u2.Id, false)
	require.NoError(t, unreadCountErr)
	require.Equal(t, int64(3), badge, "should have 3 unread messages")

	badge, unreadCountErr = ss.User().GetUnreadCount(u3.Id, false)
	require.NoError(t, unreadCountErr)
	require.Equal(t, int64(1), badge, "should have 1 unread message")

	// Increment root mentions by 1
	nErr = ss.Channel().IncrementMentionCount(c1.Id, []string{u3.Id}, true, false)
	require.NoError(t, nErr)

	// CRT is enabled, only root mentions are counted
	badge, unreadCountErr = ss.User().GetUnreadCount(u3.Id, true)
	require.NoError(t, unreadCountErr)
	require.Equal(t, int64(1), badge, "should have 1 unread message with CRT")

	badge, unreadCountErr = ss.User().GetUnreadCountForChannel(u2.Id, c1.Id)
	require.NoError(t, unreadCountErr)
	require.Equal(t, int64(1), badge, "should have 1 unread messages for that channel")

	badge, unreadCountErr = ss.User().GetUnreadCountForChannel(u2.Id, c2.Id)
	require.NoError(t, unreadCountErr)
	require.Equal(t, int64(2), badge, "should have 2 unread messages for that channel")
}

func testUserStoreUpdateMfaSecret(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(&u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	err = ss.User().UpdateMfaSecret(u1.Id, "12345")
	require.NoError(t, err)

	// should pass, no update will occur though
	err = ss.User().UpdateMfaSecret("junk", "12345")
	require.NoError(t, err)
}

func testUserStoreUpdateMfaActive(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(&u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	time.Sleep(time.Millisecond)

	err = ss.User().UpdateMfaActive(u1.Id, true)
	require.NoError(t, err)

	err = ss.User().UpdateMfaActive(u1.Id, false)
	require.NoError(t, err)

	// should pass, no update will occur though
	err = ss.User().UpdateMfaActive("junk", true)
	require.NoError(t, err)
}

func testUserStoreGetRecentlyActiveUsersForTeam(t *testing.T, ss store.Store, s SqlStore) {

	cleanupStatusStore(t, s)

	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	millis := model.GetMillis()
	u3.LastActivityAt = millis
	u2.LastActivityAt = millis - 1
	u1.LastActivityAt = millis - 1

	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u1.Id, Status: model.StatusOnline, Manual: false, LastActivityAt: u1.LastActivityAt, ActiveChannel: ""}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u2.Id, Status: model.StatusOnline, Manual: false, LastActivityAt: u2.LastActivityAt, ActiveChannel: ""}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u3.Id, Status: model.StatusOnline, Manual: false, LastActivityAt: u3.LastActivityAt, ActiveChannel: ""}))

	t.Run("get team 1, offset 0, limit 100", func(t *testing.T) {
		users, err := ss.User().GetRecentlyActiveUsersForTeam(teamId, 0, 100, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u3),
			sanitized(u1),
			sanitized(u2),
		}, users)
	})

	t.Run("get team 1, offset 0, limit 1", func(t *testing.T) {
		users, err := ss.User().GetRecentlyActiveUsersForTeam(teamId, 0, 1, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u3),
		}, users)
	})

	t.Run("get team 1, offset 2, limit 1", func(t *testing.T) {
		users, err := ss.User().GetRecentlyActiveUsersForTeam(teamId, 2, 1, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u2),
		}, users)
	})
}

func testUserStoreGetNewUsersForTeam(t *testing.T, ss store.Store) {
	teamId := model.NewId()
	teamId2 := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "Yuka",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "Leia",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "Ali",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId2, UserId: u4.Id}, -1)
	require.NoError(t, nErr)

	t.Run("get team 1, offset 0, limit 100", func(t *testing.T) {
		result, err := ss.User().GetNewUsersForTeam(teamId, 0, 100, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u3),
			sanitized(u2),
			sanitized(u1),
		}, result)
	})

	t.Run("get team 1, offset 0, limit 1", func(t *testing.T) {
		result, err := ss.User().GetNewUsersForTeam(teamId, 0, 1, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u3),
		}, result)
	})

	t.Run("get team 1, offset 2, limit 1", func(t *testing.T) {
		result, err := ss.User().GetNewUsersForTeam(teamId, 2, 1, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u1),
		}, result)
	})

	t.Run("get team 2, offset 0, limit 100", func(t *testing.T) {
		result, err := ss.User().GetNewUsersForTeam(teamId2, 0, 100, nil)
		require.NoError(t, err)
		assert.Equal(t, []*model.User{
			sanitized(u4),
		}, result)
	})
}

func assertUsers(t *testing.T, expected, actual []*model.User) {
	expectedUsernames := make([]string, 0, len(expected))
	for _, user := range expected {
		expectedUsernames = append(expectedUsernames, user.Username)
	}

	actualUsernames := make([]string, 0, len(actual))
	for _, user := range actual {
		actualUsernames = append(actualUsernames, user.Username)
	}

	if assert.Equal(t, expectedUsernames, actualUsernames) {
		assert.Equal(t, expected, actual)
	}
}

func testUserStoreSearch(t *testing.T, ss store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
		Roles:     "system_user system_admin",
	}
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim2-bobby" + model.NewId(),
		Email:    MakeEmail(),
		Roles:    "system_user system_user_manager",
	}
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    MakeEmail(),
		Roles:    "system_guest",
	}
	_, err = ss.User().Save(u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""
	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData

	t1id := model.NewId()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: t1id, UserId: u1.Id, SchemeAdmin: true, SchemeUser: true}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: t1id, UserId: u2.Id, SchemeAdmin: true, SchemeUser: true}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: t1id, UserId: u3.Id, SchemeAdmin: false, SchemeUser: false, SchemeGuest: true}, -1)
	require.NoError(t, nErr)

	testCases := []struct {
		Description string
		TeamId      string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search jimb, team 1",
			t1id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1, u3},
		},
		{
			"search jimb, team 1 with team guest and team admin filters without sys admin filter",
			t1id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
				TeamRoles:      []string{model.TeamGuestRoleId, model.TeamAdminRoleId},
			},
			[]*model.User{u3},
		},
		{
			"search jimb, team 1 with team admin filter and sys admin filter",
			t1id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
				Roles:          []string{model.SystemAdminRoleId},
				TeamRoles:      []string{model.TeamAdminRoleId},
			},
			[]*model.User{u1},
		},
		{
			"search jim, team 1 with team admin filter",
			t1id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
				TeamRoles:      []string{model.TeamAdminRoleId},
			},
			[]*model.User{u2},
		},
		{
			"search jim, team 1 with team admin and team guest filter",
			t1id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
				TeamRoles:      []string{model.TeamAdminRoleId, model.TeamGuestRoleId},
			},
			[]*model.User{u2, u3},
		},
		{
			"search jim, team 1 with team admin and system admin filters",
			t1id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
				Roles:          []string{model.SystemAdminRoleId},
				TeamRoles:      []string{model.TeamAdminRoleId},
			},
			[]*model.User{u2, u1},
		},
		{
			"search jim, team 1 with system guest filter",
			t1id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
				Roles:          []string{model.SystemGuestRoleId},
				TeamRoles:      []string{},
			},
			[]*model.User{u3},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := ss.User().Search(
				testCase.TeamId,
				testCase.Term,
				testCase.Options,
			)
			require.NoError(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testUserStoreSearchNotInChannel(t *testing.T, ss store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
	}
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim2-bobby" + model.NewId(),
		Email:    MakeEmail(),
	}
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    MakeEmail(),
		DeleteAt: 1,
	}
	_, err = ss.User().Save(u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr := ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	tid := model.NewId()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u1.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u2.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u3.Id}, -1)
	require.NoError(t, nErr)

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData

	ch1 := model.Channel{
		TeamId:      tid,
		DisplayName: "NameName",
		Name:        NewTestId(),
		Type:        model.ChannelTypeOpen,
	}
	c1, nErr := ss.Channel().Save(&ch1, -1)
	require.NoError(t, nErr)

	ch2 := model.Channel{
		TeamId:      tid,
		DisplayName: "NameName",
		Name:        NewTestId(),
		Type:        model.ChannelTypeOpen,
	}
	c2, nErr := ss.Channel().Save(&ch2, -1)
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)
	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)
	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	testCases := []struct {
		Description string
		TeamId      string
		ChannelId   string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search jimb, channel 1",
			tid,
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, allow inactive, channel 1",
			tid,
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, channel 1, no team id",
			"",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, channel 1, junk team id",
			"junk",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jimb, channel 2",
			tid,
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jimb, allow inactive, channel 2",
			tid,
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u3},
		},
		{
			"search jimb, channel 2, no team id",
			"",
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jimb, channel 2, junk team id",
			"junk",
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jim, channel 1",
			tid,
			c1.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u2, u1},
		},
		{
			"search jim, channel 1, limit 1",
			tid,
			c1.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          1,
			},
			[]*model.User{u2},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := ss.User().SearchNotInChannel(
				testCase.TeamId,
				testCase.ChannelId,
				testCase.Term,
				testCase.Options,
			)
			require.NoError(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testUserStoreSearchInChannel(t *testing.T, ss store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
		Roles:     "system_user system_admin",
	}
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim-bobby" + model.NewId(),
		Email:    MakeEmail(),
		Roles:    "system_user",
	}
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    MakeEmail(),
		DeleteAt: 1,
		Roles:    "system_user",
	}
	_, err = ss.User().Save(u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr := ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	tid := model.NewId()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u1.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u2.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u3.Id}, -1)
	require.NoError(t, nErr)

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData

	ch1 := model.Channel{
		TeamId:      tid,
		DisplayName: "NameName",
		Name:        NewTestId(),
		Type:        model.ChannelTypeOpen,
	}
	c1, nErr := ss.Channel().Save(&ch1, -1)
	require.NoError(t, nErr)

	ch2 := model.Channel{
		TeamId:      tid,
		DisplayName: "NameName",
		Name:        NewTestId(),
		Type:        model.ChannelTypeOpen,
	}
	c2, nErr := ss.Channel().Save(&ch2, -1)
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeAdmin: true,
		SchemeUser:  true,
	})
	require.NoError(t, nErr)
	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeAdmin: false,
		SchemeUser:  true,
	})
	require.NoError(t, nErr)
	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeAdmin: false,
		SchemeUser:  true,
	})
	require.NoError(t, nErr)

	testCases := []struct {
		Description string
		ChannelId   string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search jimb, channel 1",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, allow inactive, channel 1",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1, u3},
		},
		{
			"search jimb, allow inactive, channel 1, limit 1",
			c1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          1,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, channel 2",
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jimb, allow inactive, channel 2",
			c2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jim, allow inactive, channel 1 with system admin filter",
			c1.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
				Roles:          []string{model.SystemAdminRoleId},
			},
			[]*model.User{u1},
		},
		{
			"search jim, allow inactive, channel 1 with system admin and system user filter",
			c1.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
				Roles:          []string{model.SystemAdminRoleId, model.SystemUserRoleId},
			},
			[]*model.User{u1, u3},
		},
		{
			"search jim, allow inactive, channel 1 with channel user filter",
			c1.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
				ChannelRoles:   []string{model.ChannelUserRoleId},
			},
			[]*model.User{u3},
		},
		{
			"search jim, allow inactive, channel 1 with channel user and channel admin filter",
			c1.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
				ChannelRoles:   []string{model.ChannelUserRoleId, model.ChannelAdminRoleId},
			},
			[]*model.User{u3},
		},
		{
			"search jim, allow inactive, channel 2 with channel user filter",
			c2.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
				ChannelRoles:   []string{model.ChannelUserRoleId},
			},
			[]*model.User{u2},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := ss.User().SearchInChannel(
				testCase.ChannelId,
				testCase.Term,
				testCase.Options,
			)
			require.NoError(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testUserStoreSearchNotInTeam(t *testing.T, ss store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
	}
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim-bobby" + model.NewId(),
		Email:    MakeEmail(),
	}
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    MakeEmail(),
		DeleteAt: 1,
	}
	_, err = ss.User().Save(u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr := ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	u4 := &model.User{
		Username: "simon" + model.NewId(),
		Email:    MakeEmail(),
		DeleteAt: 0,
	}
	_, err = ss.User().Save(u4)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()

	u5 := &model.User{
		Username:  "yu" + model.NewId(),
		FirstName: "En",
		LastName:  "Yu",
		Nickname:  "enyu",
		Email:     MakeEmail(),
	}
	_, err = ss.User().Save(u5)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u5.Id)) }()

	u6 := &model.User{
		Username:  "underscore" + model.NewId(),
		FirstName: "Du_",
		LastName:  "_DE",
		Nickname:  "lodash",
		Email:     MakeEmail(),
	}
	_, err = ss.User().Save(u6)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u6.Id)) }()

	teamId1 := model.NewId()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u1.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u2.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	// u4 is not in team 1
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u5.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: u6.Id}, -1)
	require.NoError(t, nErr)

	teamId2 := model.NewId()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId2, UserId: u4.Id}, -1)
	require.NoError(t, nErr)

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData
	u4.AuthData = nilAuthData
	u5.AuthData = nilAuthData
	u6.AuthData = nilAuthData

	testCases := []struct {
		Description string
		TeamId      string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search simo, team 1",
			teamId1,
			"simo",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u4},
		},

		{
			"search jimb, team 1",
			teamId1,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jimb, allow inactive, team 1",
			teamId1,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search simo, team 2",
			teamId2,
			"simo",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jimb, team2",
			teamId2,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, allow inactive, team 2",
			teamId2,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1, u3},
		},
		{
			"search jimb, allow inactive, team 2, limit 1",
			teamId2,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          1,
			},
			[]*model.User{u1},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := ss.User().SearchNotInTeam(
				testCase.TeamId,
				testCase.Term,
				testCase.Options,
			)
			require.NoError(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testUserStoreSearchWithoutTeam(t *testing.T, ss store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
	}
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim2-bobby" + model.NewId(),
		Email:    MakeEmail(),
	}
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    MakeEmail(),
		DeleteAt: 1,
	}
	_, err = ss.User().Save(u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr := ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	tid := model.NewId()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: tid, UserId: u3.Id}, -1)
	require.NoError(t, nErr)

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := new(string)
	*nilAuthData = ""

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData

	testCases := []struct {
		Description string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"empty string",
			"",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u2, u1},
		},
		{
			"jim",
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u2, u1},
		},
		{
			"PLT-8354",
			"* ",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u2, u1},
		},
		{
			"jim, limit 1",
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          1,
			},
			[]*model.User{u2},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := ss.User().SearchWithoutTeam(
				testCase.Term,
				testCase.Options,
			)
			require.NoError(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testUserStoreSearchInGroup(t *testing.T, ss store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
	}
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim-bobby" + model.NewId(),
		Email:    MakeEmail(),
	}
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    MakeEmail(),
	}
	_, err = ss.User().Save(u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := model.NewString("")

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData

	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	_, err = ss.Group().Create(g1)
	require.NoError(t, err)

	g2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	_, err = ss.Group().Create(g2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(g1.Id, u1.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(g2.Id, u2.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(g1.Id, u3.Id)
	require.NoError(t, err)

	u3.DeleteAt = 1
	_, err = ss.User().Update(u3, true)
	require.NoError(t, err)

	testCases := []struct {
		Description string
		GroupId     string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search jimb, group 1",
			g1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, group 1, allow inactive",
			g1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1, u3},
		},
		{
			"search jimb, group 1, limit 1",
			g1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          1,
			},
			[]*model.User{u1},
		},
		{
			"search jimb, group 2",
			g2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jimb, allow inactive, group 2",
			g2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := ss.User().SearchInGroup(
				testCase.GroupId,
				testCase.Term,
				testCase.Options,
			)
			require.NoError(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testUserStoreSearchNotInGroup(t *testing.T, ss store.Store) {
	u1 := &model.User{
		Username:  "jimbo1" + model.NewId(),
		FirstName: "Tim",
		LastName:  "Bill",
		Nickname:  "Rob",
		Email:     "harold" + model.NewId() + "@simulator.amazonses.com",
	}
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2 := &model.User{
		Username: "jim-bobby" + model.NewId(),
		Email:    MakeEmail(),
	}
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	u3 := &model.User{
		Username: "jimbo3" + model.NewId(),
		Email:    MakeEmail(),
	}
	_, err = ss.User().Save(u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()

	// The users returned from the database will have AuthData as an empty string.
	nilAuthData := model.NewString("")

	u1.AuthData = nilAuthData
	u2.AuthData = nilAuthData
	u3.AuthData = nilAuthData

	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceCustom,
		RemoteId:    model.NewString(model.NewId()),
	}
	_, err = ss.Group().Create(g1)
	require.NoError(t, err)

	g2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceCustom,
		RemoteId:    model.NewString(model.NewId()),
	}
	_, err = ss.Group().Create(g2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(g1.Id, u1.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(g2.Id, u2.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(g1.Id, u3.Id)
	require.NoError(t, err)

	u3.DeleteAt = 1
	_, err = ss.User().Update(u3, true)
	require.NoError(t, err)

	testCases := []struct {
		Description string
		GroupId     string
		Term        string
		Options     *model.UserSearchOptions
		Expected    []*model.User
	}{
		{
			"search jimb, not in group 1",
			g1.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{},
		},
		{
			"search jim, not in group 1",
			g1.Id,
			"jim",
			&model.UserSearchOptions{
				AllowFullNames: true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u2},
		},
		{
			"search jimb, not in group 3, allow inactive",
			g2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1, u3},
		},
		{
			"search jim, not in group 2",
			g2.Id,
			"jimb",
			&model.UserSearchOptions{
				AllowFullNames: true,
				AllowInactive:  true,
				Limit:          model.UserSearchDefaultLimit,
			},
			[]*model.User{u1, u3},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			users, err := ss.User().SearchNotInGroup(
				testCase.GroupId,
				testCase.Term,
				testCase.Options,
			)
			require.NoError(t, err)
			assertUsers(t, testCase.Expected, users)
		})
	}
}

func testCount(t *testing.T, ss store.Store) {
	// Regular
	teamId := model.NewId()
	channelId := model.NewId()
	regularUser := &model.User{}
	regularUser.Email = MakeEmail()
	regularUser.Roles = model.SystemUserRoleId
	_, err := ss.User().Save(regularUser)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(regularUser.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: regularUser.Id, SchemeAdmin: false, SchemeUser: true}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{UserId: regularUser.Id, ChannelId: channelId, SchemeAdmin: false, SchemeUser: true, NotifyProps: model.GetDefaultChannelNotifyProps()})
	require.NoError(t, nErr)

	guestUser := &model.User{}
	guestUser.Email = MakeEmail()
	guestUser.Roles = model.SystemGuestRoleId
	_, err = ss.User().Save(guestUser)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(guestUser.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: guestUser.Id, SchemeAdmin: false, SchemeUser: false, SchemeGuest: true}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{UserId: guestUser.Id, ChannelId: channelId, SchemeAdmin: false, SchemeUser: false, SchemeGuest: true, NotifyProps: model.GetDefaultChannelNotifyProps()})
	require.NoError(t, nErr)

	teamAdmin := &model.User{}
	teamAdmin.Email = MakeEmail()
	teamAdmin.Roles = model.SystemUserRoleId
	_, err = ss.User().Save(teamAdmin)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(teamAdmin.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: teamAdmin.Id, SchemeAdmin: true, SchemeUser: true}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{UserId: teamAdmin.Id, ChannelId: channelId, SchemeAdmin: true, SchemeUser: true, NotifyProps: model.GetDefaultChannelNotifyProps()})
	require.NoError(t, nErr)

	sysAdmin := &model.User{}
	sysAdmin.Email = MakeEmail()
	sysAdmin.Roles = model.SystemAdminRoleId + " " + model.SystemUserRoleId
	_, err = ss.User().Save(sysAdmin)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(sysAdmin.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: sysAdmin.Id, SchemeAdmin: false, SchemeUser: true}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{UserId: sysAdmin.Id, ChannelId: channelId, SchemeAdmin: true, SchemeUser: true, NotifyProps: model.GetDefaultChannelNotifyProps()})
	require.NoError(t, nErr)

	// Deleted
	deletedUser := &model.User{}
	deletedUser.Email = MakeEmail()
	deletedUser.DeleteAt = model.GetMillis()
	_, err = ss.User().Save(deletedUser)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(deletedUser.Id)) }()

	// Bot
	botUser, err := ss.User().Save(&model.User{
		Email: MakeEmail(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(botUser.Id)) }()
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   botUser.Id,
		Username: botUser.Username,
		OwnerId:  regularUser.Id,
	})
	require.NoError(t, nErr)
	botUser.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(botUser.Id)) }()

	testCases := []struct {
		Description string
		Options     model.UserCountOptions
		Expected    int64
	}{
		{
			"No bot accounts no deleted accounts and no team id",
			model.UserCountOptions{
				IncludeBotAccounts: false,
				IncludeDeleted:     false,
				TeamId:             "",
			},
			4,
		},
		{
			"Include bot accounts no deleted accounts and no team id",
			model.UserCountOptions{
				IncludeBotAccounts: true,
				IncludeDeleted:     false,
				TeamId:             "",
			},
			5,
		},
		{
			"Include delete accounts no bots and no team id",
			model.UserCountOptions{
				IncludeBotAccounts: false,
				IncludeDeleted:     true,
				TeamId:             "",
			},
			5,
		},
		{
			"Include bot accounts and deleted accounts and no team id",
			model.UserCountOptions{
				IncludeBotAccounts: true,
				IncludeDeleted:     true,
				TeamId:             "",
			},
			6,
		},
		{
			"Include bot accounts, deleted accounts, exclude regular users with no team id",
			model.UserCountOptions{
				IncludeBotAccounts:  true,
				IncludeDeleted:      true,
				ExcludeRegularUsers: true,
				TeamId:              "",
			},
			1,
		},
		{
			"Include bot accounts and deleted accounts with existing team id",
			model.UserCountOptions{
				IncludeBotAccounts: true,
				IncludeDeleted:     true,
				TeamId:             teamId,
			},
			4,
		},
		{
			"Include bot accounts and deleted accounts with fake team id",
			model.UserCountOptions{
				IncludeBotAccounts: true,
				IncludeDeleted:     true,
				TeamId:             model.NewId(),
			},
			0,
		},
		{
			"Include bot accounts and deleted accounts with existing team id and view restrictions allowing team",
			model.UserCountOptions{
				IncludeBotAccounts: true,
				IncludeDeleted:     true,
				TeamId:             teamId,
				ViewRestrictions:   &model.ViewUsersRestrictions{Teams: []string{teamId}},
			},
			4,
		},
		{
			"Include bot accounts and deleted accounts with existing team id and view restrictions not allowing current team",
			model.UserCountOptions{
				IncludeBotAccounts: true,
				IncludeDeleted:     true,
				TeamId:             teamId,
				ViewRestrictions:   &model.ViewUsersRestrictions{Teams: []string{model.NewId()}},
			},
			0,
		},
		{
			"Filter by system admins only",
			model.UserCountOptions{
				TeamId: teamId,
				Roles:  []string{model.SystemAdminRoleId},
			},
			1,
		},
		{
			"Filter by system users only",
			model.UserCountOptions{
				TeamId: teamId,
				Roles:  []string{model.SystemUserRoleId},
			},
			2,
		},
		{
			"Filter by system guests only",
			model.UserCountOptions{
				TeamId: teamId,
				Roles:  []string{model.SystemGuestRoleId},
			},
			1,
		},
		{
			"Filter by system admins and system users",
			model.UserCountOptions{
				TeamId: teamId,
				Roles:  []string{model.SystemAdminRoleId, model.SystemUserRoleId},
			},
			3,
		},
		{
			"Filter by system admins, system user and system guests",
			model.UserCountOptions{
				TeamId: teamId,
				Roles:  []string{model.SystemAdminRoleId, model.SystemUserRoleId, model.SystemGuestRoleId},
			},
			4,
		},
		{
			"Filter by team admins",
			model.UserCountOptions{
				TeamId:    teamId,
				TeamRoles: []string{model.TeamAdminRoleId},
			},
			1,
		},
		{
			"Filter by team members",
			model.UserCountOptions{
				TeamId:    teamId,
				TeamRoles: []string{model.TeamUserRoleId},
			},
			1,
		},
		{
			"Filter by team guests",
			model.UserCountOptions{
				TeamId:    teamId,
				TeamRoles: []string{model.TeamGuestRoleId},
			},
			1,
		},
		{
			"Filter by team guests and any system role",
			model.UserCountOptions{
				TeamId:    teamId,
				TeamRoles: []string{model.TeamGuestRoleId},
				Roles:     []string{model.SystemAdminRoleId},
			},
			2,
		},
		{
			"Filter by channel members",
			model.UserCountOptions{
				ChannelId:    channelId,
				ChannelRoles: []string{model.ChannelUserRoleId},
			},
			1,
		},
		{
			"Filter by channel members and system admins",
			model.UserCountOptions{
				ChannelId:    channelId,
				Roles:        []string{model.SystemAdminRoleId},
				ChannelRoles: []string{model.ChannelUserRoleId},
			},
			2,
		},
		{
			"Filter by channel members and system admins and channel admins",
			model.UserCountOptions{
				ChannelId:    channelId,
				Roles:        []string{model.SystemAdminRoleId},
				ChannelRoles: []string{model.ChannelUserRoleId, model.ChannelAdminRoleId},
			},
			3,
		},
		{
			"Filter by channel guests",
			model.UserCountOptions{
				ChannelId:    channelId,
				ChannelRoles: []string{model.ChannelGuestRoleId},
			},
			1,
		},
		{
			"Filter by channel guests and any system role",
			model.UserCountOptions{
				ChannelId:    channelId,
				ChannelRoles: []string{model.ChannelGuestRoleId},
				Roles:        []string{model.SystemAdminRoleId},
			},
			2,
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			count, err := ss.User().Count(testCase.Options)
			require.NoError(t, err)
			require.Equal(t, testCase.Expected, count)
		})
	}
}

func testUserStoreGetFirstSystemAdminID(t *testing.T, ss store.Store) {
	sysAdmin := &model.User{}
	sysAdmin.Email = MakeEmail()
	sysAdmin.Roles = model.SystemAdminRoleId + " " + model.SystemUserRoleId
	sysAdmin, err := ss.User().Save(sysAdmin)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(sysAdmin.Id)) }()

	// We need the second system admin to be created after the first one
	// our granulirity is ms
	time.Sleep(1 * time.Millisecond)

	sysAdmin2 := &model.User{}
	sysAdmin2.Email = MakeEmail()
	sysAdmin2.Roles = model.SystemAdminRoleId + " " + model.SystemUserRoleId
	sysAdmin2, err = ss.User().Save(sysAdmin2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(sysAdmin2.Id)) }()

	returnedId, err := ss.User().GetFirstSystemAdminID()
	require.NoError(t, err)
	require.Equal(t, sysAdmin.Id, returnedId)
}

func testUserStoreAnalyticsActiveCount(t *testing.T, ss store.Store, s SqlStore) {

	cleanupStatusStore(t, s)

	// Create 5 users statuses u0, u1, u2, u3, u4.
	// u4 is also a bot
	u0, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u0" + model.NewId(),
	})
	require.NoError(t, err)
	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() {
		require.NoError(t, ss.User().PermanentDelete(u0.Id))
		require.NoError(t, ss.User().PermanentDelete(u1.Id))
		require.NoError(t, ss.User().PermanentDelete(u2.Id))
		require.NoError(t, ss.User().PermanentDelete(u3.Id))
		require.NoError(t, ss.User().PermanentDelete(u4.Id))
	}()

	_, nErr := ss.Bot().Save(&model.Bot{
		UserId:   u4.Id,
		Username: u4.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)

	millis := model.GetMillis()
	millisTwoDaysAgo := model.GetMillis() - (2 * DayMilliseconds)
	millisTwoMonthsAgo := model.GetMillis() - (2 * MonthMilliseconds)

	// u0 last activity status is two months ago.
	// u1 last activity status is two days ago.
	// u2, u3, u4 last activity is within last day
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u0.Id, Status: model.StatusOffline, LastActivityAt: millisTwoMonthsAgo}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u1.Id, Status: model.StatusOffline, LastActivityAt: millisTwoDaysAgo}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u2.Id, Status: model.StatusOffline, LastActivityAt: millis}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u3.Id, Status: model.StatusOffline, LastActivityAt: millis}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u4.Id, Status: model.StatusOffline, LastActivityAt: millis}))

	// Daily counts (without bots)
	count, err := ss.User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: true})
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)

	// Daily counts (with bots)
	count, err = ss.User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: true, IncludeDeleted: true})
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)

	// Monthly counts (without bots)
	count, err = ss.User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: true})
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)

	// Monthly counts - (with bots)
	count, err = ss.User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: true, IncludeDeleted: true})
	require.NoError(t, err)
	assert.Equal(t, int64(4), count)

	// Monthly counts - (with bots, excluding deleted)
	count, err = ss.User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: true, IncludeDeleted: false})
	require.NoError(t, err)
	assert.Equal(t, int64(4), count)
}

func testUserStoreAnalyticsActiveCountForPeriod(t *testing.T, ss store.Store, s SqlStore) {

	cleanupStatusStore(t, s)

	// Create 5 users statuses u0, u1, u2, u3, u4.
	// u4 is also a bot
	u0, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u0" + model.NewId(),
	})
	require.NoError(t, err)
	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() {
		require.NoError(t, ss.User().PermanentDelete(u0.Id))
		require.NoError(t, ss.User().PermanentDelete(u1.Id))
		require.NoError(t, ss.User().PermanentDelete(u2.Id))
		require.NoError(t, ss.User().PermanentDelete(u3.Id))
		require.NoError(t, ss.User().PermanentDelete(u4.Id))
	}()

	_, nErr := ss.Bot().Save(&model.Bot{
		UserId:   u4.Id,
		Username: u4.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)

	millis := model.GetMillis()
	millisTwoDaysAgo := model.GetMillis() - (2 * DayMilliseconds)
	millisTwoMonthsAgo := model.GetMillis() - (2 * MonthMilliseconds)

	// u0 last activity status is two months ago.
	// u1 last activity status is one month ago
	// u2 last activity is two days ago
	// u2 last activity is one day ago
	// u3 last activity is within last day
	// u4 last activity is within last day
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u0.Id, Status: model.StatusOffline, LastActivityAt: millisTwoMonthsAgo}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u1.Id, Status: model.StatusOffline, LastActivityAt: millisTwoMonthsAgo + MonthMilliseconds}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u2.Id, Status: model.StatusOffline, LastActivityAt: millisTwoDaysAgo}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u3.Id, Status: model.StatusOffline, LastActivityAt: millisTwoDaysAgo + DayMilliseconds}))
	require.NoError(t, ss.Status().SaveOrUpdate(&model.Status{UserId: u4.Id, Status: model.StatusOffline, LastActivityAt: millis}))

	// Two months to two days (without bots)
	count, nerr := ss.User().AnalyticsActiveCountForPeriod(millisTwoMonthsAgo, millisTwoDaysAgo, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
	require.NoError(t, nerr)
	assert.Equal(t, int64(2), count)

	// Two months to two days (without bots)
	count, nerr = ss.User().AnalyticsActiveCountForPeriod(millisTwoMonthsAgo, millisTwoDaysAgo, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: true})
	require.NoError(t, nerr)
	assert.Equal(t, int64(2), count)

	// Two days to present - (with bots)
	count, nerr = ss.User().AnalyticsActiveCountForPeriod(millisTwoDaysAgo, millis, model.UserCountOptions{IncludeBotAccounts: true, IncludeDeleted: false})
	require.NoError(t, nerr)
	assert.Equal(t, int64(2), count)

	// Two days to present - (with bots, excluding deleted)
	count, nerr = ss.User().AnalyticsActiveCountForPeriod(millisTwoDaysAgo, millis, model.UserCountOptions{IncludeBotAccounts: true, IncludeDeleted: true})
	require.NoError(t, nerr)
	assert.Equal(t, int64(2), count)
}

func testUserStoreAnalyticsGetInactiveUsersCount(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	count, err := ss.User().AnalyticsGetInactiveUsersCount()
	require.NoError(t, err)

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.DeleteAt = model.GetMillis()
	_, err = ss.User().Save(u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	newCount, err := ss.User().AnalyticsGetInactiveUsersCount()
	require.NoError(t, err)
	require.Equal(t, count, newCount-1, "Expected 1 more inactive users but found otherwise.")
}

func testUserStoreAnalyticsGetSystemAdminCount(t *testing.T, ss store.Store) {
	countBefore, err := ss.User().AnalyticsGetSystemAdminCount()
	require.NoError(t, err)

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewId()
	u1.Roles = "system_user system_admin"

	u2 := model.User{}
	u2.Email = MakeEmail()
	u2.Username = model.NewId()

	_, nErr := ss.User().Save(&u1)
	require.NoError(t, nErr, "couldn't save user")
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	_, nErr = ss.User().Save(&u2)
	require.NoError(t, nErr, "couldn't save user")

	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	result, err := ss.User().AnalyticsGetSystemAdminCount()
	require.NoError(t, err)
	require.Equal(t, countBefore+1, result, "Did not get the expected number of system admins.")

}

func testUserStoreAnalyticsGetGuestCount(t *testing.T, ss store.Store) {
	countBefore, err := ss.User().AnalyticsGetGuestCount()
	require.NoError(t, err)

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewId()
	u1.Roles = "system_user system_admin"

	u2 := model.User{}
	u2.Email = MakeEmail()
	u2.Username = model.NewId()
	u2.Roles = "system_user"

	u3 := model.User{}
	u3.Email = MakeEmail()
	u3.Username = model.NewId()
	u3.Roles = "system_guest"

	_, nErr := ss.User().Save(&u1)
	require.NoError(t, nErr, "couldn't save user")
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	_, nErr = ss.User().Save(&u2)
	require.NoError(t, nErr, "couldn't save user")
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	_, nErr = ss.User().Save(&u3)
	require.NoError(t, nErr, "couldn't save user")
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()

	result, err := ss.User().AnalyticsGetGuestCount()
	require.NoError(t, err)
	require.Equal(t, countBefore+1, result, "Did not get the expected number of guests.")
}

func testUserStoreAnalyticsGetExternalUsers(t *testing.T, ss store.Store) {
	localHostDomain := "mattermost.com"
	result, err := ss.User().AnalyticsGetExternalUsers(localHostDomain)
	require.NoError(t, err)
	assert.False(t, result)

	u1 := model.User{}
	u1.Email = "a@mattermost.com"
	u1.Username = model.NewId()
	u1.Roles = "system_user system_admin"

	u2 := model.User{}
	u2.Email = "b@example.com"
	u2.Username = model.NewId()
	u2.Roles = "system_user"

	u3 := model.User{}
	u3.Email = "c@test.com"
	u3.Username = model.NewId()
	u3.Roles = "system_guest"

	_, err = ss.User().Save(&u1)
	require.NoError(t, err, "couldn't save user")
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	_, err = ss.User().Save(&u2)
	require.NoError(t, err, "couldn't save user")
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()

	_, err = ss.User().Save(&u3)
	require.NoError(t, err, "couldn't save user")
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()

	result, err = ss.User().AnalyticsGetExternalUsers(localHostDomain)
	require.NoError(t, err)
	assert.True(t, result)
}

func testUserStoreGetProfilesNotInTeam(t *testing.T, ss store.Store) {
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "Team",
		Name:        NewTestId(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	teamId := team.Id
	teamId2 := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	// Ensure update at timestamp changes
	time.Sleep(time.Millisecond)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId2, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	// Ensure update at timestamp changes
	time.Sleep(time.Millisecond)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	var etag1, etag2, etag3 string

	t.Run("etag for profiles not in team 1", func(t *testing.T) {
		etag1 = ss.User().GetEtagForProfilesNotInTeam(teamId)
	})

	t.Run("get not in team 1, offset 0, limit 100000", func(t *testing.T) {
		users, userErr := ss.User().GetProfilesNotInTeam(teamId, false, 0, 100000, nil)
		require.NoError(t, userErr)
		assert.Equal(t, []*model.User{
			sanitized(u2),
			sanitized(u3),
		}, users)
	})

	t.Run("get not in team 1, offset 1, limit 1", func(t *testing.T) {
		users, userErr := ss.User().GetProfilesNotInTeam(teamId, false, 1, 1, nil)
		require.NoError(t, userErr)
		assert.Equal(t, []*model.User{
			sanitized(u3),
		}, users)
	})

	t.Run("get not in team 2, offset 0, limit 100", func(t *testing.T) {
		users, userErr := ss.User().GetProfilesNotInTeam(teamId2, false, 0, 100, nil)
		require.NoError(t, userErr)
		assert.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u3),
		}, users)
	})

	// Ensure update at timestamp changes
	time.Sleep(time.Millisecond)

	// Add u2 to team 1
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)
	u2.UpdateAt, err = ss.User().UpdateUpdateAt(u2.Id)
	require.NoError(t, err)

	t.Run("etag for profiles not in team 1 after update", func(t *testing.T) {
		etag2 = ss.User().GetEtagForProfilesNotInTeam(teamId)
		require.NotEqual(t, etag2, etag1, "etag should have changed")
	})

	t.Run("get not in team 1, offset 0, limit 100000 after update", func(t *testing.T) {
		users, userErr := ss.User().GetProfilesNotInTeam(teamId, false, 0, 100000, nil)
		require.NoError(t, userErr)
		assert.Equal(t, []*model.User{
			sanitized(u3),
		}, users)
	})

	// Ensure update at timestamp changes
	time.Sleep(time.Millisecond)

	e := ss.Team().RemoveMember(teamId, u1.Id)
	require.NoError(t, e)
	e = ss.Team().RemoveMember(teamId, u2.Id)
	require.NoError(t, e)

	u1.UpdateAt, err = ss.User().UpdateUpdateAt(u1.Id)
	require.NoError(t, err)
	u2.UpdateAt, err = ss.User().UpdateUpdateAt(u2.Id)
	require.NoError(t, err)

	t.Run("etag for profiles not in team 1 after second update", func(t *testing.T) {
		etag3 = ss.User().GetEtagForProfilesNotInTeam(teamId)
		require.NotEqual(t, etag1, etag3, "etag should have changed")
		require.NotEqual(t, etag2, etag3, "etag should have changed")
	})

	t.Run("get not in team 1, offset 0, limit 100000 after second update", func(t *testing.T) {
		users, userErr := ss.User().GetProfilesNotInTeam(teamId, false, 0, 100000, nil)
		require.NoError(t, userErr)
		assert.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u2),
			sanitized(u3),
		}, users)
	})

	// Ensure update at timestamp changes
	time.Sleep(time.Millisecond)

	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u4.Id}, -1)
	require.NoError(t, nErr)

	t.Run("etag for profiles not in team 1 after addition to team", func(t *testing.T) {
		etag4 := ss.User().GetEtagForProfilesNotInTeam(teamId)
		require.Equal(t, etag3, etag4, "etag should not have changed")
	})

	// Add u3 to team 2
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId2, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	u3.UpdateAt, err = ss.User().UpdateUpdateAt(u3.Id)
	require.NoError(t, err)

	// GetEtagForProfilesNotInTeam produces a new etag every time a member, not
	// in the team, gets a new UpdateAt value. In the case that an older member
	// in the set joins a different team, their UpdateAt value changes, thus
	// creating a new etag (even though the user set doesn't change). A hashing
	// solution, which only uses UserIds, would solve this issue.
	t.Run("etag for profiles not in team 1 after u3 added to team 2", func(t *testing.T) {
		t.Skip()
		etag4 := ss.User().GetEtagForProfilesNotInTeam(teamId)
		require.Equal(t, etag3, etag4, "etag should not have changed")
	})

	t.Run("get not in team 1, offset 0, limit 100000 after second update, setting group constrained when it's not", func(t *testing.T) {
		users, userErr := ss.User().GetProfilesNotInTeam(teamId, true, 0, 100000, nil)
		require.NoError(t, userErr)
		assert.Empty(t, users)
	})

	// create a group
	group, err := ss.Group().Create(&model.Group{
		Name:        model.NewString("n_" + model.NewId()),
		DisplayName: "dn_" + model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString("ri_" + model.NewId()),
	})
	require.NoError(t, err)

	// add two members to the group
	for _, u := range []*model.User{u1, u2} {
		_, err = ss.Group().UpsertMember(group.Id, u.Id)
		require.NoError(t, err)
	}

	// associate the group with the team
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    group.Id,
		SyncableId: teamId,
		Type:       model.GroupSyncableTypeTeam,
	})
	require.NoError(t, err)

	t.Run("get not in team 1, offset 0, limit 100000 after second update, setting group constrained", func(t *testing.T) {
		users, userErr := ss.User().GetProfilesNotInTeam(teamId, true, 0, 100000, nil)
		require.NoError(t, userErr)
		assert.Equal(t, []*model.User{
			sanitized(u1),
			sanitized(u2),
		}, users)
	})
}

func testUserStoreClearAllCustomRoleAssignments(t *testing.T, ss store.Store) {
	u1 := model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
		Roles:    "system_user system_admin system_post_all",
	}
	u2 := model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
		Roles:    "system_user custom_role system_admin another_custom_role",
	}
	u3 := model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
		Roles:    "system_user",
	}
	u4 := model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
		Roles:    "custom_only",
	}

	_, err := ss.User().Save(&u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, err = ss.User().Save(&u2)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, err = ss.User().Save(&u3)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, err = ss.User().Save(&u4)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()

	require.NoError(t, ss.User().ClearAllCustomRoleAssignments())

	r1, err := ss.User().GetByUsername(u1.Username)
	require.NoError(t, err)
	assert.Equal(t, u1.Roles, r1.Roles)

	r2, err1 := ss.User().GetByUsername(u2.Username)
	require.NoError(t, err1)
	assert.Equal(t, "system_user system_admin", r2.Roles)

	r3, err2 := ss.User().GetByUsername(u3.Username)
	require.NoError(t, err2)
	assert.Equal(t, u3.Roles, r3.Roles)

	r4, err3 := ss.User().GetByUsername(u4.Username)
	require.NoError(t, err3)
	assert.Equal(t, "", r4.Roles)
}

func testUserStoreGetAllAfter(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
		Roles:    "system_user system_admin system_post_all",
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr := ss.Bot().Save(&model.Bot{
		UserId:   u2.Id,
		Username: u2.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u2.IsBot = true
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u2.Id)) }()

	expected := []*model.User{u1, u2}
	if strings.Compare(u2.Id, u1.Id) < 0 {
		expected = []*model.User{u2, u1}
	}

	t.Run("get after lowest possible id", func(t *testing.T) {
		actual, err := ss.User().GetAllAfter(10000, strings.Repeat("0", 26))
		require.NoError(t, err)

		assert.Equal(t, expected, actual)
	})

	t.Run("get after first user", func(t *testing.T) {
		actual, err := ss.User().GetAllAfter(10000, expected[0].Id)
		require.NoError(t, err)

		assert.Equal(t, []*model.User{expected[1]}, actual)
	})

	t.Run("get after second user", func(t *testing.T) {
		actual, err := ss.User().GetAllAfter(10000, expected[1].Id)
		require.NoError(t, err)

		assert.Equal(t, []*model.User{}, actual)
	})
}

func testUserStoreGetUsersBatchForIndexing(t *testing.T, ss store.Store) {
	// Set up all the objects needed
	t1, err := ss.Team().Save(&model.Team{
		DisplayName: "Team1",
		Name:        NewTestId(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)

	ch1 := &model.Channel{
		Name: model.NewId(),
		Type: model.ChannelTypeOpen,
	}
	cPub1, nErr := ss.Channel().Save(ch1, -1)
	require.NoError(t, nErr)

	ch2 := &model.Channel{
		Name: model.NewId(),
		Type: model.ChannelTypeOpen,
	}
	cPub2, nErr := ss.Channel().Save(ch2, -1)
	require.NoError(t, nErr)

	ch3 := &model.Channel{
		Name: model.NewId(),
		Type: model.ChannelTypePrivate,
	}

	cPriv, nErr := ss.Channel().Save(ch3, -1)
	require.NoError(t, nErr)

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
		CreateAt: model.GetMillis(),
	})
	require.NoError(t, err)

	time.Sleep(time.Millisecond)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
		CreateAt: model.GetMillis(),
	})
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{
		UserId: u2.Id,
		TeamId: t1.Id,
	}, 100)
	require.NoError(t, nErr)
	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		UserId:      u2.Id,
		ChannelId:   cPub1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)
	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		UserId:      u2.Id,
		ChannelId:   cPub2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	time.Sleep(time.Millisecond)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
		CreateAt: model.GetMillis(),
	})
	require.NoError(t, err)
	_, nErr = ss.Team().SaveMember(&model.TeamMember{
		UserId:   u3.Id,
		TeamId:   t1.Id,
		DeleteAt: model.GetMillis(),
	}, 100)
	require.NoError(t, nErr)
	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		UserId:      u3.Id,
		ChannelId:   cPub2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)
	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		UserId:      u3.Id,
		ChannelId:   cPriv.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	cDM := &model.Channel{
		Name: model.NewId() + "__" + model.NewId(),
		Type: model.ChannelTypeDirect,
	}
	cm1 := &model.ChannelMember{
		UserId:      u3.Id,
		ChannelId:   cDM.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	cm2 := &model.ChannelMember{
		UserId:      u2.Id,
		ChannelId:   cDM.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	cDM, nErr = ss.Channel().SaveDirectChannel(cDM, cm1, cm2)
	require.NoError(t, nErr)

	// Getting all users
	res1List, err := ss.User().GetUsersBatchForIndexing(u1.CreateAt-1, "", 100)
	require.NoError(t, err)
	assert.Len(t, res1List, 3)
	for _, user := range res1List {
		switch user.Id {
		case u2.Id:
			assert.ElementsMatch(t, user.ChannelsIds, []string{cPub1.Id, cPub2.Id, cDM.Id})
		case u3.Id:
			assert.ElementsMatch(t, user.ChannelsIds, []string{cPub2.Id, cDM.Id})
		}
	}

	// Testing pagination
	res2List, err := ss.User().GetUsersBatchForIndexing(u1.CreateAt-1, "", 1)
	require.NoError(t, err)
	assert.Len(t, res2List, 1)

	res2List, err = ss.User().GetUsersBatchForIndexing(res2List[0].CreateAt, res2List[0].Id, 2)
	require.NoError(t, err)
	assert.Len(t, res2List, 2)

	res2List, err = ss.User().GetUsersBatchForIndexing(res2List[1].CreateAt, res2List[1].Id, 2)
	require.NoError(t, err)
	assert.Len(t, res2List, 0)
}

func testUserStoreGetTeamGroupUsers(t *testing.T, ss store.Store) {
	// create team
	id := model.NewId()
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "dn_" + id,
		Name:        "n-" + id,
		Email:       id + "@test.com",
		Type:        model.TeamInvite,
	})
	require.NoError(t, err)
	require.NotNil(t, team)

	// create users
	var testUsers []*model.User
	for i := 0; i < 3; i++ {
		id = model.NewId()
		user, userErr := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
		})
		require.NoError(t, userErr)
		require.NotNil(t, user)
		testUsers = append(testUsers, user)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()
	}
	require.Len(t, testUsers, 3, "testUsers length doesn't meet required length")
	userGroupA, userGroupB, userNoGroup := testUsers[0], testUsers[1], testUsers[2]

	// add non-group-member to the team (to prove that the query isn't just returning all members)
	_, nErr := ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: userNoGroup.Id,
	}, 999)
	require.NoError(t, nErr)

	// create groups
	var testGroups []*model.Group
	for i := 0; i < 2; i++ {
		id = model.NewId()

		var group *model.Group
		group, err = ss.Group().Create(&model.Group{
			Name:        model.NewString("n_" + id),
			DisplayName: "dn_" + id,
			Source:      model.GroupSourceLdap,
			RemoteId:    model.NewString("ri_" + id),
		})
		require.NoError(t, err)
		require.NotNil(t, group)
		testGroups = append(testGroups, group)
	}
	require.Len(t, testGroups, 2, "testGroups length doesn't meet required length")
	groupA, groupB := testGroups[0], testGroups[1]

	// add members to groups
	_, err = ss.Group().UpsertMember(groupA.Id, userGroupA.Id)
	require.NoError(t, err)
	_, err = ss.Group().UpsertMember(groupB.Id, userGroupB.Id)
	require.NoError(t, err)

	// association one group to team
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    groupA.Id,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
	})
	require.NoError(t, err)

	var users []*model.User

	requireNUsers := func(n int) {
		users, err = ss.User().GetTeamGroupUsers(team.Id)
		require.NoError(t, err)
		require.NotNil(t, users)
		require.Len(t, users, n)
	}

	// team not group constrained returns users
	requireNUsers(1)

	// update team to be group-constrained
	team.GroupConstrained = model.NewBool(true)
	team, err = ss.Team().Update(team)
	require.NoError(t, err)

	// still returns user (being group-constrained has no effect)
	requireNUsers(1)

	// associate other group to team
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    groupB.Id,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
	})
	require.NoError(t, err)

	// should return users from all groups
	// 2 users now that both groups have been associated to the team
	requireNUsers(2)

	// add team membership of allowed user
	_, nErr = ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: userGroupA.Id,
	}, 999)
	require.NoError(t, nErr)

	// ensure allowed member still returned by query
	requireNUsers(2)

	// delete team membership of allowed user
	err = ss.Team().RemoveMember(team.Id, userGroupA.Id)
	require.NoError(t, err)

	// ensure removed allowed member still returned by query
	requireNUsers(2)
}

func testUserStoreGetChannelGroupUsers(t *testing.T, ss store.Store) {
	// create channel
	id := model.NewId()
	channel, nErr := ss.Channel().Save(&model.Channel{
		DisplayName: "dn_" + id,
		Name:        "n-" + id,
		Type:        model.ChannelTypePrivate,
	}, 999)
	require.NoError(t, nErr)
	require.NotNil(t, channel)

	// create users
	var testUsers []*model.User
	for i := 0; i < 3; i++ {
		id = model.NewId()
		user, userErr := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
		})
		require.NoError(t, userErr)
		require.NotNil(t, user)
		testUsers = append(testUsers, user)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()
	}
	require.Len(t, testUsers, 3, "testUsers length doesn't meet required length")
	userGroupA, userGroupB, userNoGroup := testUsers[0], testUsers[1], testUsers[2]

	// add non-group-member to the channel (to prove that the query isn't just returning all members)
	_, err := ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      userNoGroup.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	// create groups
	var testGroups []*model.Group
	for i := 0; i < 2; i++ {
		id = model.NewId()
		var group *model.Group
		group, err = ss.Group().Create(&model.Group{
			Name:        model.NewString("n_" + id),
			DisplayName: "dn_" + id,
			Source:      model.GroupSourceLdap,
			RemoteId:    model.NewString("ri_" + id),
		})
		require.NoError(t, err)
		require.NotNil(t, group)
		testGroups = append(testGroups, group)
	}
	require.Len(t, testGroups, 2, "testGroups length doesn't meet required length")
	groupA, groupB := testGroups[0], testGroups[1]

	// add members to groups
	_, err = ss.Group().UpsertMember(groupA.Id, userGroupA.Id)
	require.NoError(t, err)
	_, err = ss.Group().UpsertMember(groupB.Id, userGroupB.Id)
	require.NoError(t, err)

	// association one group to channel
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    groupA.Id,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
	})
	require.NoError(t, err)

	var users []*model.User

	requireNUsers := func(n int) {
		users, err = ss.User().GetChannelGroupUsers(channel.Id)
		require.NoError(t, err)
		require.NotNil(t, users)
		require.Len(t, users, n)
	}

	// channel not group constrained returns users
	requireNUsers(1)

	// update team to be group-constrained
	channel.GroupConstrained = model.NewBool(true)
	_, nErr = ss.Channel().Update(channel)
	require.NoError(t, nErr)

	// still returns user (being group-constrained has no effect)
	requireNUsers(1)

	// associate other group to team
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    groupB.Id,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
	})
	require.NoError(t, err)

	// should return users from all groups
	// 2 users now that both groups have been associated to the team
	requireNUsers(2)

	// add team membership of allowed user
	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      userGroupA.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	// ensure allowed member still returned by query
	requireNUsers(2)

	// delete team membership of allowed user
	err = ss.Channel().RemoveMember(channel.Id, userGroupA.Id)
	require.NoError(t, err)

	// ensure removed allowed member still returned by query
	requireNUsers(2)
}

func testUserStorePromoteGuestToUser(t *testing.T, ss store.Store) {
	// create users
	t.Run("Must do nothing with regular user", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_user",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: true, SchemeUser: false}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user.Id, SchemeGuest: true, SchemeUser: false, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		err = ss.User().PromoteGuestToUser(user.Id)
		require.NoError(t, err)
		updatedUser, err := ss.User().Get(context.Background(), user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_user", updatedUser.Roles)
		require.True(t, user.UpdateAt < updatedUser.UpdateAt)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, user.Id)
		require.NoError(t, nErr)
		require.False(t, updatedTeamMember.SchemeGuest)
		require.True(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user.Id)
		require.NoError(t, nErr)
		require.False(t, updatedChannelMember.SchemeGuest)
		require.True(t, updatedChannelMember.SchemeUser)
	})

	t.Run("Must do nothing with admin user", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_user system_admin",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: true, SchemeUser: false}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user.Id, SchemeGuest: true, SchemeUser: false, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		err = ss.User().PromoteGuestToUser(user.Id)
		require.NoError(t, err)
		updatedUser, err := ss.User().Get(context.Background(), user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_user system_admin", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, user.Id)
		require.NoError(t, nErr)
		require.False(t, updatedTeamMember.SchemeGuest)
		require.True(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user.Id)
		require.NoError(t, nErr)
		require.False(t, updatedChannelMember.SchemeGuest)
		require.True(t, updatedChannelMember.SchemeUser)
	})

	t.Run("Must work with guest user without teams or channels", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_guest",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		err = ss.User().PromoteGuestToUser(user.Id)
		require.NoError(t, err)
		updatedUser, err := ss.User().Get(context.Background(), user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_user", updatedUser.Roles)
	})

	t.Run("Must work with guest user with teams but no channels", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_guest",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: true, SchemeUser: false}, 999)
		require.NoError(t, nErr)

		err = ss.User().PromoteGuestToUser(user.Id)
		require.NoError(t, err)
		updatedUser, err := ss.User().Get(context.Background(), user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_user", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, user.Id)
		require.NoError(t, nErr)
		require.False(t, updatedTeamMember.SchemeGuest)
		require.True(t, updatedTeamMember.SchemeUser)
	})

	t.Run("Must work with guest user with teams and channels", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_guest",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: true, SchemeUser: false}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user.Id, SchemeGuest: true, SchemeUser: false, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		err = ss.User().PromoteGuestToUser(user.Id)
		require.NoError(t, err)
		updatedUser, err := ss.User().Get(context.Background(), user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_user", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, user.Id)
		require.NoError(t, nErr)
		require.False(t, updatedTeamMember.SchemeGuest)
		require.True(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user.Id)
		require.NoError(t, nErr)
		require.False(t, updatedChannelMember.SchemeGuest)
		require.True(t, updatedChannelMember.SchemeUser)
	})

	t.Run("Must work with guest user with teams and channels and custom role", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_guest custom_role",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: true, SchemeUser: false}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user.Id, SchemeGuest: true, SchemeUser: false, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		err = ss.User().PromoteGuestToUser(user.Id)
		require.NoError(t, err)
		updatedUser, err := ss.User().Get(context.Background(), user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_user custom_role", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, user.Id)
		require.NoError(t, nErr)
		require.False(t, updatedTeamMember.SchemeGuest)
		require.True(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user.Id)
		require.NoError(t, nErr)
		require.False(t, updatedChannelMember.SchemeGuest)
		require.True(t, updatedChannelMember.SchemeUser)
	})

	t.Run("Must no change any other user guest role", func(t *testing.T) {
		id := model.NewId()
		user1, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_guest",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user1.Id)) }()

		teamId1 := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: user1.Id, SchemeGuest: true, SchemeUser: false}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId1,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)

		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user1.Id, SchemeGuest: true, SchemeUser: false, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		id = model.NewId()
		user2, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_guest",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user2.Id)) }()

		teamId2 := model.NewId()
		_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId2, UserId: user2.Id, SchemeGuest: true, SchemeUser: false}, 999)
		require.NoError(t, nErr)

		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user2.Id, SchemeGuest: true, SchemeUser: false, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		err = ss.User().PromoteGuestToUser(user1.Id)
		require.NoError(t, err)
		updatedUser, err := ss.User().Get(context.Background(), user1.Id)
		require.NoError(t, err)
		require.Equal(t, "system_user", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId1, user1.Id)
		require.NoError(t, nErr)
		require.False(t, updatedTeamMember.SchemeGuest)
		require.True(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user1.Id)
		require.NoError(t, nErr)
		require.False(t, updatedChannelMember.SchemeGuest)
		require.True(t, updatedChannelMember.SchemeUser)

		notUpdatedUser, err := ss.User().Get(context.Background(), user2.Id)
		require.NoError(t, err)
		require.Equal(t, "system_guest", notUpdatedUser.Roles)

		notUpdatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId2, user2.Id)
		require.NoError(t, nErr)
		require.True(t, notUpdatedTeamMember.SchemeGuest)
		require.False(t, notUpdatedTeamMember.SchemeUser)

		notUpdatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user2.Id)
		require.NoError(t, nErr)
		require.True(t, notUpdatedChannelMember.SchemeGuest)
		require.False(t, notUpdatedChannelMember.SchemeUser)
	})
}

func testUserStoreDemoteUserToGuest(t *testing.T, ss store.Store) {
	// create users
	t.Run("Must do nothing with guest", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_guest",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: false, SchemeUser: true}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user.Id, SchemeGuest: false, SchemeUser: true, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		updatedUser, err := ss.User().DemoteUserToGuest(user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_guest", updatedUser.Roles)
		require.True(t, user.UpdateAt < updatedUser.UpdateAt)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, updatedUser.Id)
		require.NoError(t, nErr)
		require.True(t, updatedTeamMember.SchemeGuest)
		require.False(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, updatedUser.Id)
		require.NoError(t, nErr)
		require.True(t, updatedChannelMember.SchemeGuest)
		require.False(t, updatedChannelMember.SchemeUser)
	})

	t.Run("Must demote properly an admin user", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_user system_admin",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: true, SchemeUser: false}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user.Id, SchemeGuest: true, SchemeUser: false, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		updatedUser, err := ss.User().DemoteUserToGuest(user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_guest", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, user.Id)
		require.NoError(t, nErr)
		require.True(t, updatedTeamMember.SchemeGuest)
		require.False(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user.Id)
		require.NoError(t, nErr)
		require.True(t, updatedChannelMember.SchemeGuest)
		require.False(t, updatedChannelMember.SchemeUser)
	})

	t.Run("Must work with user without teams or channels", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_user",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		updatedUser, err := ss.User().DemoteUserToGuest(user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_guest", updatedUser.Roles)
	})

	t.Run("Must work with user with teams but no channels", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_user",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: false, SchemeUser: true}, 999)
		require.NoError(t, nErr)

		updatedUser, err := ss.User().DemoteUserToGuest(user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_guest", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, user.Id)
		require.NoError(t, nErr)
		require.True(t, updatedTeamMember.SchemeGuest)
		require.False(t, updatedTeamMember.SchemeUser)
	})

	t.Run("Must work with user with teams and channels", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_user",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: false, SchemeUser: true}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user.Id, SchemeGuest: false, SchemeUser: true, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		updatedUser, err := ss.User().DemoteUserToGuest(user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_guest", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, user.Id)
		require.NoError(t, nErr)
		require.True(t, updatedTeamMember.SchemeGuest)
		require.False(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user.Id)
		require.NoError(t, nErr)
		require.True(t, updatedChannelMember.SchemeGuest)
		require.False(t, updatedChannelMember.SchemeUser)
	})

	t.Run("Must work with user with teams and channels and custom role", func(t *testing.T) {
		id := model.NewId()
		user, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_user custom_role",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user.Id)) }()

		teamId := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: user.Id, SchemeGuest: false, SchemeUser: true}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user.Id, SchemeGuest: false, SchemeUser: true, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		updatedUser, err := ss.User().DemoteUserToGuest(user.Id)
		require.NoError(t, err)
		require.Equal(t, "system_guest custom_role", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId, user.Id)
		require.NoError(t, nErr)
		require.True(t, updatedTeamMember.SchemeGuest)
		require.False(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user.Id)
		require.NoError(t, nErr)
		require.True(t, updatedChannelMember.SchemeGuest)
		require.False(t, updatedChannelMember.SchemeUser)
	})

	t.Run("Must no change any other user role", func(t *testing.T) {
		id := model.NewId()
		user1, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_user",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user1.Id)) }()

		teamId1 := model.NewId()
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId1, UserId: user1.Id, SchemeGuest: false, SchemeUser: true}, 999)
		require.NoError(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId1,
			DisplayName: "Channel name",
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)

		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user1.Id, SchemeGuest: false, SchemeUser: true, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		id = model.NewId()
		user2, err := ss.User().Save(&model.User{
			Email:     id + "@test.com",
			Username:  "un_" + id,
			Nickname:  "nn_" + id,
			FirstName: "f_" + id,
			LastName:  "l_" + id,
			Password:  "Password1",
			Roles:     "system_user",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(user2.Id)) }()

		teamId2 := model.NewId()
		_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId2, UserId: user2.Id, SchemeGuest: false, SchemeUser: true}, 999)
		require.NoError(t, nErr)

		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{ChannelId: channel.Id, UserId: user2.Id, SchemeGuest: false, SchemeUser: true, NotifyProps: model.GetDefaultChannelNotifyProps()})
		require.NoError(t, nErr)

		updatedUser, err := ss.User().DemoteUserToGuest(user1.Id)
		require.NoError(t, err)
		require.Equal(t, "system_guest", updatedUser.Roles)

		updatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId1, user1.Id)
		require.NoError(t, nErr)
		require.True(t, updatedTeamMember.SchemeGuest)
		require.False(t, updatedTeamMember.SchemeUser)

		updatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user1.Id)
		require.NoError(t, nErr)
		require.True(t, updatedChannelMember.SchemeGuest)
		require.False(t, updatedChannelMember.SchemeUser)

		notUpdatedUser, err := ss.User().Get(context.Background(), user2.Id)
		require.NoError(t, err)
		require.Equal(t, "system_user", notUpdatedUser.Roles)

		notUpdatedTeamMember, nErr := ss.Team().GetMember(context.Background(), teamId2, user2.Id)
		require.NoError(t, nErr)
		require.False(t, notUpdatedTeamMember.SchemeGuest)
		require.True(t, notUpdatedTeamMember.SchemeUser)

		notUpdatedChannelMember, nErr := ss.Channel().GetMember(context.Background(), channel.Id, user2.Id)
		require.NoError(t, nErr)
		require.False(t, notUpdatedChannelMember.SchemeGuest)
		require.True(t, notUpdatedChannelMember.SchemeUser)
	})
}

func testDeactivateGuests(t *testing.T, ss store.Store) {
	// create users
	t.Run("Must disable all guests and no regular user or already deactivated users", func(t *testing.T) {
		guest1Random := model.NewId()
		guest1, err := ss.User().Save(&model.User{
			Email:     guest1Random + "@test.com",
			Username:  "un_" + guest1Random,
			Nickname:  "nn_" + guest1Random,
			FirstName: "f_" + guest1Random,
			LastName:  "l_" + guest1Random,
			Password:  "Password1",
			Roles:     "system_guest",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(guest1.Id)) }()

		guest2Random := model.NewId()
		guest2, err := ss.User().Save(&model.User{
			Email:     guest2Random + "@test.com",
			Username:  "un_" + guest2Random,
			Nickname:  "nn_" + guest2Random,
			FirstName: "f_" + guest2Random,
			LastName:  "l_" + guest2Random,
			Password:  "Password1",
			Roles:     "system_guest",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(guest2.Id)) }()

		guest3Random := model.NewId()
		guest3, err := ss.User().Save(&model.User{
			Email:     guest3Random + "@test.com",
			Username:  "un_" + guest3Random,
			Nickname:  "nn_" + guest3Random,
			FirstName: "f_" + guest3Random,
			LastName:  "l_" + guest3Random,
			Password:  "Password1",
			Roles:     "system_guest",
			DeleteAt:  10,
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(guest3.Id)) }()

		regularUserRandom := model.NewId()
		regularUser, err := ss.User().Save(&model.User{
			Email:     regularUserRandom + "@test.com",
			Username:  "un_" + regularUserRandom,
			Nickname:  "nn_" + regularUserRandom,
			FirstName: "f_" + regularUserRandom,
			LastName:  "l_" + regularUserRandom,
			Password:  "Password1",
			Roles:     "system_user",
		})
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(regularUser.Id)) }()

		ids, err := ss.User().DeactivateGuests()
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{guest1.Id, guest2.Id}, ids)

		u, err := ss.User().Get(context.Background(), guest1.Id)
		require.NoError(t, err)
		assert.NotEqual(t, u.DeleteAt, int64(0))

		u, err = ss.User().Get(context.Background(), guest2.Id)
		require.NoError(t, err)
		assert.NotEqual(t, u.DeleteAt, int64(0))

		u, err = ss.User().Get(context.Background(), guest3.Id)
		require.NoError(t, err)
		assert.Equal(t, u.DeleteAt, int64(10))

		u, err = ss.User().Get(context.Background(), regularUser.Id)
		require.NoError(t, err)
		assert.Equal(t, u.DeleteAt, int64(0))
	})
}

func testUserStoreResetLastPictureUpdate(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(u1)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	err = ss.User().UpdateLastPictureUpdate(u1.Id)
	require.NoError(t, err)

	user, err := ss.User().Get(context.Background(), u1.Id)
	require.NoError(t, err)

	assert.NotZero(t, user.LastPictureUpdate)
	assert.NotZero(t, user.UpdateAt)

	// Ensure update at timestamp changes
	time.Sleep(time.Millisecond)

	err = ss.User().ResetLastPictureUpdate(u1.Id)
	require.NoError(t, err)

	ss.User().InvalidateProfileCacheForUser(u1.Id)

	user2, err := ss.User().Get(context.Background(), u1.Id)
	require.NoError(t, err)

	assert.True(t, user2.UpdateAt > user.UpdateAt)
	assert.Zero(t, user2.LastPictureUpdate)
}

func testGetKnownUsers(t *testing.T, ss store.Store) {
	teamId := model.NewId()

	u1, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u1" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u1.Id}, -1)
	require.NoError(t, nErr)

	u2, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u2" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u2.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u2.Id}, -1)
	require.NoError(t, nErr)

	u3, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u3" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u3.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u3.Id}, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Bot().Save(&model.Bot{
		UserId:   u3.Id,
		Username: u3.Username,
		OwnerId:  u1.Id,
	})
	require.NoError(t, nErr)
	u3.IsBot = true

	defer func() { require.NoError(t, ss.Bot().PermanentDelete(u3.Id)) }()

	u4, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "u4" + model.NewId(),
	})
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u4.Id)) }()
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: teamId, UserId: u4.Id}, -1)
	require.NoError(t, nErr)

	ch1 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in channel",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	c1, nErr := ss.Channel().Save(ch1, -1)
	require.NoError(t, nErr)

	ch2 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in private",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	c2, nErr := ss.Channel().Save(ch2, -1)
	require.NoError(t, nErr)

	ch3 := &model.Channel{
		TeamId:      teamId,
		DisplayName: "Profiles in private",
		Name:        "profiles-" + model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	c3, nErr := ss.Channel().Save(ch3, -1)
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c1.Id,
		UserId:      u2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c2.Id,
		UserId:      u1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   c3.Id,
		UserId:      u4.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	t.Run("get know users sharing no channels", func(t *testing.T) {
		userIds, err := ss.User().GetKnownUsers(u4.Id)
		require.NoError(t, err)
		assert.Empty(t, userIds)
	})

	t.Run("get know users sharing one channel", func(t *testing.T) {
		userIds, err := ss.User().GetKnownUsers(u3.Id)
		require.NoError(t, err)
		assert.Len(t, userIds, 1)
		assert.Equal(t, userIds[0], u1.Id)
	})

	t.Run("get know users sharing multiple channels", func(t *testing.T) {
		userIds, err := ss.User().GetKnownUsers(u1.Id)
		require.NoError(t, err)
		assert.Len(t, userIds, 2)
		assert.ElementsMatch(t, userIds, []string{u2.Id, u3.Id})
	})
}

func testIsEmpty(t *testing.T, ss store.Store) {
	ok, err := ss.User().IsEmpty(false)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = ss.User().IsEmpty(true)
	require.NoError(t, err)
	require.True(t, ok)

	u := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}

	u, err = ss.User().Save(u)
	require.NoError(t, err)

	ok, err = ss.User().IsEmpty(false)
	require.NoError(t, err)
	require.False(t, ok)

	ok, err = ss.User().IsEmpty(true)
	require.NoError(t, err)
	require.False(t, ok)

	b := &model.Bot{
		UserId:   u.Id,
		OwnerId:  model.NewId(),
		Username: model.NewId(),
	}

	_, err = ss.Bot().Save(b)
	require.NoError(t, err)

	ok, err = ss.User().IsEmpty(false)
	require.NoError(t, err)
	require.False(t, ok)

	ok, err = ss.User().IsEmpty(true)
	require.NoError(t, err)
	require.True(t, ok)

	err = ss.User().PermanentDelete(u.Id)
	require.NoError(t, err)

	ok, err = ss.User().IsEmpty(false)
	require.NoError(t, err)
	require.True(t, ok)
}

func testGetUsersWithInvalidEmails(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{
		Email:    "ben@invalid.mattermost.com",
		Username: "u1" + model.NewId(),
	})

	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(u1.Id)) }()

	users, err := ss.User().GetUsersWithInvalidEmails(0, 50, "localhost,simulator.amazonses.com")
	require.NoError(t, err)
	assert.Len(t, users, 1)
}
