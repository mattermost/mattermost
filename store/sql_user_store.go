// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"strings"
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
		table.ColMap("Language").SetMaxSize(5)
		table.ColMap("Props").SetMaxSize(4000)
		table.ColMap("NotifyProps").SetMaxSize(2000)
		table.ColMap("ThemeProps").SetMaxSize(2000)
		table.SetUniqueTogether("Email", "TeamId")
		table.SetUniqueTogether("Username", "TeamId")
	}

	return us
}

func (us SqlUserStore) UpgradeSchemaIfNeeded() {
	us.CreateColumnIfNotExists("Users", "Language", "varchar(5)", "character varying(5)", model.DEFAULT_LANGUAGE)
	us.CreateColumnIfNotExists("Users", "ThemeProps", "varchar(2000)", "character varying(2000)", "{}")
}

func (us SqlUserStore) CreateIndexesIfNotExists() {
	us.CreateIndexIfNotExists("idx_users_team_id", "Users", "TeamId")
	us.CreateIndexIfNotExists("idx_users_email", "Users", "Email")
}

func (us SqlUserStore) Save(user *model.User, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(user.Id) > 0 {
			result.Err = model.NewAppError("SqlUserStore.Save", T("Must call update for exisiting user"), "user_id="+user.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		user.PreSave()
		if result.Err = user.IsValid(T); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if count, err := us.GetMaster().SelectInt("SELECT COUNT(0) FROM Users WHERE TeamId = :TeamId AND DeleteAt = 0", map[string]interface{}{"TeamId": user.TeamId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.Save", T("Failed to get current team member count"), "teamId="+user.TeamId+", "+err.Error())
			storeChannel <- result
			close(storeChannel)
			return
		} else if int(count) > utils.Cfg.TeamSettings.MaxUsersPerTeam {
			result.Err = model.NewAppError("SqlUserStore.Save", T("This team has reached the maxmium number of allowed accounts. Contact your systems administrator to set a higher limit."), "teamId="+user.TeamId)
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := us.GetMaster().Insert(user); err != nil {
			if IsUniqueConstraintError(err.Error(), "Email", "users_email_teamid_key") {
				result.Err = model.NewAppError("SqlUserStore.Save", T("An account with that email already exists."), "user_id="+user.Id+", "+err.Error())
			} else if IsUniqueConstraintError(err.Error(), "Username", "users_username_teamid_key") {
				result.Err = model.NewAppError("SqlUserStore.Save", T("An account with that username already exists."), "user_id="+user.Id+", "+err.Error())
			} else {
				result.Err = model.NewAppError("SqlUserStore.Save", T("We couldn't save the account."), "user_id="+user.Id+", "+err.Error())
			}
		} else {
			result.Data = user
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) Update(user *model.User, allowActiveUpdate bool, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		user.PreUpdate()

		if result.Err = user.IsValid(T); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if oldUserResult, err := us.GetMaster().Get(model.User{}, user.Id); err != nil {
			result.Err = model.NewAppError("SqlUserStore.Update", T("We encounted an error finding the account"), "user_id="+user.Id+", "+err.Error())
		} else if oldUserResult == nil {
			result.Err = model.NewAppError("SqlUserStore.Update", T("We couldn't find the existing account to update"), "user_id="+user.Id)
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
					result.Err = model.NewAppError("SqlUserStore.Update", T("This email is already taken. Please choose another"), "user_id="+user.Id+", "+err.Error())
				} else if IsUniqueConstraintError(err.Error(), "Username", "users_username_teamid_key") {
					result.Err = model.NewAppError("SqlUserStore.Update", T("This username is already taken. Please choose another."), "user_id="+user.Id+", "+err.Error())
				} else {
					result.Err = model.NewAppError("SqlUserStore.Update", T("We encounted an error updating the account"), "user_id="+user.Id+", "+err.Error())
				}
			} else if count != 1 {
				result.Err = model.NewAppError("SqlUserStore.Update", T("We couldn't update the account"), fmt.Sprintf("user_id=%v, count=%v", user.Id, count))
			} else {
				result.Data = [2]*model.User{user, oldUser}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateLastPictureUpdate(userId string, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		curTime := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastPictureUpdate = :Time, UpdateAt = :Time WHERE Id = :UserId", map[string]interface{}{"Time": curTime, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateUpdateAt", T("We couldn't update the update_at"), "user_id="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateLastPingAt(userId string, time int64, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastPingAt = :LastPingAt WHERE Id = :UserId", map[string]interface{}{"LastPingAt": time, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateLastPingAt", T("We couldn't update the last_ping_at"), "user_id="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateLastActivityAt(userId string, time int64, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastActivityAt = :LastActivityAt WHERE Id = :UserId", map[string]interface{}{"LastActivityAt": time, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateLastActivityAt", T("We couldn't update the last_activity_at"), "user_id="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateUserAndSessionActivity(userId string, sessionId string, time int64, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastActivityAt = :UserLastActivityAt WHERE Id = :UserId", map[string]interface{}{"UserLastActivityAt": time, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateLastActivityAt", T("We couldn't update the last_activity_at"), "1 user_id="+userId+" session_id="+sessionId+" err="+err.Error())
		} else if _, err := us.GetMaster().Exec("UPDATE Sessions SET LastActivityAt = :SessionLastActivityAt WHERE Id = :SessionId", map[string]interface{}{"SessionLastActivityAt": time, "SessionId": sessionId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateLastActivityAt", T("We couldn't update the last_activity_at"), "2 user_id="+userId+" session_id="+sessionId+" err="+err.Error())
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdatePassword(userId, hashedPassword string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		updateAt := model.GetMillis()

		if _, err := us.GetMaster().Exec("UPDATE Users SET Password = :Password, LastPasswordUpdate = :LastPasswordUpdate, UpdateAt = :UpdateAt, FailedAttempts = 0 WHERE Id = :UserId AND AuthData = ''", map[string]interface{}{"Password": hashedPassword, "LastPasswordUpdate": updateAt, "UpdateAt": updateAt, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdatePassword", T("We couldn't update the user password"), "id="+userId+", "+err.Error())
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) UpdateFailedPasswordAttempts(userId string, attempts int, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET FailedAttempts = :FailedAttempts WHERE Id = :UserId", map[string]interface{}{"FailedAttempts": attempts, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateFailedPasswordAttempts", T("We couldn't update the failed_attempts"), "user_id="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) Get(id string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := us.GetReplica().Get(model.User{}, id); err != nil {
			result.Err = model.NewAppError("SqlUserStore.Get", T("We encounted an error finding the account"), "user_id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewAppError("SqlUserStore.Get", T("We couldn't find the existing account"), "user_id="+id)
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

func (us SqlUserStore) GetProfiles(teamId string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetProfiles", T("We encounted an error while finding user profiles"), err.Error())
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

func (us SqlUserStore) GetSystemAdminProfiles(T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE Roles = :Roles", map[string]interface{}{"Roles": "system_admin"}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetSystemAdminProfiles", "We encountered an error while finding user profiles", err.Error())
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

func (us SqlUserStore) GetByEmail(teamId string, email string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE TeamId = :TeamId AND Email = :Email", map[string]interface{}{"TeamId": teamId, "Email": email}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetByEmail", T("We couldn't find the existing account"), "teamId="+teamId+", email="+email+", "+err.Error())
		}

		result.Data = &user

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetByAuth(teamId string, authData string, authService string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE TeamId = :TeamId AND AuthData = :AuthData AND AuthService = :AuthService", map[string]interface{}{"TeamId": teamId, "AuthData": authData, "AuthService": authService}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetByAuth", T("We couldn't find the existing account"), "teamId="+teamId+", authData="+authData+", authService="+authService+", "+err.Error())
		}

		result.Data = &user

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetByUsername(teamId string, username string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		user := model.User{}

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE TeamId = :TeamId AND Username = :Username", map[string]interface{}{"TeamId": teamId, "Username": username}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetByUsername", T("We couldn't find the existing account"), "teamId="+teamId+", username="+username+", "+err.Error())
		}

		result.Data = &user

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) VerifyEmail(userId string, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("UPDATE Users SET EmailVerified = '1' WHERE Id = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.VerifyEmail", T("Unable to update verify email field"), "userId="+userId+", "+err.Error())
		}

		result.Data = userId

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetForExport(teamId string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*model.User

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetProfiles", T("We encounted an error while finding user profiles"), err.Error())
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

func (us SqlUserStore) GetTotalUsersCount(T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if count, err := us.GetReplica().SelectInt("SELECT COUNT(Id) FROM Users"); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetTotalUsersCount", T("We could not count the users"), err.Error())
		} else {
			result.Data = count
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetTotalActiveUsersCount(T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		time := model.GetMillis() - (1000 * 60 * 60 * 12)

		if count, err := us.GetReplica().SelectInt("SELECT COUNT(Id) FROM Users WHERE LastActivityAt > :Time", map[string]interface{}{"Time": time}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetTotalActiveUsersCount", "We could not count the users", err.Error())
		} else {
			result.Data = count
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) PermanentDelete(userId string, T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := us.GetMaster().Exec("DELETE FROM Users WHERE Id = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetByEmail", "We couldn't delete the existing account", "userId="+userId+", "+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (us SqlUserStore) GetUserStatusByEmails(emails []string, T goi18n.TranslateFunc) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var users []*model.User

		var args []interface{}
		for _, email := range emails {
			args = append(args, email)
		}

		query := "SELECT u.Id, u.TeamId, u.Email, t.name as AuthData FROM Users u INNER JOIN Teams t ON u.TeamId = t.Id AND u.Email IN (" + model.NumberedSqlElements(1, len(emails)) + ")"

		if _, err := us.GetReplica().Select(&users, query , args...); err != nil {
			result.Err = model.NewAppError("SqlUserStore.GetProfiles", T("We encounted an error while finding user profiles"), err.Error())
		} else {
			userMap := make(map[string]*model.User)

			for _, u := range users {
				userMap[u.Id] = u
			}
			result.Data = userMap
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
