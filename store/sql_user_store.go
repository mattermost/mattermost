// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
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
	us.CreateIndexIfNotExists("idx_team_id", "Users", "TeamId")
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

		if count, err := us.GetMaster().SelectInt("SELECT COUNT(0) FROM Users WHERE TeamId = ? AND DeleteAt = 0", user.TeamId); err != nil {
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
			if strings.Contains(err.Error(), "Duplicate entry") && strings.Contains(err.Error(), "for key 'Email'") {
				result.Err = model.NewAppError("SqlUserStore.Save", "An account with that email already exists.", "user_id="+user.Id+", "+err.Error())
			} else if strings.Contains(err.Error(), "Duplicate entry") && strings.Contains(err.Error(), "for key 'Username'") {
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

func (us SqlUserStore) Update(user *model.User, allowRoleActiveUpdate bool) StoreChannel {

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

			if !allowRoleActiveUpdate {
				user.Roles = oldUser.Roles
				user.DeleteAt = oldUser.DeleteAt
			}

			if user.Email != oldUser.Email {
				user.EmailVerified = false
			}

			if count, err := us.GetMaster().Update(user); err != nil {
				result.Err = model.NewAppError("SqlUserStore.Update", "We encounted an error updating the account", "user_id="+user.Id+", "+err.Error())
			} else if count != 1 {
				result.Err = model.NewAppError("SqlUserStore.Update", "We couldn't update the account", "user_id="+user.Id)
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

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastPingAt = ? WHERE Id = ?", time, userId); err != nil {
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

		if _, err := us.GetMaster().Exec("UPDATE Users SET LastActivityAt = ? WHERE Id = ?", time, userId); err != nil {
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

		if _, err := us.GetMaster().Exec("UPDATE Sessions, Users SET Users.LastActivityAt = ?, Sessions.LastActivityAt = ? WHERE Users.Id = ? AND Sessions.Id = ?", time, time, userId, sessionId); err != nil {
			result.Err = model.NewAppError("SqlUserStore.UpdateLastActivityAt", "We couldn't update the last_activity_at", "user_id="+userId+" session_id="+sessionId+" err="+err.Error())
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

		if _, err := us.GetMaster().Exec("UPDATE Users SET Password = ?, LastPasswordUpdate = ?, UpdateAt = ? WHERE Id = ?", hashedPassword, updateAt, updateAt, userId); err != nil {
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

		updateAt, err := s.GetReplica().SelectInt("SELECT UpdateAt FROM Users WHERE TeamId = ? ORDER BY UpdateAt DESC LIMIT 1", teamId)
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

		if _, err := us.GetReplica().Select(&users, "SELECT * FROM Users WHERE TeamId = ?", teamId); err != nil {
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

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE TeamId=? AND Email=?", teamId, email); err != nil {
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

		if err := us.GetReplica().SelectOne(&user, "SELECT * FROM Users WHERE TeamId=? AND Username=?", teamId, username); err != nil {
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

		if _, err := us.GetMaster().Exec("UPDATE Users SET EmailVerified = 1 WHERE Id = ?", userId); err != nil {
			result.Err = model.NewAppError("SqlUserStore.VerifyEmail", "Unable to update verify email field", "userId="+userId+", "+err.Error())
		}

		result.Data = userId

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
