// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
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
		table.ColMap("Email").SetMaxSize(128)
		table.ColMap("FullName").SetMaxSize(64)
		table.ColMap("Roles").SetMaxSize(64)
		table.ColMap("Props").SetMaxSize(4000)
		table.ColMap("NotifyProps").SetMaxSize(2000)
		table.SetUniqueTogether("Email", "TeamId")
		table.SetUniqueTogether("Username", "TeamId")
	}

	return us
}

func (s SqlUserStore) UpgradeSchemaIfNeeded() {
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
			result.Err = model.NewAppError("SqlUserStore.Save", "Must call update for exisiting user", "user_id="+user.Id)
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
			result.Err = model.NewAppError("SqlUserStore.Save", "Failed to get current team member count", "teamId="+user.TeamId+", "+err.Error())
			storeChannel <- result
			close(storeChannel)
			return
		} else if int(count) > utils.Cfg.TeamSettings.MaxUsersPerTeam {
			result.Err = model.NewAppError("SqlUserStore.Save", "You've reached the limit of the number of allowed accounts.", "teamId="+user.TeamId)
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := us.GetMaster().Insert(user); err != nil {
			if IsUniqueConstraintError(err.Error(), "Email", "users_email_teamid_key") {
				result.Err = model.NewAppError("SqlUserStore.Save", "An account with that email already exists.", "user_id="+user.Id+", "+err.Error())
			} else if IsUniqueConstraintError(err.Error(), "Username", "users_username_teamid_key") {
				result.Err = model.NewAppError("SqlUserStore.Save", "An account with that username already exists.", "user_id="+user.Id+", "+err.Error())
			} else {
				result.Err = model.NewAppError("SqlUserStore.Save", "We couldn't save the account.", "user_id="+user.Id+", "+err.Error())
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
			result.Err = model.NewAppError("SqlUserStore.Update", "We encounted an error finding the account", "user_id="+user.Id+", "+err.Error())
		} else if oldUserResult == nil {
			result.Err = model.NewAppError("SqlUserStore.Update", "We couldn't find the existing account to update", "user_id="+user.Id)
		} else {
			oldUser := oldUserResult.(*model.User)
			user.CreateAt = oldUser.CreateAt
			user.AuthData = oldUser.AuthData
			user.Password = oldUser.Password
			user.LastPasswordUpdate = oldUser.LastPasswordUpdate
			user.TeamId = oldUser.TeamId
			user.LastActivityAt = oldUser.LastActivityAt
			user.LastPingAt = oldUser.LastPingAt
			user.EmailVerified = oldUser.EmailVerified

			if !allowActiveUpdate {
				user.Roles = oldUser.Roles
				user.DeleteAt = oldUser.DeleteAt
			}

			if user.Email != oldUser.Email {
				user.EmailVerified = false
			}

			if count, err := us.GetMaster().Update(user); err != nil {
				result.Err = model.NewAppError("SqlUserStore.Update", "We encounted an error updating the account", "user_id="+user.Id+", "+err.Error())
			} else if count != 1 {
				result.Err = model.NewAppError("SqlUserStore.Update", "We couldn't update the account", fmt.Sprintf("user_id=%v, count=%v", user.Id, count))
			} else {
				result.Data = [2]*model.User{user, oldUser}
			}
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
			result.Err = model.NewAppError("SqlUserStore.UpdateLastPingAt", "We couldn't update the last_ping_at", "user_id="+userId)
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
			result.Err = model.NewAppError("SqlUserStore.UpdateLastActivityAt", "We couldn't update the last_activity_at", "user_id="+userId)
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
			result.Err = model.NewAppError("SqlUserStore.UpdateLastActivityAt", "We couldn't update the last_activity_at", "1 user_id="+userId+" session_id="+sessionId+" err="+err.Error())
		} else if _, err := us.GetMaster().Exec("UPDATE Sessions SET LastActivityAt = :SessionLastActivityAt WHERE Id = :SessionId", map[string]interface{}{"SessionLastActivityAt": time, "SessionId": sessionId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateLastActivityAt", "We couldn't update the last_activity_at", "2 user_id="+userId+" session_id="+sessionId+" err="+err.Error())
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

		if _, err := us.GetMaster().Exec("UPDATE Users SET Password = :Password, LastPasswordUpdate = :LastPasswordUpdate, UpdateAt = :UpdateAt WHERE Id = :UserId", map[string]interface{}{"Password": hashedPassword, "LastPasswordUpdate": updateAt, "UpdateAt": updateAt, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdatePassword", "We couldn't update the user password", "id="+userId+", "+err.Error())
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
			result.Err = model.NewAppError("SqlUserStore.Get", "We encounted an error finding the account", "user_id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewAppError("SqlUserStore.Get", "We couldn't find the existing account", "user_id="+id)
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
			result.Data = fmt.Sprintf("%v.%v", model.ETAG_ROOT_VERSION, model.GetMillis())
		} else {
			result.Data = fmt.Sprintf("%v.%v", model.ETAG_ROOT_VERSION, updateAt)
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
			result.Err = model.NewAppError("SqlUserStore.GetProfiles", "We encounted an error while finding user profiles", err.Error())
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
			result.Err = model.NewAppError("SqlUserStore.GetByEmail", "We couldn't find the existing account", "teamId="+teamId+", email="+email+", "+err.Error())
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
			result.Err = model.NewAppError("SqlUserStore.GetByUsername", "We couldn't find the existing account", "teamId="+teamId+", username="+username+", "+err.Error())
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
			result.Err = model.NewAppError("SqlUserStore.VerifyEmail", "Unable to update verify email field", "userId="+userId+", "+err.Error())
		}

		result.Data = userId

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
