// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"crypto/md5"
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	MISSING_ACCOUNT_ERROR                      = "store.sql_user.missing_account.const"
	MISSING_AUTH_ACCOUNT_ERROR                 = "store.sql_user.get_by_auth.missing_account.app_error"
	PROFILES_IN_CHANNEL_CACHE_SIZE             = 5000
	PROFILES_IN_CHANNEL_CACHE_SEC              = 900 // 15 mins
	PROFILE_BY_IDS_CACHE_SIZE                  = 20000
	PROFILE_BY_IDS_CACHE_SEC                   = 900 // 15 mins
	USER_SEARCH_OPTION_NAMES_ONLY              = "names_only"
	USER_SEARCH_OPTION_NAMES_ONLY_NO_FULL_NAME = "names_only_no_full_name"
	USER_SEARCH_OPTION_ALL_NO_FULL_NAME        = "all_no_full_name"
	USER_SEARCH_OPTION_ALLOW_INACTIVE          = "allow_inactive"
	USER_SEARCH_TYPE_NAMES_NO_FULL_NAME        = "Username, Nickname"
	USER_SEARCH_TYPE_NAMES                     = "Username, FirstName, LastName, Nickname"
	USER_SEARCH_TYPE_ALL_NO_FULL_NAME          = "Username, Nickname, Email"
	USER_SEARCH_TYPE_ALL                       = "Username, FirstName, LastName, Nickname, Email"
)

type SqlUserStore struct {
	*SqlStore
}

var profilesInChannelCache *utils.Cache = utils.NewLru(PROFILES_IN_CHANNEL_CACHE_SIZE)
var profileByIdsCache *utils.Cache = utils.NewLru(PROFILE_BY_IDS_CACHE_SIZE)

func ClearUserCaches() {
	profilesInChannelCache.Purge()
	profileByIdsCache.Purge()
}

func (us SqlUserStore) InvalidatProfileCacheForUser(userId string) {
	profileByIdsCache.Remove(userId)
}

func NewSqlUserStore(sqlStore *SqlStore) UserStore {
	us := &SqlUserStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.User{}, "Users").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Username").SetMaxSize(64).SetUnique(true)
		table.ColMap("Password").SetMaxSize(128)
		table.ColMap("AuthData").SetMaxSize(128).SetUnique(true)
		table.ColMap("AuthService").SetMaxSize(32)
		table.ColMap("Email").SetMaxSize(128).SetUnique(true)
		table.ColMap("Nickname").SetMaxSize(64)
		table.ColMap("FirstName").SetMaxSize(64)
		table.ColMap("LastName").SetMaxSize(64)
		table.ColMap("Roles").SetMaxSize(64)
		table.ColMap("Props").SetMaxSize(4000)
		table.ColMap("NotifyProps").SetMaxSize(2000)
		table.ColMap("Locale").SetMaxSize(5)
		table.ColMap("MfaSecret").SetMaxSize(128)
		table.ColMap("Position").SetMaxSize(64)
	}

	return us
}

func (us SqlUserStore) CreateIndexesIfNotExists() {
	us.CreateIndexIfNotExists("idx_users_email", "Users", "Email")
	us.CreateIndexIfNotExists("idx_users_update_at", "Users", "UpdateAt")
	us.CreateIndexIfNotExists("idx_users_create_at", "Users", "CreateAt")
	us.CreateIndexIfNotExists("idx_users_delete_at", "Users", "DeleteAt")

	us.CreateFullTextIndexIfNotExists("idx_users_all_txt", "Users", USER_SEARCH_TYPE_ALL)
	us.CreateFullTextIndexIfNotExists("idx_users_all_no_full_name_txt", "Users", USER_SEARCH_TYPE_ALL_NO_FULL_NAME)
	us.CreateFullTextIndexIfNotExists("idx_users_names_txt", "Users", USER_SEARCH_TYPE_NAMES)
	us.CreateFullTextIndexIfNotExists("idx_users_names_no_full_name_txt", "Users", USER_SEARCH_TYPE_NAMES_NO_FULL_NAME)
}

func (us SqlUserStore) Save(user *model.User) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if len(user.Id) > 0 {
			result.Err = model.NewLocAppError("SqlUserStore.Save", "store.sql_user.save.existing.app_error", nil, "user_id="+user.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		user.PreSave()
		if result.Err = user.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := us.GetMaster().Insert(user); err != nil {
			if IsUniqueConstraintError(err.Error(), []string{"Email", "users_email_key", "idx_users_email_unique"}) {
				result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.email_exists.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
			} else if IsUniqueConstraintError(err.Error(), []string{"Username", "users_username_key", "idx_users_username_unique"}) {
				result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.username_exists.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
			} else {
				result.Err = model.NewLocAppError("SqlUserStore.Save", "store.sql_user.save.app_error", nil, "user_id="+user.Id+", "+err.Error())
			}
		} else {
			result.Data = user
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) Update(user *model.User, trustedUpdateData bool) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		user.PreUpdate()

		if result.Err = user.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if oldUserResult, err := us.GetMaster().Get(model.User{}, user.Id); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.Update", "store.sql_user.update.finding.app_error", nil, "user_id="+user.Id+", "+err.Error())
		} else if oldUserResult == nil {
			result.Err = model.NewLocAppError("SqlUserStore.Update", "store.sql_user.update.find.app_error", nil, "user_id="+user.Id)
		} else {
			oldUser := oldUserResult.(*model.User)
			user.CreateAt = oldUser.CreateAt
			user.AuthData = oldUser.AuthData
			user.AuthService = oldUser.AuthService
			user.Password = oldUser.Password
			user.LastPasswordUpdate = oldUser.LastPasswordUpdate
			user.LastPictureUpdate = oldUser.LastPictureUpdate
			user.EmailVerified = oldUser.EmailVerified
			user.FailedAttempts = oldUser.FailedAttempts
			user.MfaSecret = oldUser.MfaSecret
			user.MfaActive = oldUser.MfaActive

			if !trustedUpdateData {
				user.Roles = oldUser.Roles
				user.DeleteAt = oldUser.DeleteAt
			}

			if user.IsOAuthUser() {
				user.Email = oldUser.Email
			} else if user.IsLDAPUser() && !trustedUpdateData {
				if user.Username != oldUser.Username ||
					user.Email != oldUser.Email {
					result.Err = model.NewLocAppError("SqlUserStore.Update", "store.sql_user.update.can_not_change_ldap.app_error", nil, "user_id="+user.Id)
					storeChannel <- result
					close(storeChannel)
					return
				}
			} else if user.Email != oldUser.Email {
				user.EmailVerified = false
			}

			if user.Username != oldUser.Username {
				user.UpdateMentionKeysFromUsername(oldUser.Username)
			}

			if count, err := us.GetMaster().Update(user); err != nil {
				if IsUniqueConstraintError(err.Error(), []string{"Email", "users_email_key", "idx_users_email_unique"}) {
					result.Err = model.NewLocAppError("SqlUserStore.Update", "store.sql_user.update.email_taken.app_error", nil, "user_id="+user.Id+", "+err.Error())
				} else if IsUniqueConstraintError(err.Error(), []string{"Username", "users_username_key", "idx_users_username_unique"}) {
					result.Err = model.NewLocAppError("SqlUserStore.Update", "store.sql_user.update.username_taken.app_error", nil, "user_id="+user.Id+", "+err.Error())
				} else {
					result.Err = model.NewLocAppError("SqlUserStore.Update", "store.sql_user.update.updating.app_error", nil, "user_id="+user.Id+", "+err.Error())
				}
			} else if count != 1 {
				result.Err = model.NewLocAppError("SqlUserStore.Update", "store.sql_user.update.app_error", nil, fmt.Sprintf("user_id=%v, count=%v", user.Id, count))
			} else {
				result.Data = [2]*model.User{user, oldUser}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateLastPictureUpdate(userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		curTime := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastPictureUpdate = :Time, UpdateAt = :Time WHERE Id = :UserId", map[string]interface{}{"Time": curTime, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateUpdateAt", "store.sql_user.update_last_picture_update.app_error", nil, "user_id="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateUpdateAt(userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		curTime := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET UpdateAt = :Time WHERE Id = :UserId", map[string]interface{}{"Time": curTime, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateUpdateAt", "store.sql_user.update_update.app_error", nil, "user_id="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdatePassword(userId, hashedPassword string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		updateAt := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET Password = :Password, LastPasswordUpdate = :LastPasswordUpdate, UpdateAt = :UpdateAt, AuthData = NULL, AuthService = '', EmailVerified = true, FailedAttempts = 0 WHERE Id = :UserId", map[string]interface{}{"Password": hashedPassword, "LastPasswordUpdate": updateAt, "UpdateAt": updateAt, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdatePassword", "store.sql_user.update_password.app_error", nil, "id="+userId+", "+err.Error())
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateFailedPasswordAttempts(userId string, attempts int) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET FailedAttempts = :FailedAttempts WHERE Id = :UserId", map[string]interface{}{"FailedAttempts": attempts, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateFailedPasswordAttempts", "store.sql_user.update_failed_pwd_attempts.app_error", nil, "user_id="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateAuthData(userId string, service string, authData *string, email string, resetMfa bool) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		email = strings.ToLower(email)

		updateAt := model.GetMillis()

		query := `
			UPDATE
			     Users
			SET
			     Password = '',
			     LastPasswordUpdate = :LastPasswordUpdate,
			     UpdateAt = :UpdateAt,
			     FailedAttempts = 0,
			     AuthService = :AuthService,
			     AuthData = :AuthData`

		if len(email) != 0 {
			query += ", Email = :Email"
		}

		if resetMfa {
			query += ", MfaActive = false, MfaSecret = ''"
		}

		query += " WHERE Id = :UserId"

		if _, err := us.GetMaster().Exec(query, map[string]interface{}{"LastPasswordUpdate": updateAt, "UpdateAt": updateAt, "UserId": userId, "AuthService": service, "AuthData": authData, "Email": email}); err != nil {
			if IsUniqueConstraintError(err.Error(), []string{"Email", "users_email_key", "idx_users_email_unique"}) {
				result.Err = model.NewLocAppError("SqlUserStore.UpdateAuthData", "store.sql_user.update_auth_data.email_exists.app_error", map[string]interface{}{"Service": service, "Email": email}, "user_id="+userId+", "+err.Error())
			} else {
				result.Err = model.NewLocAppError("SqlUserStore.UpdateAuthData", "store.sql_user.update_auth_data.app_error", nil, "id="+userId+", "+err.Error())
			}
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateMfaSecret(userId, secret string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		updateAt := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET MfaSecret = :Secret, UpdateAt = :UpdateAt WHERE Id = :UserId", map[string]interface{}{"Secret": secret, "UpdateAt": updateAt, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateMfaSecret", "store.sql_user.update_mfa_secret.app_error", nil, "id="+userId+", "+err.Error())
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateMfaActive(userId string, active bool) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		updateAt := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET MfaActive = :Active, UpdateAt = :UpdateAt WHERE Id = :UserId", map[string]interface{}{"Active": active, "UpdateAt": updateAt, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateMfaActive", "store.sql_user.update_mfa_active.app_error", nil, "id="+userId+", "+err.Error())
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) Get(id string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if obj, err := us.GetReplica().Get(model.User{}, id); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.Get", "store.sql_user.get.app_error", nil, "user_id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewLocAppError("SqlUserStore.Get", MISSING_ACCOUNT_ERROR, nil, "user_id="+id)
			result.Err.StatusCode = http.StatusNotFound
		} else {
			result.Data = obj.(*model.User)
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (us SqlUserStore) GetAll() StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var data []*model.User
		if _, err := us.GetReplica().Select(&data, "SELECT * FROM Users"); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetAll", "store.sql_user.get.app_error", nil, err.Error())
		}

		result.Data = data

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (s SqlUserStore) GetEtagForDirectProfiles(userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var ids []string
		_, err := s.GetReplica().Select(ids, `
			SELECT
			    Id
			FROM
			    Users
			WHERE
			    Id IN (SELECT DISTINCT
			            UserId
			        FROM
			            ChannelMembers
			        WHERE
			            ChannelMembers.UserId != :UserId
			                AND ChannelMembers.ChannelId IN (SELECT 
			                    Channels.Id
			                FROM
			                    Channels,
			                    ChannelMembers
			                WHERE
			                    Channels.Type = 'D'
			                        AND Channels.Id = ChannelMembers.ChannelId
			                        AND ChannelMembers.UserId = :UserId))
			        OR Id IN (SELECT
			            Name
			        FROM
			            Preferences
			        WHERE
			            UserId = :UserId
			                AND Category = 'direct_channel_show')
			ORDER BY UpdateAt DESC
        `, map[string]interface{}{"UserId": userId})

		if err != nil || len(ids) == 0 {
			result.Data = fmt.Sprintf("%v.%v.0.%v.%v", model.CurrentVersion, model.GetMillis(), utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress)
		} else {
			allIds := strings.Join(ids, "")
			result.Data = fmt.Sprintf("%v.%x.%v.%v.%v", model.CurrentVersion, md5.Sum([]byte(allIds)), len(ids), utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlUserStore) GetEtagForAllProfiles() StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		updateAt, err := s.GetReplica().SelectInt("SELECT UpdateAt FROM Users ORDER BY UpdateAt DESC LIMIT 1")
		if err != nil {
			result.Data = fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, model.GetMillis(), utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress)
		} else {
			result.Data = fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, updateAt, utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetAllProfiles(offset int, limit int) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users ORDER BY Username ASC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetAllProfiles", "store.sql_user.get_profiles.app_error", nil, err.Error())
		} else {

			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Password = ""
				u.AuthData = new(string)
				*u.AuthData = ""
				userMap[u.Id] = u
			}

			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlUserStore) GetEtagForProfiles(teamId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		updateAt, err := s.GetReplica().SelectInt("SELECT UpdateAt FROM Users, TeamMembers WHERE TeamMembers.TeamId = :TeamId AND Users.Id = TeamMembers.UserId ORDER BY UpdateAt DESC LIMIT 1", map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Data = fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, model.GetMillis(), utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress)
		} else {
			result.Data = fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, updateAt, utils.Cfg.PrivacySettings.ShowFullName, utils.Cfg.PrivacySettings.ShowEmailAddress)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetProfiles(teamId string, offset int, limit int) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT Users.* FROM Users, TeamMembers WHERE TeamMembers.TeamId = :TeamId AND Users.Id = TeamMembers.UserId AND TeamMembers.DeleteAt = 0 ORDER BY Users.Username ASC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"TeamId": teamId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetProfiles", "store.sql_user.get_profiles.app_error", nil, err.Error())
		} else {

			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Password = ""
				u.AuthData = new(string)
				*u.AuthData = ""
				userMap[u.Id] = u
			}

			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) InvalidateProfilesInChannelCacheByUser(userId string) {
	keys := profilesInChannelCache.Keys()

	for _, key := range keys {
		if cacheItem, ok := profilesInChannelCache.Get(key); ok {
			userMap := cacheItem.(map[string]*model.User)
			if _, userInCache := userMap[userId]; userInCache {
				profilesInChannelCache.Remove(key)
			}
		}
	}
}

func (us SqlUserStore) InvalidateProfilesInChannelCache(channelId string) {
	profilesInChannelCache.Remove(channelId)
}

func (us SqlUserStore) GetProfilesInChannel(channelId string, offset int, limit int, allowFromCache bool) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}
		metrics := einterfaces.GetMetricsInterface()

		if allowFromCache && offset == -1 && limit == -1 {
			if cacheItem, ok := profilesInChannelCache.Get(channelId); ok {
				if metrics != nil {
					metrics.IncrementMemCacheHitCounter("Profiles in Channel")
				}
				result.Data = cacheItem.(map[string]*model.User)
				storeChannel <- result
				close(storeChannel)
				return
			} else {
				if metrics != nil {
					metrics.IncrementMemCacheMissCounter("Profiles in Channel")
				}
			}
		} else {
			if metrics != nil {
				metrics.IncrementMemCacheMissCounter("Profiles in Channel")
			}
		}

		var users []*model.User

		query := "SELECT Users.* FROM Users, ChannelMembers WHERE ChannelMembers.ChannelId = :ChannelId AND Users.Id = ChannelMembers.UserId AND Users.DeleteAt = 0"

		if limit >= 0 && offset >= 0 {
			query += " ORDER BY Users.Username ASC LIMIT :Limit OFFSET :Offset"
		}

		if _, err := us.GetReplica().Select(&users, query, map[string]interface{}{"ChannelId": channelId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetProfilesInChannel", "store.sql_user.get_profiles.app_error", nil, err.Error())
		} else {

			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Password = ""
				u.AuthData = new(string)
				*u.AuthData = ""
				userMap[u.Id] = u
			}

			result.Data = userMap

			if allowFromCache && offset == -1 && limit == -1 {
				profilesInChannelCache.AddWithExpiresInSecs(channelId, userMap, PROFILES_IN_CHANNEL_CACHE_SEC)
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetProfilesNotInChannel(teamId string, channelId string, offset int, limit int) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, `
            SELECT
                u.*
            FROM Users u
            INNER JOIN TeamMembers tm
                ON tm.UserId = u.Id
                AND tm.TeamId = :TeamId
                AND tm.DeleteAt = 0
            LEFT JOIN ChannelMembers cm
                ON cm.UserId = u.Id
                AND cm.ChannelId = :ChannelId
            WHERE cm.UserId IS NULL
            ORDER BY u.Username ASC
            LIMIT :Limit OFFSET :Offset
            `, map[string]interface{}{"TeamId": teamId, "ChannelId": channelId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetProfilesNotInChannel", "store.sql_user.get_profiles.app_error", nil, err.Error())
		} else {

			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Password = ""
				u.AuthData = new(string)
				*u.AuthData = ""
				userMap[u.Id] = u
			}

			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetProfilesByUsernames(usernames []string, teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*model.User
		props := make(map[string]interface{})
		idQuery := ""

		for index, usernames := range usernames {
			if len(idQuery) > 0 {
				idQuery += ", "
			}

			props["username"+strconv.Itoa(index)] = usernames
			idQuery += ":username" + strconv.Itoa(index)
		}

		props["TeamId"] = teamId

		if _, err := us.GetReplica().Select(&users, `SELECT Users.* FROM Users INNER JOIN TeamMembers ON
			Users.Id = TeamMembers.UserId AND Users.Username IN (`+idQuery+`) AND TeamMembers.TeamId = :TeamId `, props); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetProfilesByUsernames", "store.sql_user.get_profiles.app_error", nil, err.Error())
		} else {
			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Password = ""
				u.AuthData = new(string)
				*u.AuthData = ""
				userMap[u.Id] = u
			}

			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

type UserWithLastActivityAt struct {
	model.User
	LastActivityAt int64
}

func (us SqlUserStore) GetRecentlyActiveUsersForTeam(teamId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*UserWithLastActivityAt

		if _, err := us.GetReplica().Select(&users, `
            SELECT
                u.*,
                s.LastActivityAt
            FROM Users AS u
                INNER JOIN TeamMembers AS t ON u.Id = t.UserId
                INNER JOIN Status AS s ON s.UserId = t.UserId
            WHERE t.TeamId = :TeamId
            ORDER BY s.LastActivityAt DESC
            LIMIT 100
            `, map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetRecentlyActiveUsers", "store.sql_user.get_recently_active_users.app_error", nil, err.Error())
		} else {

			userMap := make(map[string]*model.User)

			for _, userWithLastActivityAt := range users {
				u := userWithLastActivityAt.User
				u.Password = ""
				u.AuthData = new(string)
				*u.AuthData = ""
				u.LastActivityAt = userWithLastActivityAt.LastActivityAt
				userMap[u.Id] = &u
			}

			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetProfileByIds(userIds []string, allowFromCache bool) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}
		metrics := einterfaces.GetMetricsInterface()

		var users []*model.User
		userMap := make(map[string]*model.User)
		props := make(map[string]interface{})
		idQuery := ""
		remainingUserIds := make([]string, 0)

		if allowFromCache {
			for _, userId := range userIds {
				if cacheItem, ok := profileByIdsCache.Get(userId); ok {
					u := cacheItem.(*model.User)
					userMap[u.Id] = u
				} else {
					remainingUserIds = append(remainingUserIds, userId)
				}
			}
			if metrics != nil {
				metrics.AddMemCacheHitCounter("Profile By Ids", float64(len(userMap)))
				metrics.AddMemCacheMissCounter("Profile By Ids", float64(len(remainingUserIds)))
			}
		} else {
			remainingUserIds = userIds
			if metrics != nil {
				metrics.AddMemCacheMissCounter("Profile By Ids", float64(len(remainingUserIds)))
			}
		}

		// If everything came from the cache then just return
		if len(remainingUserIds) == 0 {
			result.Data = userMap
			storeChannel <- result
			close(storeChannel)
			return
		}

		for index, userId := range remainingUserIds {
			if len(idQuery) > 0 {
				idQuery += ", "
			}

			props["userId"+strconv.Itoa(index)] = userId
			idQuery += ":userId" + strconv.Itoa(index)
		}

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE Users.Id IN ("+idQuery+")", props); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetProfileByIds", "store.sql_user.get_profiles.app_error", nil, err.Error())
		} else {

			for _, u := range users {
				u.Password = ""
				u.AuthData = new(string)
				*u.AuthData = ""
				userMap[u.Id] = u
				profileByIdsCache.AddWithExpiresInSecs(u.Id, u, PROFILE_BY_IDS_CACHE_SEC)
			}

			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetSystemAdminProfiles() StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE Roles LIKE :Roles", map[string]interface{}{"Roles": "%system_admin%"}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetSystemAdminProfiles", "store.sql_user.get_sysadmin_profiles.app_error", nil, err.Error())
		} else {

			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Password = ""
				u.AuthData = new(string)
				*u.AuthData = ""
				userMap[u.Id] = u
			}

			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetByEmail(email string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		email = strings.ToLower(email)

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE Email = :Email", map[string]interface{}{"Email": email}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetByEmail", MISSING_ACCOUNT_ERROR, nil, "email="+email+", "+err.Error())
		}

		result.Data = &user

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetByAuth(authData *string, authService string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if authData == nil || *authData == "" {
			result.Err = model.NewLocAppError("SqlUserStore.GetByAuth", MISSING_AUTH_ACCOUNT_ERROR, nil, "authData='', authService="+authService)
			storeChannel <- result
			close(storeChannel)
			return
		}

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE AuthData = :AuthData AND AuthService = :AuthService", map[string]interface{}{"AuthData": authData, "AuthService": authService}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewLocAppError("SqlUserStore.GetByAuth", MISSING_AUTH_ACCOUNT_ERROR, nil, "authData="+*authData+", authService="+authService+", "+err.Error())
			} else {
				result.Err = model.NewLocAppError("SqlUserStore.GetByAuth", "store.sql_user.get_by_auth.other.app_error", nil, "authData="+*authData+", authService="+authService+", "+err.Error())
			}
		}

		result.Data = &user

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetAllUsingAuthService(authService string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}
		var data []*model.User

		if _, err := us.GetReplica().Select(&data, "SELECT * FROM Users WHERE AuthService = :AuthService", map[string]interface{}{"AuthService": authService}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetByAuth", "store.sql_user.get_by_auth.other.app_error", nil, "authService="+authService+", "+err.Error())
		}

		result.Data = data

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetByUsername(username string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE Username = :Username", map[string]interface{}{"Username": username}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetByUsername", "store.sql_user.get_by_username.app_error",
				nil, err.Error())
		}

		result.Data = &user

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetForLogin(loginId string, allowSignInWithUsername, allowSignInWithEmail, ldapEnabled bool) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		params := map[string]interface{}{
			"LoginId":                 loginId,
			"AllowSignInWithUsername": allowSignInWithUsername,
			"AllowSignInWithEmail":    allowSignInWithEmail,
			"LdapEnabled":             ldapEnabled,
		}

		users := []*model.User{}
		if _, err := us.GetReplica().Select(
			&users,
			`SELECT
				*
			FROM
				Users
			WHERE
				(:AllowSignInWithUsername AND Username = :LoginId)
				OR (:AllowSignInWithEmail AND Email = :LoginId)
				OR (:LdapEnabled AND AuthService = '`+model.USER_AUTH_SERVICE_LDAP+`' AND AuthData = :LoginId)`,
			params); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.app_error", nil, err.Error())
		} else if len(users) == 1 {
			result.Data = users[0]
		} else if len(users) > 1 {
			result.Err = model.NewLocAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.multiple_users", nil, "")
		} else {
			result.Err = model.NewLocAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.app_error", nil, "")
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) VerifyEmail(userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET EmailVerified = true WHERE Id = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.VerifyEmail", "store.sql_user.verify_email.app_error", nil, "userId="+userId+", "+err.Error())
		}

		result.Data = userId

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetTotalUsersCount() StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if count, err := us.GetReplica().SelectInt("SELECT COUNT(Id) FROM Users"); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetTotalUsersCount", "store.sql_user.get_total_users_count.app_error", nil, err.Error())
		} else {
			result.Data = count
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) PermanentDelete(userId string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("DELETE FROM Users WHERE Id = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.PermanentDelete", "store.sql_user.permanent_delete.app_error", nil, "userId="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) AnalyticsUniqueUserCount(teamId string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		query := ""
		if len(teamId) > 0 {
			query = "SELECT COUNT(DISTINCT Users.Email) From Users, TeamMembers WHERE TeamMembers.TeamId = :TeamId AND Users.Id = TeamMembers.UserId AND TeamMembers.DeleteAt = 0 AND Users.DeleteAt = 0"
		} else {
			query = "SELECT COUNT(DISTINCT Email) FROM Users WHERE DeleteAt = 0"
		}

		v, err := us.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.AnalyticsUniqueUserCount", "store.sql_user.analytics_unique_user_count.app_error", nil, err.Error())
		} else {
			result.Data = v
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) AnalyticsActiveCount(timePeriod int64) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		time := model.GetMillis() - timePeriod

		query := "SELECT COUNT(*) FROM Status WHERE LastActivityAt > :Time"

		v, err := us.GetReplica().SelectInt(query, map[string]interface{}{"Time": time})
		if err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.AnalyticsDailyActiveUsers", "store.sql_user.analytics_daily_active_users.app_error", nil, err.Error())
		} else {
			result.Data = v
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetUnreadCount(userId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if count, err := us.GetReplica().SelectInt("SELECT SUM(CASE WHEN c.Type = 'D' THEN (c.TotalMsgCount - cm.MsgCount) ELSE cm.MentionCount END) FROM Channels c INNER JOIN ChannelMembers cm ON cm.ChannelId = c.Id AND cm.UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetMentionCount", "store.sql_user.get_unread_count.app_error", nil, err.Error())
		} else {
			result.Data = count
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetUnreadCountForChannel(userId string, channelId string) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		if count, err := us.GetReplica().SelectInt("SELECT SUM(CASE WHEN c.Type = 'D' THEN (c.TotalMsgCount - cm.MsgCount) ELSE cm.MentionCount END) FROM Channels c INNER JOIN ChannelMembers cm ON c.Id = :ChannelId AND cm.ChannelId = :ChannelId AND cm.UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetMentionCountForChannel", "store.sql_user.get_unread_count_for_channel.app_error", nil, err.Error())
		} else {
			result.Data = count
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) Search(teamId string, term string, options map[string]bool) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		searchQuery := ""

		if teamId == "" {

			// Id != '' is added because both SEARCH_CLAUSE and INACTIVE_CLAUSE start with an AND
			searchQuery = `
			SELECT
				*
			FROM
				Users
			WHERE
				Id != ''
				SEARCH_CLAUSE
				INACTIVE_CLAUSE
				ORDER BY Username ASC
			LIMIT 100`
		} else {
			searchQuery = `
			SELECT
				Users.*
			FROM
				Users, TeamMembers
			WHERE
				TeamMembers.TeamId = :TeamId
				AND Users.Id = TeamMembers.UserId
				AND TeamMembers.DeleteAt = 0
				SEARCH_CLAUSE
				INACTIVE_CLAUSE
				ORDER BY Users.Username ASC
			LIMIT 100`
		}

		storeChannel <- us.performSearch(searchQuery, term, options, map[string]interface{}{"TeamId": teamId})
		close(storeChannel)

	}()

	return storeChannel
}

func (us SqlUserStore) SearchNotInChannel(teamId string, channelId string, term string, options map[string]bool) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		searchQuery := ""
		if teamId == "" {
			searchQuery = `
			SELECT
				Users.*
			FROM Users
			LEFT JOIN ChannelMembers cm
				ON cm.UserId = Users.Id
				AND cm.ChannelId = :ChannelId
			WHERE
				cm.UserId IS NULL
				SEARCH_CLAUSE
				INACTIVE_CLAUSE
			ORDER BY Users.Username ASC
			LIMIT 100`
		} else {
			searchQuery = `
			SELECT
				Users.*
			FROM Users
			INNER JOIN TeamMembers tm
				ON tm.UserId = Users.Id
				AND tm.TeamId = :TeamId
				AND tm.DeleteAt = 0
			LEFT JOIN ChannelMembers cm
				ON cm.UserId = Users.Id
				AND cm.ChannelId = :ChannelId
			WHERE
				cm.UserId IS NULL
				SEARCH_CLAUSE
				INACTIVE_CLAUSE
			ORDER BY Users.Username ASC
			LIMIT 100`
		}

		storeChannel <- us.performSearch(searchQuery, term, options, map[string]interface{}{"TeamId": teamId, "ChannelId": channelId})
		close(storeChannel)

	}()

	return storeChannel
}

func (us SqlUserStore) SearchInChannel(channelId string, term string, options map[string]bool) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		searchQuery := `
        SELECT
            Users.*
        FROM
            Users, ChannelMembers
        WHERE
            ChannelMembers.ChannelId = :ChannelId
            AND ChannelMembers.UserId = Users.Id
            SEARCH_CLAUSE
            INACTIVE_CLAUSE
            ORDER BY Users.Username ASC
        LIMIT 100`

		storeChannel <- us.performSearch(searchQuery, term, options, map[string]interface{}{"ChannelId": channelId})
		close(storeChannel)

	}()

	return storeChannel
}

var specialUserSearchChar = []string{
	"<",
	">",
	"+",
	"-",
	"(",
	")",
	"~",
	":",
	"*",
	"\"",
	"!",
	"@",
}

var postgresSearchChar = []string{
	"(",
	")",
	":",
	"!",
}

func (us SqlUserStore) performSearch(searchQuery string, term string, options map[string]bool, parameters map[string]interface{}) StoreResult {
	result := StoreResult{}

	// Special handling for emails
	originalTerm := term
	postgresUseOriginalTerm := false
	if strings.Contains(term, "@") && strings.Contains(term, ".") {
		if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
			postgresUseOriginalTerm = true
		} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
			lastIndex := strings.LastIndex(term, ".")
			term = term[0:lastIndex]
		}
	}

	// these chars have special meaning and can be treated as spaces
	for _, c := range specialUserSearchChar {
		term = strings.Replace(term, c, " ", -1)
	}

	searchType := USER_SEARCH_TYPE_ALL
	if ok := options[USER_SEARCH_OPTION_NAMES_ONLY]; ok {
		searchType = USER_SEARCH_TYPE_NAMES
	} else if ok = options[USER_SEARCH_OPTION_NAMES_ONLY_NO_FULL_NAME]; ok {
		searchType = USER_SEARCH_TYPE_NAMES_NO_FULL_NAME
	} else if ok = options[USER_SEARCH_OPTION_ALL_NO_FULL_NAME]; ok {
		searchType = USER_SEARCH_TYPE_ALL_NO_FULL_NAME
	}

	if ok := options[USER_SEARCH_OPTION_ALLOW_INACTIVE]; ok {
		searchQuery = strings.Replace(searchQuery, "INACTIVE_CLAUSE", "", 1)
	} else {
		searchQuery = strings.Replace(searchQuery, "INACTIVE_CLAUSE", "AND Users.DeleteAt = 0", 1)
	}

	if term == "" {
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		if postgresUseOriginalTerm {
			term = originalTerm
			// these chars will break the query and must be removed
			for _, c := range postgresSearchChar {
				term = strings.Replace(term, c, "", -1)
			}
		} else {
			splitTerm := strings.Fields(term)
			for i, t := range strings.Fields(term) {
				if i == len(splitTerm)-1 {
					splitTerm[i] = t + ":*"
				} else {
					splitTerm[i] = t + ":* &"
				}
			}

			term = strings.Join(splitTerm, " ")
		}

		searchType = convertMySQLFullTextColumnsToPostgres(searchType)
		searchClause := fmt.Sprintf("AND (%s) @@  to_tsquery('simple', :Term)", searchType)
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", searchClause, 1)
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		splitTerm := strings.Fields(term)
		for i, t := range strings.Fields(term) {
			splitTerm[i] = "+" + t + "*"
		}

		term = strings.Join(splitTerm, " ")

		searchClause := fmt.Sprintf("AND MATCH(%s) AGAINST (:Term IN BOOLEAN MODE)", searchType)
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", searchClause, 1)
	}

	var users []*model.User

	parameters["Term"] = term

	if _, err := us.GetReplica().Select(&users, searchQuery, parameters); err != nil {
		result.Err = model.NewLocAppError("SqlUserStore.Search", "store.sql_user.search.app_error", nil, "term="+term+", "+"search_type="+searchType+", "+err.Error())
	} else {
		for _, u := range users {
			u.Password = ""
			u.AuthData = new(string)
			*u.AuthData = ""
		}

		result.Data = users
	}

	return result
}
