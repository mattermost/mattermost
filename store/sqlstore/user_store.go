// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/gorp"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	PROFILES_IN_CHANNEL_CACHE_SIZE = model.CHANNEL_CACHE_SIZE
	PROFILES_IN_CHANNEL_CACHE_SEC  = 900 // 15 mins
	PROFILE_BY_IDS_CACHE_SIZE      = model.SESSION_CACHE_SIZE
	PROFILE_BY_IDS_CACHE_SEC       = 900 // 15 mins
)

var (
	USER_SEARCH_TYPE_NAMES_NO_FULL_NAME = []string{"Username", "Nickname"}
	USER_SEARCH_TYPE_NAMES              = []string{"Username", "FirstName", "LastName", "Nickname"}
	USER_SEARCH_TYPE_ALL_NO_FULL_NAME   = []string{"Username", "Nickname", "Email"}
	USER_SEARCH_TYPE_ALL                = []string{"Username", "FirstName", "LastName", "Nickname", "Email"}
)

type SqlUserStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

var profilesInChannelCache *utils.Cache = utils.NewLru(PROFILES_IN_CHANNEL_CACHE_SIZE)
var profileByIdsCache *utils.Cache = utils.NewLru(PROFILE_BY_IDS_CACHE_SIZE)

func (us SqlUserStore) ClearCaches() {
	profilesInChannelCache.Purge()
	profileByIdsCache.Purge()

	if us.metrics != nil {
		us.metrics.IncrementMemCacheInvalidationCounter("Profiles in Channel - Purge")
		us.metrics.IncrementMemCacheInvalidationCounter("Profile By Ids - Purge")
	}
}

func (us SqlUserStore) InvalidatProfileCacheForUser(userId string) {
	profileByIdsCache.Remove(userId)

	if us.metrics != nil {
		us.metrics.IncrementMemCacheInvalidationCounter("Profile By Ids - Remove")
	}
}

func NewSqlUserStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.UserStore {
	us := &SqlUserStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

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
		table.ColMap("Roles").SetMaxSize(256)
		table.ColMap("Props").SetMaxSize(4000)
		table.ColMap("NotifyProps").SetMaxSize(2000)
		table.ColMap("Locale").SetMaxSize(5)
		table.ColMap("MfaSecret").SetMaxSize(128)
		table.ColMap("Position").SetMaxSize(128)
		table.ColMap("Timezone").SetMaxSize(256)
	}

	return us
}

func (us SqlUserStore) CreateIndexesIfNotExists() {
	us.CreateIndexIfNotExists("idx_users_email", "Users", "Email")
	us.CreateIndexIfNotExists("idx_users_update_at", "Users", "UpdateAt")
	us.CreateIndexIfNotExists("idx_users_create_at", "Users", "CreateAt")
	us.CreateIndexIfNotExists("idx_users_delete_at", "Users", "DeleteAt")

	if us.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		us.CreateIndexIfNotExists("idx_users_email_lower", "Users", "lower(Email)")
		us.CreateIndexIfNotExists("idx_users_username_lower", "Users", "lower(Username)")
		us.CreateIndexIfNotExists("idx_users_nickname_lower", "Users", "lower(Nickname)")
		us.CreateIndexIfNotExists("idx_users_firstname_lower", "Users", "lower(FirstName)")
		us.CreateIndexIfNotExists("idx_users_lastname_lower", "Users", "lower(LastName)")
	}

	us.CreateFullTextIndexIfNotExists("idx_users_all_txt", "Users", strings.Join(USER_SEARCH_TYPE_ALL, ", "))
	us.CreateFullTextIndexIfNotExists("idx_users_all_no_full_name_txt", "Users", strings.Join(USER_SEARCH_TYPE_ALL_NO_FULL_NAME, ", "))
	us.CreateFullTextIndexIfNotExists("idx_users_names_txt", "Users", strings.Join(USER_SEARCH_TYPE_NAMES, ", "))
	us.CreateFullTextIndexIfNotExists("idx_users_names_no_full_name_txt", "Users", strings.Join(USER_SEARCH_TYPE_NAMES_NO_FULL_NAME, ", "))
}

func (us SqlUserStore) Save(user *model.User) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(user.Id) > 0 {
			result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.existing.app_error", nil, "user_id="+user.Id, http.StatusBadRequest)
			return
		}

		user.PreSave()
		if result.Err = user.IsValid(); result.Err != nil {
			return
		}

		if err := us.GetMaster().Insert(user); err != nil {
			if IsUniqueConstraintError(err, []string{"Email", "users_email_key", "idx_users_email_unique"}) {
				result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.email_exists.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
			} else if IsUniqueConstraintError(err, []string{"Username", "users_username_key", "idx_users_username_unique"}) {
				result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.username_exists.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
			} else {
				result.Err = model.NewAppError("SqlUserStore.Save", "store.sql_user.save.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = user
		}
	})
}

func (us SqlUserStore) Update(user *model.User, trustedUpdateData bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		user.PreUpdate()

		if result.Err = user.IsValid(); result.Err != nil {
			return
		}

		if oldUserResult, err := us.GetMaster().Get(model.User{}, user.Id); err != nil {
			result.Err = model.NewAppError("SqlUserStore.Update", "store.sql_user.update.finding.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusInternalServerError)
		} else if oldUserResult == nil {
			result.Err = model.NewAppError("SqlUserStore.Update", "store.sql_user.update.find.app_error", nil, "user_id="+user.Id, http.StatusBadRequest)
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
				if !trustedUpdateData {
					user.Email = oldUser.Email
				}
			} else if user.IsLDAPUser() && !trustedUpdateData {
				if user.Username != oldUser.Username ||
					user.Email != oldUser.Email {
					result.Err = model.NewAppError("SqlUserStore.Update", "store.sql_user.update.can_not_change_ldap.app_error", nil, "user_id="+user.Id, http.StatusBadRequest)
					return
				}
			} else if user.Email != oldUser.Email {
				user.EmailVerified = false
			}

			if user.Username != oldUser.Username {
				user.UpdateMentionKeysFromUsername(oldUser.Username)
			}

			if count, err := us.GetMaster().Update(user); err != nil {
				if IsUniqueConstraintError(err, []string{"Email", "users_email_key", "idx_users_email_unique"}) {
					result.Err = model.NewAppError("SqlUserStore.Update", "store.sql_user.update.email_taken.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
				} else if IsUniqueConstraintError(err, []string{"Username", "users_username_key", "idx_users_username_unique"}) {
					result.Err = model.NewAppError("SqlUserStore.Update", "store.sql_user.update.username_taken.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
				} else {
					result.Err = model.NewAppError("SqlUserStore.Update", "store.sql_user.update.updating.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusInternalServerError)
				}
			} else if count != 1 {
				result.Err = model.NewAppError("SqlUserStore.Update", "store.sql_user.update.app_error", nil, fmt.Sprintf("user_id=%v, count=%v", user.Id, count), http.StatusInternalServerError)
			} else {
				user.Sanitize(map[string]bool{})
				oldUser.Sanitize(map[string]bool{})
				result.Data = [2]*model.User{user, oldUser}
			}
		}
	})
}

func (us SqlUserStore) UpdateLastPictureUpdate(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		curTime := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastPictureUpdate = :Time, UpdateAt = :Time WHERE Id = :UserId", map[string]interface{}{"Time": curTime, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateUpdateAt", "store.sql_user.update_last_picture_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
		} else {
			result.Data = userId
		}
	})
}

func (us SqlUserStore) ResetLastPictureUpdate(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := us.GetMaster().Exec("UPDATE Users SET LastPictureUpdate = :Time, UpdateAt = :Time WHERE Id = :UserId", map[string]interface{}{"Time": 0, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateUpdateAt", "store.sql_user.update_last_picture_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
		} else {
			result.Data = userId
		}
	})
}

func (us SqlUserStore) UpdateUpdateAt(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		curTime := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET UpdateAt = :Time WHERE Id = :UserId", map[string]interface{}{"Time": curTime, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateUpdateAt", "store.sql_user.update_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
		} else {
			result.Data = userId
		}
	})
}

func (us SqlUserStore) UpdatePassword(userId, hashedPassword string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		updateAt := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET Password = :Password, LastPasswordUpdate = :LastPasswordUpdate, UpdateAt = :UpdateAt, AuthData = NULL, AuthService = '', EmailVerified = true, FailedAttempts = 0 WHERE Id = :UserId", map[string]interface{}{"Password": hashedPassword, "LastPasswordUpdate": updateAt, "UpdateAt": updateAt, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdatePassword", "store.sql_user.update_password.app_error", nil, "id="+userId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = userId
		}
	})
}

func (us SqlUserStore) UpdateFailedPasswordAttempts(userId string, attempts int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := us.GetMaster().Exec("UPDATE Users SET FailedAttempts = :FailedAttempts WHERE Id = :UserId", map[string]interface{}{"FailedAttempts": attempts, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateFailedPasswordAttempts", "store.sql_user.update_failed_pwd_attempts.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
		} else {
			result.Data = userId
		}
	})
}

func (us SqlUserStore) UpdateAuthData(userId string, service string, authData *string, email string, resetMfa bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			if IsUniqueConstraintError(err, []string{"Email", "users_email_key", "idx_users_email_unique", "AuthData", "users_authdata_key"}) {
				result.Err = model.NewAppError("SqlUserStore.UpdateAuthData", "store.sql_user.update_auth_data.email_exists.app_error", map[string]interface{}{"Service": service, "Email": email}, "user_id="+userId+", "+err.Error(), http.StatusBadRequest)
			} else {
				result.Err = model.NewAppError("SqlUserStore.UpdateAuthData", "store.sql_user.update_auth_data.app_error", nil, "id="+userId+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = userId
		}
	})
}

func (us SqlUserStore) UpdateMfaSecret(userId, secret string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		updateAt := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET MfaSecret = :Secret, UpdateAt = :UpdateAt WHERE Id = :UserId", map[string]interface{}{"Secret": secret, "UpdateAt": updateAt, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateMfaSecret", "store.sql_user.update_mfa_secret.app_error", nil, "id="+userId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = userId
		}
	})
}

func (us SqlUserStore) UpdateMfaActive(userId string, active bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		updateAt := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET MfaActive = :Active, UpdateAt = :UpdateAt WHERE Id = :UserId", map[string]interface{}{"Active": active, "UpdateAt": updateAt, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateMfaActive", "store.sql_user.update_mfa_active.app_error", nil, "id="+userId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = userId
		}
	})
}

func (us SqlUserStore) Get(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if obj, err := us.GetReplica().Get(model.User{}, id); err != nil {
			result.Err = model.NewAppError("SqlUserStore.Get", "store.sql_user.get.app_error", nil, "user_id="+id+", "+err.Error(), http.StatusInternalServerError)
		} else if obj == nil {
			result.Err = model.NewAppError("SqlUserStore.Get", store.MISSING_ACCOUNT_ERROR, nil, "user_id="+id, http.StatusNotFound)
		} else {
			result.Data = obj.(*model.User)
		}
	})
}

func (us SqlUserStore) GetAll() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.User
		if _, err := us.GetReplica().Select(&data, "SELECT * FROM Users"); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetAll", "store.sql_user.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = data
	})
}

func (us SqlUserStore) GetAllAfter(limit int, afterId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.User
		if _, err := us.GetReplica().Select(&data, "SELECT * FROM Users WHERE Id > :AfterId ORDER BY Id LIMIT :Limit", map[string]interface{}{"AfterId": afterId, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetAllAfter", "store.sql_user.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = data
	})
}

func (s SqlUserStore) GetEtagForAllProfiles() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		updateAt, err := s.GetReplica().SelectInt("SELECT UpdateAt FROM Users ORDER BY UpdateAt DESC LIMIT 1")
		if err != nil {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
		} else {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, updateAt)
		}
	})
}

func (us SqlUserStore) GetAllProfiles(offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users ORDER BY Username ASC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetAllProfiles", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			for _, u := range users {
				u.Sanitize(map[string]bool{})
			}

			result.Data = users
		}
	})
}

func (s SqlUserStore) GetEtagForProfiles(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		updateAt, err := s.GetReplica().SelectInt("SELECT UpdateAt FROM Users, TeamMembers WHERE TeamMembers.TeamId = :TeamId AND Users.Id = TeamMembers.UserId ORDER BY UpdateAt DESC LIMIT 1", map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
		} else {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, updateAt)
		}
	})
}

func (us SqlUserStore) GetProfiles(teamId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT Users.* FROM Users, TeamMembers WHERE TeamMembers.TeamId = :TeamId AND Users.Id = TeamMembers.UserId AND TeamMembers.DeleteAt = 0 ORDER BY Users.Username ASC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"TeamId": teamId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetProfiles", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			for _, u := range users {
				u.Sanitize(map[string]bool{})
			}

			result.Data = users
		}
	})
}

func (us SqlUserStore) InvalidateProfilesInChannelCacheByUser(userId string) {
	keys := profilesInChannelCache.Keys()

	for _, key := range keys {
		if cacheItem, ok := profilesInChannelCache.Get(key); ok {
			userMap := cacheItem.(map[string]*model.User)
			if _, userInCache := userMap[userId]; userInCache {
				profilesInChannelCache.Remove(key)
				if us.metrics != nil {
					us.metrics.IncrementMemCacheInvalidationCounter("Profiles in Channel - Remove by User")
				}
			}
		}
	}
}

func (us SqlUserStore) InvalidateProfilesInChannelCache(channelId string) {
	profilesInChannelCache.Remove(channelId)
	if us.metrics != nil {
		us.metrics.IncrementMemCacheInvalidationCounter("Profiles in Channel - Remove by Channel")
	}
}

func (us SqlUserStore) GetProfilesInChannel(channelId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var users []*model.User

		query := `
				SELECT 
					Users.* 
				FROM 
					Users, ChannelMembers 
				WHERE 
					ChannelMembers.ChannelId = :ChannelId 
					AND Users.Id = ChannelMembers.UserId 
				ORDER BY 
					Users.Username ASC 
				LIMIT :Limit OFFSET :Offset
		`

		if _, err := us.GetReplica().Select(&users, query, map[string]interface{}{"ChannelId": channelId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetProfilesInChannel", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			for _, u := range users {
				u.Sanitize(map[string]bool{})
			}

			result.Data = users
		}
	})
}

func (us SqlUserStore) GetProfilesInChannelByStatus(channelId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var users []*model.User

		query := `
			SELECT 
				Users.*
			FROM Users
				INNER JOIN ChannelMembers ON Users.Id = ChannelMembers.UserId
				LEFT JOIN Status  ON Users.Id = Status.UserId
			WHERE
				ChannelMembers.ChannelId = :ChannelId
			ORDER BY 
				CASE Status
					WHEN 'online' THEN 1
					WHEN 'away' THEN 2
					WHEN 'dnd' THEN 3
					ELSE 4
				END,
				Users.Username ASC 
			LIMIT :Limit OFFSET :Offset
		`

		if _, err := us.GetReplica().Select(&users, query, map[string]interface{}{"ChannelId": channelId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetProfilesInChannelByStatus", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			for _, u := range users {
				u.Sanitize(map[string]bool{})
			}

			result.Data = users
		}
	})
}

func (us SqlUserStore) GetAllProfilesInChannel(channelId string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if cacheItem, ok := profilesInChannelCache.Get(channelId); ok {
				if us.metrics != nil {
					us.metrics.IncrementMemCacheHitCounter("Profiles in Channel")
				}
				result.Data = cacheItem.(map[string]*model.User)
				return
			} else {
				if us.metrics != nil {
					us.metrics.IncrementMemCacheMissCounter("Profiles in Channel")
				}
			}
		} else {
			if us.metrics != nil {
				us.metrics.IncrementMemCacheMissCounter("Profiles in Channel")
			}
		}

		var users []*model.User

		query := "SELECT Users.* FROM Users, ChannelMembers WHERE ChannelMembers.ChannelId = :ChannelId AND Users.Id = ChannelMembers.UserId AND Users.DeleteAt = 0"

		if _, err := us.GetReplica().Select(&users, query, map[string]interface{}{"ChannelId": channelId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetAllProfilesInChannel", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Sanitize(map[string]bool{})
				userMap[u.Id] = u
			}

			result.Data = userMap

			if allowFromCache {
				profilesInChannelCache.AddWithExpiresInSecs(channelId, userMap, PROFILES_IN_CHANNEL_CACHE_SEC)
			}
		}
	})
}

func (us SqlUserStore) GetProfilesNotInChannel(teamId string, channelId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlUserStore.GetProfilesNotInChannel", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			for _, u := range users {
				u.Sanitize(map[string]bool{})
			}

			result.Data = users
		}
	})
}

func (us SqlUserStore) GetProfilesWithoutTeam(offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var users []*model.User

		query := `
		SELECT
			*
		FROM
			Users
		WHERE
			(SELECT
				COUNT(0)
			FROM
				TeamMembers
			WHERE
				TeamMembers.UserId = Users.Id
				AND TeamMembers.DeleteAt = 0) = 0
		ORDER BY
			Username ASC
		LIMIT
			:Limit
		OFFSET
			:Offset`

		if _, err := us.GetReplica().Select(&users, query, map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetProfilesWithoutTeam", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			for _, u := range users {
				u.Sanitize(map[string]bool{})
			}

			result.Data = users
		}
	})
}

func (us SqlUserStore) GetProfilesByUsernames(usernames []string, teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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

		var query string
		if teamId == "" {
			query = `SELECT * FROM Users WHERE Username IN (` + idQuery + `)`
		} else {
			query = `SELECT Users.* FROM Users INNER JOIN TeamMembers ON
				Users.Id = TeamMembers.UserId AND Users.Username IN (` + idQuery + `) AND TeamMembers.TeamId = :TeamId `
			props["TeamId"] = teamId
		}

		if _, err := us.GetReplica().Select(&users, query, props); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetProfilesByUsernames", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = users
		}
	})
}

type UserWithLastActivityAt struct {
	model.User
	LastActivityAt int64
}

func (us SqlUserStore) GetRecentlyActiveUsersForTeam(teamId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
            LIMIT :Limit OFFSET :Offset
            `, map[string]interface{}{"TeamId": teamId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetRecentlyActiveUsers", "store.sql_user.get_recently_active_users.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			userList := []*model.User{}

			for _, userWithLastActivityAt := range users {
				u := userWithLastActivityAt.User
				u.Sanitize(map[string]bool{})
				u.LastActivityAt = userWithLastActivityAt.LastActivityAt
				userList = append(userList, &u)
			}

			result.Data = userList
		}
	})
}

func (us SqlUserStore) GetNewUsersForTeam(teamId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var users []*model.User

		if _, err := us.GetReplica().Select(&users, `
            SELECT
                u.*
            FROM Users AS u
                INNER JOIN TeamMembers AS t ON u.Id = t.UserId
            WHERE t.TeamId = :TeamId
            ORDER BY u.CreateAt DESC
            LIMIT :Limit OFFSET :Offset
            `, map[string]interface{}{"TeamId": teamId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetNewUsersForTeam", "store.sql_user.get_new_users.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			for _, u := range users {
				u.Sanitize(map[string]bool{})
			}

			result.Data = users
		}
	})
}

func (us SqlUserStore) GetProfileByIds(userIds []string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		users := []*model.User{}
		props := make(map[string]interface{})
		idQuery := ""
		remainingUserIds := make([]string, 0)

		if allowFromCache {
			for _, userId := range userIds {
				if cacheItem, ok := profileByIdsCache.Get(userId); ok {
					u := &model.User{}
					*u = *cacheItem.(*model.User)
					users = append(users, u)
				} else {
					remainingUserIds = append(remainingUserIds, userId)
				}
			}
			if us.metrics != nil {
				us.metrics.AddMemCacheHitCounter("Profile By Ids", float64(len(users)))
				us.metrics.AddMemCacheMissCounter("Profile By Ids", float64(len(remainingUserIds)))
			}
		} else {
			remainingUserIds = userIds
			if us.metrics != nil {
				us.metrics.AddMemCacheMissCounter("Profile By Ids", float64(len(remainingUserIds)))
			}
		}

		// If everything came from the cache then just return
		if len(remainingUserIds) == 0 {
			result.Data = users
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
			result.Err = model.NewAppError("SqlUserStore.GetProfileByIds", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			for _, u := range users {
				u.Sanitize(map[string]bool{})

				cpy := &model.User{}
				*cpy = *u
				profileByIdsCache.AddWithExpiresInSecs(cpy.Id, cpy, PROFILE_BY_IDS_CACHE_SEC)
			}

			result.Data = users
		}
	})
}

func (us SqlUserStore) GetSystemAdminProfiles() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE Roles LIKE :Roles", map[string]interface{}{"Roles": "%system_admin%"}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetSystemAdminProfiles", "store.sql_user.get_sysadmin_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Sanitize(map[string]bool{})
				userMap[u.Id] = u
			}

			result.Data = userMap
		}
	})
}

func (us SqlUserStore) GetByEmail(email string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		email = strings.ToLower(email)

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE Email = :Email", map[string]interface{}{"Email": email}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetByEmail", store.MISSING_ACCOUNT_ERROR, nil, "email="+email+", "+err.Error(), http.StatusInternalServerError)
		}

		result.Data = &user
	})
}

func (us SqlUserStore) GetByAuth(authData *string, authService string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if authData == nil || *authData == "" {
			result.Err = model.NewAppError("SqlUserStore.GetByAuth", store.MISSING_AUTH_ACCOUNT_ERROR, nil, "authData='', authService="+authService, http.StatusBadRequest)
			return
		}

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE AuthData = :AuthData AND AuthService = :AuthService", map[string]interface{}{"AuthData": authData, "AuthService": authService}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlUserStore.GetByAuth", store.MISSING_AUTH_ACCOUNT_ERROR, nil, "authData="+*authData+", authService="+authService+", "+err.Error(), http.StatusInternalServerError)
			} else {
				result.Err = model.NewAppError("SqlUserStore.GetByAuth", "store.sql_user.get_by_auth.other.app_error", nil, "authData="+*authData+", authService="+authService+", "+err.Error(), http.StatusInternalServerError)
			}
		}

		result.Data = &user
	})
}

func (us SqlUserStore) GetAllUsingAuthService(authService string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var data []*model.User

		if _, err := us.GetReplica().Select(&data, "SELECT * FROM Users WHERE AuthService = :AuthService", map[string]interface{}{"AuthService": authService}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetByAuth", "store.sql_user.get_by_auth.other.app_error", nil, "authService="+authService+", "+err.Error(), http.StatusInternalServerError)
		}

		result.Data = data
	})
}

func (us SqlUserStore) GetByUsername(username string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE Username = :Username", map[string]interface{}{"Username": username}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetByUsername", "store.sql_user.get_by_username.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = &user
	})
}

func (us SqlUserStore) GetForLogin(loginId string, allowSignInWithUsername, allowSignInWithEmail bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		params := map[string]interface{}{
			"LoginId":                 loginId,
			"AllowSignInWithUsername": allowSignInWithUsername,
			"AllowSignInWithEmail":    allowSignInWithEmail,
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
				OR (:AllowSignInWithEmail AND Email = :LoginId)`,
			params); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if len(users) == 1 {
			result.Data = users[0]
		} else if len(users) > 1 {
			result.Err = model.NewAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.multiple_users", nil, "", http.StatusInternalServerError)
		} else {
			result.Err = model.NewAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.app_error", nil, "", http.StatusInternalServerError)
		}
	})
}

func (us SqlUserStore) VerifyEmail(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := us.GetMaster().Exec("UPDATE Users SET EmailVerified = true WHERE Id = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.VerifyEmail", "store.sql_user.verify_email.app_error", nil, "userId="+userId+", "+err.Error(), http.StatusInternalServerError)
		}

		result.Data = userId
	})
}

func (us SqlUserStore) GetTotalUsersCount() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if count, err := us.GetReplica().SelectInt("SELECT COUNT(Id) FROM Users"); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetTotalUsersCount", "store.sql_user.get_total_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = count
		}
	})
}

func (us SqlUserStore) PermanentDelete(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := us.GetMaster().Exec("DELETE FROM Users WHERE Id = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.PermanentDelete", "store.sql_user.permanent_delete.app_error", nil, "userId="+userId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (us SqlUserStore) AnalyticsUniqueUserCount(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := ""
		if len(teamId) > 0 {
			query = "SELECT COUNT(DISTINCT Users.Email) From Users, TeamMembers WHERE TeamMembers.TeamId = :TeamId AND Users.Id = TeamMembers.UserId AND TeamMembers.DeleteAt = 0 AND Users.DeleteAt = 0"
		} else {
			query = "SELECT COUNT(DISTINCT Email) FROM Users WHERE DeleteAt = 0"
		}

		v, err := us.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Err = model.NewAppError("SqlUserStore.AnalyticsUniqueUserCount", "store.sql_user.analytics_unique_user_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = v
		}
	})
}

func (us SqlUserStore) AnalyticsActiveCount(timePeriod int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		time := model.GetMillis() - timePeriod

		query := "SELECT COUNT(*) FROM Status WHERE LastActivityAt > :Time"

		v, err := us.GetReplica().SelectInt(query, map[string]interface{}{"Time": time})
		if err != nil {
			result.Err = model.NewAppError("SqlUserStore.AnalyticsDailyActiveUsers", "store.sql_user.analytics_daily_active_users.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = v
		}
	})
}

func (us SqlUserStore) GetUnreadCount(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if count, err := us.GetReplica().SelectInt(`
		SELECT SUM(CASE WHEN c.Type = 'D' THEN (c.TotalMsgCount - cm.MsgCount) ELSE cm.MentionCount END)
		FROM Channels c
		INNER JOIN ChannelMembers cm
		      ON cm.ChannelId = c.Id
		      AND cm.UserId = :UserId
		      AND c.DeleteAt = 0`, map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetMentionCount", "store.sql_user.get_unread_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = count
		}
	})
}

func (us SqlUserStore) GetUnreadCountForChannel(userId string, channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if count, err := us.GetReplica().SelectInt("SELECT SUM(CASE WHEN c.Type = 'D' THEN (c.TotalMsgCount - cm.MsgCount) ELSE cm.MentionCount END) FROM Channels c INNER JOIN ChannelMembers cm ON c.Id = :ChannelId AND cm.ChannelId = :ChannelId AND cm.UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetMentionCountForChannel", "store.sql_user.get_unread_count_for_channel.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = count
		}
	})
}

func (us SqlUserStore) GetAnyUnreadPostCountForChannel(userId string, channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if count, err := us.GetReplica().SelectInt("SELECT SUM(c.TotalMsgCount - cm.MsgCount) FROM Channels c INNER JOIN ChannelMembers cm ON c.Id = :ChannelId AND cm.ChannelId = :ChannelId AND cm.UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetMentionCountForChannel", "store.sql_user.get_unread_count_for_channel.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = count
		}
	})
}

func (us SqlUserStore) Search(teamId string, term string, options map[string]bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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

		*result = us.performSearch(searchQuery, term, options, map[string]interface{}{"TeamId": teamId})

	})
}

func (us SqlUserStore) SearchWithoutTeam(term string, options map[string]bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		searchQuery := `
		SELECT
			*
		FROM
			Users
		WHERE
			(SELECT
				COUNT(0)
			FROM
				TeamMembers
			WHERE
				TeamMembers.UserId = Users.Id
				AND TeamMembers.DeleteAt = 0) = 0
			SEARCH_CLAUSE
			INACTIVE_CLAUSE
			ORDER BY Username ASC
		LIMIT 100`

		*result = us.performSearch(searchQuery, term, options, map[string]interface{}{})

	})
}

func (us SqlUserStore) SearchNotInTeam(notInTeamId string, term string, options map[string]bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		searchQuery := `
			SELECT
				Users.*
			FROM Users
			LEFT JOIN TeamMembers tm
				ON tm.UserId = Users.Id
				AND tm.TeamId = :NotInTeamId
			WHERE
				(tm.UserId IS NULL OR tm.DeleteAt != 0)
				SEARCH_CLAUSE
				INACTIVE_CLAUSE
			ORDER BY Users.Username ASC
			LIMIT 100`

		*result = us.performSearch(searchQuery, term, options, map[string]interface{}{"NotInTeamId": notInTeamId})

	})
}

func (us SqlUserStore) SearchNotInChannel(teamId string, channelId string, term string, options map[string]bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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

		*result = us.performSearch(searchQuery, term, options, map[string]interface{}{"TeamId": teamId, "ChannelId": channelId})

	})
}

func (us SqlUserStore) SearchInChannel(channelId string, term string, options map[string]bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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

		*result = us.performSearch(searchQuery, term, options, map[string]interface{}{"ChannelId": channelId})

	})
}

var escapeLikeSearchChar = []string{
	"%",
	"_",
}

var ignoreLikeSearchChar = []string{
	"*",
}

var spaceFulltextSearchChar = []string{
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

func generateSearchQuery(searchQuery string, terms []string, fields []string, parameters map[string]interface{}, isPostgreSQL bool) string {
	searchTerms := []string{}
	for i, term := range terms {
		searchFields := []string{}
		for _, field := range fields {
			if isPostgreSQL {
				searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(%s) escape '*' ", field, fmt.Sprintf(":Term%d", i)))
			} else {
				searchFields = append(searchFields, fmt.Sprintf("%s LIKE %s escape '*' ", field, fmt.Sprintf(":Term%d", i)))
			}
		}
		searchTerms = append(searchTerms, fmt.Sprintf("(%s)", strings.Join(searchFields, " OR ")))
		parameters[fmt.Sprintf("Term%d", i)] = fmt.Sprintf("%s%%", term)
	}

	searchClause := strings.Join(searchTerms, " AND ")
	return strings.Replace(searchQuery, "SEARCH_CLAUSE", fmt.Sprintf(" AND %s ", searchClause), 1)
}

func (us SqlUserStore) performSearch(searchQuery string, term string, options map[string]bool, parameters map[string]interface{}) store.StoreResult {
	result := store.StoreResult{}

	// These chars must be removed from the like query.
	for _, c := range ignoreLikeSearchChar {
		term = strings.Replace(term, c, "", -1)
	}

	// These chars must be escaped in the like query.
	for _, c := range escapeLikeSearchChar {
		term = strings.Replace(term, c, "*"+c, -1)
	}

	searchType := USER_SEARCH_TYPE_ALL
	if ok := options[store.USER_SEARCH_OPTION_NAMES_ONLY]; ok {
		searchType = USER_SEARCH_TYPE_NAMES
	} else if ok = options[store.USER_SEARCH_OPTION_NAMES_ONLY_NO_FULL_NAME]; ok {
		searchType = USER_SEARCH_TYPE_NAMES_NO_FULL_NAME
	} else if ok = options[store.USER_SEARCH_OPTION_ALL_NO_FULL_NAME]; ok {
		searchType = USER_SEARCH_TYPE_ALL_NO_FULL_NAME
	}

	if ok := options[store.USER_SEARCH_OPTION_ALLOW_INACTIVE]; ok {
		searchQuery = strings.Replace(searchQuery, "INACTIVE_CLAUSE", "", 1)
	} else {
		searchQuery = strings.Replace(searchQuery, "INACTIVE_CLAUSE", "AND Users.DeleteAt = 0", 1)
	}

	if strings.TrimSpace(term) == "" {
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
	} else {
		isPostgreSQL := us.DriverName() == model.DATABASE_DRIVER_POSTGRES
		searchQuery = generateSearchQuery(searchQuery, strings.Fields(term), searchType, parameters, isPostgreSQL)
	}

	var users []*model.User

	if _, err := us.GetReplica().Select(&users, searchQuery, parameters); err != nil {
		result.Err = model.NewAppError("SqlUserStore.Search", "store.sql_user.search.app_error", nil,
			fmt.Sprintf("term=%v, search_type=%v, %v", term, searchType, err.Error()), http.StatusInternalServerError)
	} else {
		for _, u := range users {
			u.Sanitize(map[string]bool{})
		}

		result.Data = users
	}

	return result
}

func (us SqlUserStore) AnalyticsGetInactiveUsersCount() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if count, err := us.GetReplica().SelectInt("SELECT COUNT(Id) FROM Users WHERE DeleteAt > 0"); err != nil {
			result.Err = model.NewAppError("SqlUserStore.AnalyticsGetInactiveUsersCount", "store.sql_user.analytics_get_inactive_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = count
		}
	})
}

func (us SqlUserStore) AnalyticsGetSystemAdminCount() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if count, err := us.GetReplica().SelectInt("SELECT count(*) FROM Users WHERE Roles LIKE :Roles and DeleteAt = 0", map[string]interface{}{"Roles": "%system_admin%"}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.AnalyticsGetSystemAdminCount", "store.sql_user.analytics_get_system_admin_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = count
		}
	})
}

func (us SqlUserStore) GetProfilesNotInTeam(teamId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var users []*model.User

		if _, err := us.GetReplica().Select(&users, `
            SELECT
                u.*
            FROM Users u
            LEFT JOIN TeamMembers tm
                ON tm.UserId = u.Id
                AND tm.TeamId = :TeamId
                AND tm.DeleteAt = 0
            WHERE tm.UserId IS NULL
            ORDER BY u.Username ASC
            LIMIT :Limit OFFSET :Offset
            `, map[string]interface{}{"TeamId": teamId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetProfilesNotInTeam", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {

			for _, u := range users {
				u.Sanitize(map[string]bool{})
			}

			result.Data = users
		}
	})
}

func (us SqlUserStore) GetEtagForProfilesNotInTeam(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		updateAt, err := us.GetReplica().SelectInt(`
            SELECT
                u.UpdateAt
            FROM Users u
            LEFT JOIN TeamMembers tm
                ON tm.UserId = u.Id
                AND tm.TeamId = :TeamId
                AND tm.DeleteAt = 0
            WHERE tm.UserId IS NULL
            ORDER BY u.UpdateAt DESC
            LIMIT 1
            `, map[string]interface{}{"TeamId": teamId})

		if err != nil {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
		} else {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, updateAt)
		}
	})
}

func (us SqlUserStore) ClearAllCustomRoleAssignments() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		builtInRoles := model.MakeDefaultRoles()
		lastUserId := strings.Repeat("0", 26)

		for {
			var transaction *gorp.Transaction
			var err error

			if transaction, err = us.GetMaster().Begin(); err != nil {
				result.Err = model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}

			var users []*model.User
			if _, err := transaction.Select(&users, "SELECT * from Users WHERE Id > :Id ORDER BY Id LIMIT 1000", map[string]interface{}{"Id": lastUserId}); err != nil {
				if err2 := transaction.Rollback(); err2 != nil {
					result.Err = model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.rollback_transaction.app_error", nil, err2.Error(), http.StatusInternalServerError)
					return
				}
				result.Err = model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.select.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}

			if len(users) == 0 {
				break
			}

			for _, user := range users {
				lastUserId = user.Id

				var newRoles []string

				for _, role := range strings.Fields(user.Roles) {
					for name := range builtInRoles {
						if name == role {
							newRoles = append(newRoles, role)
							break
						}
					}
				}

				newRolesString := strings.Join(newRoles, " ")
				if newRolesString != user.Roles {
					if _, err := transaction.Exec("UPDATE Users SET Roles = :Roles WHERE Id = :Id", map[string]interface{}{"Roles": newRolesString, "Id": user.Id}); err != nil {
						if err2 := transaction.Rollback(); err2 != nil {
							result.Err = model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.rollback_transaction.app_error", nil, err2.Error(), http.StatusInternalServerError)
							return
						}
						result.Err = model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.update.app_error", nil, err.Error(), http.StatusInternalServerError)
						return
					}
				}
			}

			if err := transaction.Commit(); err != nil {
				if err2 := transaction.Rollback(); err2 != nil {
					result.Err = model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.rollback_transaction.app_error", nil, err2.Error(), http.StatusInternalServerError)
					return
				}
				result.Err = model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}
		}
	})
}

func (us SqlUserStore) InferSystemInstallDate() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		createAt, err := us.GetReplica().SelectInt("SELECT CreateAt FROM Users WHERE CreateAt IS NOT NULL ORDER BY CreateAt ASC LIMIT 1")
		if err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetSystemInstallDate", "store.sql_user.get_system_install_date.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}
		result.Data = createAt
	})
}
