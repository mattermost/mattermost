// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"strings"
)

const (
	MISSING_ACCOUNT_ERROR = "store.sql_user.missing_account.const"
)

type SqlUserStore struct {
	*SqlStore
}

func NewSqlUserStore(sqlStore *SqlStore) UserStore {
	us := &SqlUserStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.User{}, "Users").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("TeamId").SetMaxSize(26)
		table.ColMap("Username").SetMaxSize(64)
		table.ColMap("Password").SetMaxSize(128)
		table.ColMap("AuthData").SetMaxSize(128)
		table.ColMap("AuthService").SetMaxSize(32)
		table.ColMap("Email").SetMaxSize(128)
		table.ColMap("Nickname").SetMaxSize(64)
		table.ColMap("FirstName").SetMaxSize(64)
		table.ColMap("LastName").SetMaxSize(64)
		table.ColMap("Roles").SetMaxSize(64)
		table.ColMap("Props").SetMaxSize(4000)
		table.ColMap("NotifyProps").SetMaxSize(2000)
		table.ColMap("ThemeProps").SetMaxSize(2000)
		table.ColMap("Locale").SetMaxSize(5)
		table.SetUniqueTogether("Email", "TeamId")
		table.SetUniqueTogether("Username", "TeamId")
	}

	return us
}

func (us SqlUserStore) UpgradeSchemaIfNeeded() {
	// ADDED for 1.5 REMOVE for 1.8
	us.CreateColumnIfNotExists("Users", "Locale", "varchar(5)", "character varying(5)", model.DEFAULT_LOCALE)
}

func (us SqlUserStore) CreateIndexesIfNotExists() {
	us.CreateIndexIfNotExists("idx_users_team_id", "Users", "TeamId")
	us.CreateIndexIfNotExists("idx_users_email", "Users", "Email")
}

func (us SqlUserStore) Save(user *model.User) StoreChannel {

	storeChannel := make(StoreChannel)

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

		if count, err := us.GetMaster().SelectInt("SELECT COUNT(0) FROM Users WHERE TeamId = :TeamId AND DeleteAt = 0", map[string]interface{}{"TeamId": user.TeamId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.Save", "store.sql_user.save.member_count.app_error", nil, "teamId="+user.TeamId+", "+err.Error())
			storeChannel <- result
			close(storeChannel)
			return
		} else if int(count) > utils.Cfg.TeamSettings.MaxUsersPerTeam {
			result.Err = model.NewLocAppError("SqlUserStore.Save", "store.sql_user.save.max_accounts.app_error", nil, "teamId="+user.TeamId)
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := us.GetMaster().Insert(user); err != nil {
			if IsUniqueConstraintError(err.Error(), "Email", "users_email_teamid_key") {
				result.Err = model.NewLocAppError("SqlUserStore.Save", "store.sql_user.save.email_exists.app_error", nil, "user_id="+user.Id+", "+err.Error())
			} else if IsUniqueConstraintError(err.Error(), "Username", "users_username_teamid_key") {
				result.Err = model.NewLocAppError("SqlUserStore.Save", "store.sql_user.save.username_exists.app_error", nil, "user_id="+user.Id+", "+err.Error())
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

func (us SqlUserStore) Update(user *model.User, allowActiveUpdate bool) StoreChannel {

	storeChannel := make(StoreChannel)

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
			user.TeamId = oldUser.TeamId
			user.LastActivityAt = oldUser.LastActivityAt
			user.LastPingAt = oldUser.LastPingAt
			user.EmailVerified = oldUser.EmailVerified
			user.FailedAttempts = oldUser.FailedAttempts

			if !allowActiveUpdate {
				user.Roles = oldUser.Roles
				user.DeleteAt = oldUser.DeleteAt
			}

			if user.IsSSOUser() {
				user.Email = oldUser.Email
			} else if user.Email != oldUser.Email {
				user.EmailVerified = false
			}

			if user.Username != oldUser.Username {
				nonUsernameKeys := []string{}
				splitKeys := strings.Split(user.NotifyProps["mention_keys"], ",")
				for _, key := range splitKeys {
					if key != oldUser.Username && key != "@"+oldUser.Username {
						nonUsernameKeys = append(nonUsernameKeys, key)
					}
				}
				user.NotifyProps["mention_keys"] = strings.Join(nonUsernameKeys, ",") + user.Username + ",@" + user.Username
			}

			if count, err := us.GetMaster().Update(user); err != nil {
				if IsUniqueConstraintError(err.Error(), "Email", "users_email_teamid_key") {
					result.Err = model.NewLocAppError("SqlUserStore.Update", "store.sql_user.update.email_taken.app_error", nil, "user_id="+user.Id+", "+err.Error())
				} else if IsUniqueConstraintError(err.Error(), "Username", "users_username_teamid_key") {
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
	storeChannel := make(StoreChannel)

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

func (us SqlUserStore) UpdateLastPingAt(userId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastPingAt = :LastPingAt WHERE Id = :UserId", map[string]interface{}{"LastPingAt": time, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateLastPingAt", "store.sql_user.update_last_ping.app_error", nil, "user_id="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateLastActivityAt(userId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastActivityAt = :LastActivityAt WHERE Id = :UserId", map[string]interface{}{"LastActivityAt": time, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateLastActivityAt", "store.sql_user.update_last_activity.app_error", nil, "user_id="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateUserAndSessionActivity(userId string, sessionId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastActivityAt = :UserLastActivityAt WHERE Id = :UserId", map[string]interface{}{"UserLastActivityAt": time, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateLastActivityAt", "store.sql_user.update_last_activity.app_error", nil, "1 user_id="+userId+" session_id="+sessionId+" err="+err.Error())
		} else if _, err := us.GetMaster().Exec("UPDATE Sessions SET LastActivityAt = :SessionLastActivityAt WHERE Id = :SessionId", map[string]interface{}{"SessionLastActivityAt": time, "SessionId": sessionId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateLastActivityAt", "store.sql_user.update_last_activity.app_error", nil, "2 user_id="+userId+" session_id="+sessionId+" err="+err.Error())
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdatePassword(userId, hashedPassword string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		updateAt := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET Password = :Password, LastPasswordUpdate = :LastPasswordUpdate, UpdateAt = :UpdateAt, AuthData = '', AuthService = '', FailedAttempts = 0 WHERE Id = :UserId", map[string]interface{}{"Password": hashedPassword, "LastPasswordUpdate": updateAt, "UpdateAt": updateAt, "UserId": userId}); err != nil {
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
	storeChannel := make(StoreChannel)

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

func (us SqlUserStore) UpdateAuthData(userId, service, authData, email string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

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

		query += " WHERE Id = :UserId"

		if _, err := us.GetMaster().Exec(query, map[string]interface{}{"LastPasswordUpdate": updateAt, "UpdateAt": updateAt, "UserId": userId, "AuthService": service, "AuthData": authData, "Email": email}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.UpdateAuthData", "store.sql_user.update_auth_data.app_error", nil, "id="+userId+", "+err.Error())
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) Get(id string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := us.GetReplica().Get(model.User{}, id); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.Get", "store.sql_user.get.app_error", nil, "user_id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewLocAppError("SqlUserStore.Get", MISSING_ACCOUNT_ERROR, nil, "user_id="+id)
		} else {
			result.Data = obj.(*model.User)
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (s SqlUserStore) GetEtagForProfiles(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		updateAt, err := s.GetReplica().SelectInt("SELECT UpdateAt FROM Users WHERE TeamId = :TeamId ORDER BY UpdateAt DESC LIMIT 1", map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
		} else {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, updateAt)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetProfiles(teamId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetProfiles", "store.sql_user.get_profiles.app_error", nil, err.Error())
		} else {

			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Password = ""
				u.AuthData = ""
				userMap[u.Id] = u
			}

			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetSystemAdminProfiles() StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE Roles = :Roles", map[string]interface{}{"Roles": "system_admin"}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetSystemAdminProfiles", "store.sql_user.get_sysadmin_profiles.app_error", nil, err.Error())
		} else {

			userMap := make(map[string]*model.User)

			for _, u := range users {
				u.Password = ""
				u.AuthData = ""
				userMap[u.Id] = u
			}

			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetByEmail(teamId string, email string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE TeamId = :TeamId AND Email = :Email", map[string]interface{}{"TeamId": teamId, "Email": email}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetByEmail", MISSING_ACCOUNT_ERROR, nil, "teamId="+teamId+", email="+email+", "+err.Error())
		}

		result.Data = &user

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetByAuth(teamId string, authData string, authService string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE TeamId = :TeamId AND AuthData = :AuthData AND AuthService = :AuthService", map[string]interface{}{"TeamId": teamId, "AuthData": authData, "AuthService": authService}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetByAuth", "store.sql_user.get_by_auth.app_error",
				nil, "teamId="+teamId+", authData="+authData+", authService="+authService+", "+err.Error())
		}

		result.Data = &user

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetByUsername(teamId string, username string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE TeamId = :TeamId AND Username = :Username", map[string]interface{}{"TeamId": teamId, "Username": username}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetByUsername", "store.sql_user.get_by_username.app_error",
				nil, "teamId="+teamId+", username="+username+", "+err.Error())
		}

		result.Data = &user

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) VerifyEmail(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET EmailVerified = '1' WHERE Id = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.VerifyEmail", "store.sql_user.verify_email.app_error", nil, "userId="+userId+", "+err.Error())
		}

		result.Data = userId

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetForExport(teamId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetProfiles", "store.sql_user.get_for_export.app_error", nil, err.Error())
		} else {
			for _, u := range users {
				u.Password = ""
				u.AuthData = ""
			}

			result.Data = users
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetTotalUsersCount() StoreChannel {
	storeChannel := make(StoreChannel)

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

func (us SqlUserStore) GetTotalActiveUsersCount() StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		time := model.GetMillis() - (1000 * 60 * 60 * 24)

		if count, err := us.GetReplica().SelectInt("SELECT COUNT(Id) FROM Users WHERE LastActivityAt > :Time", map[string]interface{}{"Time": time}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetTotalActiveUsersCount", "store.sql_user.get_total_active_users_count.app_error", nil, err.Error())
		} else {
			result.Data = count
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) PermanentDelete(userId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("DELETE FROM Users WHERE Id = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlUserStore.GetByEmail", "store.sql_user.permanent_delete.app_error", nil, "userId="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) AnalyticsUniqueUserCount(teamId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		query := "SELECT COUNT(DISTINCT Email) FROM Users"

		if len(teamId) > 0 {
			query += " WHERE TeamId = :TeamId"
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
