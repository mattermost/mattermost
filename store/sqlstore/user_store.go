// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/Masterminds/squirrel"
	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/gorp"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	MAX_GROUP_CHANNELS_FOR_PROFILES = 50
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

	// usersQuery is a starting point for all queries that return one or more Users.
	usersQuery sq.SelectBuilder
}

func (us SqlUserStore) ClearCaches() {}

func (us SqlUserStore) InvalidateProfileCacheForUser(userId string) {}

func NewSqlUserStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.UserStore {
	us := &SqlUserStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	us.usersQuery = us.getQueryBuilder().
		Select("u.*", "b.UserId IS NOT NULL AS IsBot", "COALESCE(b.Description, '') AS BotDescription", "COALESCE(b.LastIconUpdate, 0) AS BotLastIconUpdate").
		From("Users u").
		LeftJoin("Bots b ON ( b.UserId = u.Id )")

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
		us.CreateIndexIfNotExists("idx_users_email_lower_textpattern", "Users", "lower(Email) text_pattern_ops")
		us.CreateIndexIfNotExists("idx_users_username_lower_textpattern", "Users", "lower(Username) text_pattern_ops")
		us.CreateIndexIfNotExists("idx_users_nickname_lower_textpattern", "Users", "lower(Nickname) text_pattern_ops")
		us.CreateIndexIfNotExists("idx_users_firstname_lower_textpattern", "Users", "lower(FirstName) text_pattern_ops")
		us.CreateIndexIfNotExists("idx_users_lastname_lower_textpattern", "Users", "lower(LastName) text_pattern_ops")
	}

	us.CreateFullTextIndexIfNotExists("idx_users_all_txt", "Users", strings.Join(USER_SEARCH_TYPE_ALL, ", "))
	us.CreateFullTextIndexIfNotExists("idx_users_all_no_full_name_txt", "Users", strings.Join(USER_SEARCH_TYPE_ALL_NO_FULL_NAME, ", "))
	us.CreateFullTextIndexIfNotExists("idx_users_names_txt", "Users", strings.Join(USER_SEARCH_TYPE_NAMES, ", "))
	us.CreateFullTextIndexIfNotExists("idx_users_names_no_full_name_txt", "Users", strings.Join(USER_SEARCH_TYPE_NAMES_NO_FULL_NAME, ", "))
}

func (us SqlUserStore) Save(user *model.User) (*model.User, *model.AppError) {
	if len(user.Id) > 0 {
		return nil, model.NewAppError("SqlUserStore.Save", "store.sql_user.save.existing.app_error", nil, "user_id="+user.Id, http.StatusBadRequest)
	}

	user.PreSave()
	if err := user.IsValid(); err != nil {
		return nil, err
	}

	if err := us.GetMaster().Insert(user); err != nil {
		if IsUniqueConstraintError(err, []string{"Email", "users_email_key", "idx_users_email_unique"}) {
			return nil, model.NewAppError("SqlUserStore.Save", "store.sql_user.save.email_exists.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
		}
		if IsUniqueConstraintError(err, []string{"Username", "users_username_key", "idx_users_username_unique"}) {
			return nil, model.NewAppError("SqlUserStore.Save", "store.sql_user.save.username_exists.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
		}
		return nil, model.NewAppError("SqlUserStore.Save", "store.sql_user.save.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	return user, nil
}

func (us SqlUserStore) DeactivateGuests() ([]string, *model.AppError) {
	curTime := model.GetMillis()
	updateQuery := us.getQueryBuilder().Update("Users").
		Set("UpdateAt", curTime).
		Set("DeleteAt", curTime).
		Where(sq.Eq{"Roles": "system_guest"}).
		Where(sq.Eq{"DeleteAt": 0})

	queryString, args, err := updateQuery.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.UpdateActiveForMultipleUsers", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	_, err = us.GetMaster().Exec(queryString, args...)
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.UpdateActiveForMultipleUsers", "store.sql_user.update_active_for_multiple_users.updating.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	selectQuery := us.getQueryBuilder().Select("Id").From("Users").Where(sq.Eq{"DeleteAt": curTime})

	queryString, args, err = selectQuery.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.UpdateActiveForMultipleUsers", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	userIds := []string{}
	_, err = us.GetMaster().Select(&userIds, queryString, args...)
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.UpdateActiveForMultipleUsers", "store.sql_user.update_active_for_multiple_users.getting_changed_users.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return userIds, nil
}

func (us SqlUserStore) Update(user *model.User, trustedUpdateData bool) (*model.UserUpdate, *model.AppError) {
	user.PreUpdate()

	if err := user.IsValid(); err != nil {
		return nil, err
	}

	oldUserResult, err := us.GetMaster().Get(model.User{}, user.Id)
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.Update", "store.sql_user.update.finding.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	if oldUserResult == nil {
		return nil, model.NewAppError("SqlUserStore.Update", "store.sql_user.update.find.app_error", nil, "user_id="+user.Id, http.StatusBadRequest)
	}

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
		if user.Username != oldUser.Username || user.Email != oldUser.Email {
			return nil, model.NewAppError("SqlUserStore.Update", "store.sql_user.update.can_not_change_ldap.app_error", nil, "user_id="+user.Id, http.StatusBadRequest)
		}
	} else if user.Email != oldUser.Email {
		user.EmailVerified = false
	}

	if user.Username != oldUser.Username {
		user.UpdateMentionKeysFromUsername(oldUser.Username)
	}

	count, err := us.GetMaster().Update(user)
	if err != nil {
		if IsUniqueConstraintError(err, []string{"Email", "users_email_key", "idx_users_email_unique"}) {
			return nil, model.NewAppError("SqlUserStore.Update", "store.sql_user.update.email_taken.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
		}
		if IsUniqueConstraintError(err, []string{"Username", "users_username_key", "idx_users_username_unique"}) {
			return nil, model.NewAppError("SqlUserStore.Update", "store.sql_user.update.username_taken.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusBadRequest)
		}
		return nil, model.NewAppError("SqlUserStore.Update", "store.sql_user.update.updating.app_error", nil, "user_id="+user.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	if count != 1 {
		return nil, model.NewAppError("SqlUserStore.Update", "store.sql_user.update.app_error", nil, fmt.Sprintf("user_id=%v, count=%v", user.Id, count), http.StatusInternalServerError)
	}

	user.Sanitize(map[string]bool{})
	oldUser.Sanitize(map[string]bool{})
	return &model.UserUpdate{New: user, Old: oldUser}, nil
}

func (us SqlUserStore) UpdateLastPictureUpdate(userId string) *model.AppError {
	curTime := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET LastPictureUpdate = :Time, UpdateAt = :Time WHERE Id = :UserId", map[string]interface{}{"Time": curTime, "UserId": userId}); err != nil {
		return model.NewAppError("SqlUserStore.UpdateLastPictureUpdate", "store.sql_user.update_last_picture_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	return nil
}

func (us SqlUserStore) ResetLastPictureUpdate(userId string) *model.AppError {
	curTime := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET LastPictureUpdate = :PictureUpdateTime, UpdateAt = :UpdateTime WHERE Id = :UserId", map[string]interface{}{"PictureUpdateTime": 0, "UpdateTime": curTime, "UserId": userId}); err != nil {
		return model.NewAppError("SqlUserStore.ResetLastPictureUpdate", "store.sql_user.update_last_picture_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	return nil
}

func (us SqlUserStore) UpdateUpdateAt(userId string) (int64, *model.AppError) {
	curTime := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET UpdateAt = :Time WHERE Id = :UserId", map[string]interface{}{"Time": curTime, "UserId": userId}); err != nil {
		return curTime, model.NewAppError("SqlUserStore.UpdateUpdateAt", "store.sql_user.update_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	return curTime, nil
}

func (us SqlUserStore) UpdatePassword(userId, hashedPassword string) *model.AppError {
	updateAt := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET Password = :Password, LastPasswordUpdate = :LastPasswordUpdate, UpdateAt = :UpdateAt, AuthData = NULL, AuthService = '', FailedAttempts = 0 WHERE Id = :UserId", map[string]interface{}{"Password": hashedPassword, "LastPasswordUpdate": updateAt, "UpdateAt": updateAt, "UserId": userId}); err != nil {
		return model.NewAppError("SqlUserStore.UpdatePassword", "store.sql_user.update_password.app_error", nil, "id="+userId+", "+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (us SqlUserStore) UpdateFailedPasswordAttempts(userId string, attempts int) *model.AppError {
	if _, err := us.GetMaster().Exec("UPDATE Users SET FailedAttempts = :FailedAttempts WHERE Id = :UserId", map[string]interface{}{"FailedAttempts": attempts, "UserId": userId}); err != nil {
		return model.NewAppError("SqlUserStore.UpdateFailedPasswordAttempts", "store.sql_user.update_failed_pwd_attempts.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	return nil
}

func (us SqlUserStore) UpdateAuthData(userId string, service string, authData *string, email string, resetMfa bool) (string, *model.AppError) {
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
			return "", model.NewAppError("SqlUserStore.UpdateAuthData", "store.sql_user.update_auth_data.email_exists.app_error", map[string]interface{}{"Service": service, "Email": email}, "user_id="+userId+", "+err.Error(), http.StatusBadRequest)
		}
		return "", model.NewAppError("SqlUserStore.UpdateAuthData", "store.sql_user.update_auth_data.app_error", nil, "id="+userId+", "+err.Error(), http.StatusInternalServerError)
	}
	return userId, nil
}

func (us SqlUserStore) UpdateMfaSecret(userId, secret string) *model.AppError {
	updateAt := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET MfaSecret = :Secret, UpdateAt = :UpdateAt WHERE Id = :UserId", map[string]interface{}{"Secret": secret, "UpdateAt": updateAt, "UserId": userId}); err != nil {
		return model.NewAppError("SqlUserStore.UpdateMfaSecret", "store.sql_user.update_mfa_secret.app_error", nil, "id="+userId+", "+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (us SqlUserStore) UpdateMfaActive(userId string, active bool) *model.AppError {
	updateAt := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET MfaActive = :Active, UpdateAt = :UpdateAt WHERE Id = :UserId", map[string]interface{}{"Active": active, "UpdateAt": updateAt, "UserId": userId}); err != nil {
		return model.NewAppError("SqlUserStore.UpdateMfaActive", "store.sql_user.update_mfa_active.app_error", nil, "id="+userId+", "+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (us SqlUserStore) Get(id string) (*model.User, *model.AppError) {
	query := us.usersQuery.Where("Id = ?", id)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.Get", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	user := &model.User{}
	if err := us.GetReplica().SelectOne(user, queryString, args...); err == sql.ErrNoRows {
		return nil, model.NewAppError("SqlUserStore.Get", store.MISSING_ACCOUNT_ERROR, nil, "user_id="+id, http.StatusNotFound)
	} else if err != nil {
		return nil, model.NewAppError("SqlUserStore.Get", "store.sql_user.get.app_error", nil, "user_id="+id+", "+err.Error(), http.StatusInternalServerError)
	}

	return user, nil
}

func (us SqlUserStore) GetAll() ([]*model.User, *model.AppError) {
	query := us.usersQuery.OrderBy("Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAll", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var data []*model.User
	if _, err := us.GetReplica().Select(&data, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAll", "store.sql_user.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return data, nil
}

func (us SqlUserStore) GetAllAfter(limit int, afterId string) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		Where("Id > ?", afterId).
		OrderBy("Id ASC").
		Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAllAfter", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAllAfter", "store.sql_user.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

func (us SqlUserStore) GetEtagForAllProfiles() string {
	updateAt, err := us.GetReplica().SelectInt("SELECT UpdateAt FROM Users ORDER BY UpdateAt DESC LIMIT 1")
	if err != nil {
		return fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
	}
	return fmt.Sprintf("%v.%v", model.CurrentVersion, updateAt)
}

func (us SqlUserStore) GetAllProfiles(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	isPostgreSQL := us.DriverName() == model.DATABASE_DRIVER_POSTGRES
	query := us.usersQuery.
		OrderBy("u.Username ASC").
		Offset(uint64(options.Page * options.PerPage)).Limit(uint64(options.PerPage))

	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, true)

	query = applyRoleFilter(query, options.Role, isPostgreSQL)

	if options.Inactive {
		query = query.Where("u.DeleteAt != 0")
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAllProfiles", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAllProfiles", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func applyRoleFilter(query sq.SelectBuilder, role string, isPostgreSQL bool) sq.SelectBuilder {
	if role == "" {
		return query
	}

	if isPostgreSQL {
		roleParam := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(role, "\\"))
		return query.Where("u.Roles LIKE LOWER(?)", roleParam)
	}

	roleParam := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(role, "*"))

	return query.Where("u.Roles LIKE ? ESCAPE '*'", roleParam)
}

func applyChannelGroupConstrainedFilter(query sq.SelectBuilder, channelId string) sq.SelectBuilder {
	if channelId == "" {
		return query
	}

	return query.
		Where(`u.Id IN (
				SELECT
					GroupMembers.UserId
				FROM
					Channels
					JOIN GroupChannels ON GroupChannels.ChannelId = Channels.Id
					JOIN UserGroups ON UserGroups.Id = GroupChannels.GroupId
					JOIN GroupMembers ON GroupMembers.GroupId = UserGroups.Id
				WHERE
					Channels.Id = ?
					AND GroupChannels.DeleteAt = 0
					AND UserGroups.DeleteAt = 0
					AND GroupMembers.DeleteAt = 0
				GROUP BY
					GroupMembers.UserId
			)`, channelId)
}

func applyTeamGroupConstrainedFilter(query sq.SelectBuilder, teamId string) sq.SelectBuilder {
	if teamId == "" {
		return query
	}

	return query.
		Where(`u.Id IN (
				SELECT
					GroupMembers.UserId
				FROM
					Teams
					JOIN GroupTeams ON GroupTeams.TeamId = Teams.Id
					JOIN UserGroups ON UserGroups.Id = GroupTeams.GroupId
					JOIN GroupMembers ON GroupMembers.GroupId = UserGroups.Id
				WHERE
					Teams.Id = ?
					AND GroupTeams.DeleteAt = 0
					AND UserGroups.DeleteAt = 0
					AND GroupMembers.DeleteAt = 0
				GROUP BY
					GroupMembers.UserId
			)`, teamId)
}

func (us SqlUserStore) GetEtagForProfiles(teamId string) string {
	updateAt, err := us.GetReplica().SelectInt("SELECT UpdateAt FROM Users, TeamMembers WHERE TeamMembers.TeamId = :TeamId AND Users.Id = TeamMembers.UserId ORDER BY UpdateAt DESC LIMIT 1", map[string]interface{}{"TeamId": teamId})
	if err != nil {
		return fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
	}
	return fmt.Sprintf("%v.%v", model.CurrentVersion, updateAt)
}

func (us SqlUserStore) GetProfiles(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	isPostgreSQL := us.DriverName() == model.DATABASE_DRIVER_POSTGRES
	query := us.usersQuery.
		Join("TeamMembers tm ON ( tm.UserId = u.Id AND tm.DeleteAt = 0 )").
		Where("tm.TeamId = ?", options.InTeamId).
		OrderBy("u.Username ASC").
		Offset(uint64(options.Page * options.PerPage)).Limit(uint64(options.PerPage))

	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, true)

	query = applyRoleFilter(query, options.Role, isPostgreSQL)

	if options.Inactive {
		query = query.Where("u.DeleteAt != 0")
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfiles", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfiles", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) InvalidateProfilesInChannelCacheByUser(userId string) {}

func (us SqlUserStore) InvalidateProfilesInChannelCache(channelId string) {}

func (us SqlUserStore) GetProfilesInChannel(channelId string, offset int, limit int) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		Join("ChannelMembers cm ON ( cm.UserId = u.Id )").
		Where("cm.ChannelId = ?", channelId).
		OrderBy("u.Username ASC").
		Offset(uint64(offset)).Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesInChannel", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesInChannel", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetProfilesInChannelByStatus(channelId string, offset int, limit int) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		Join("ChannelMembers cm ON ( cm.UserId = u.Id )").
		LeftJoin("Status s ON ( s.UserId = u.Id )").
		Where("cm.ChannelId = ?", channelId).
		OrderBy(`
			CASE s.Status
				WHEN 'online' THEN 1
				WHEN 'away' THEN 2
				WHEN 'dnd' THEN 3
				ELSE 4
			END
			`).
		OrderBy("u.Username ASC").
		Offset(uint64(offset)).Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesInChannelByStatus", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesInChannelByStatus", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetAllProfilesInChannel(channelId string, allowFromCache bool) (map[string]*model.User, *model.AppError) {
	query := us.usersQuery.
		Join("ChannelMembers cm ON ( cm.UserId = u.Id )").
		Where("cm.ChannelId = ?", channelId).
		Where("u.DeleteAt = 0").
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAllProfilesInChannel", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAllProfilesInChannel", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	userMap := make(map[string]*model.User)

	for _, u := range users {
		u.Sanitize(map[string]bool{})
		userMap[u.Id] = u
	}

	return userMap, nil
}

func (us SqlUserStore) GetProfilesNotInChannel(teamId string, channelId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		Join("TeamMembers tm ON ( tm.UserId = u.Id AND tm.DeleteAt = 0 AND tm.TeamId = ? )", teamId).
		LeftJoin("ChannelMembers cm ON ( cm.UserId = u.Id AND cm.ChannelId = ? )", channelId).
		Where("cm.UserId IS NULL").
		OrderBy("u.Username ASC").
		Offset(uint64(offset)).Limit(uint64(limit))

	query = applyViewRestrictionsFilter(query, viewRestrictions, true)

	if groupConstrained {
		query = applyChannelGroupConstrainedFilter(query, channelId)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesNotInChannel", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesNotInChannel", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetProfilesWithoutTeam(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	isPostgreSQL := us.DriverName() == model.DATABASE_DRIVER_POSTGRES
	query := us.usersQuery.
		Where(`(
			SELECT
				COUNT(0)
			FROM
				TeamMembers
			WHERE
				TeamMembers.UserId = u.Id
				AND TeamMembers.DeleteAt = 0
		) = 0`).
		OrderBy("u.Username ASC").
		Offset(uint64(options.Page * options.PerPage)).Limit(uint64(options.PerPage))

	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, true)

	query = applyRoleFilter(query, options.Role, isPostgreSQL)

	if options.Inactive {
		query = query.Where("u.DeleteAt != 0")
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesWithoutTeam", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesWithoutTeam", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetProfilesByUsernames(usernames []string, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	query := us.usersQuery

	query = applyViewRestrictionsFilter(query, viewRestrictions, true)

	query = query.
		Where(map[string]interface{}{
			"Username": usernames,
		}).
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesByUsernames", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesByUsernames", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

type UserWithLastActivityAt struct {
	model.User
	LastActivityAt int64
}

func (us SqlUserStore) GetRecentlyActiveUsersForTeam(teamId string, offset, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		Column("s.LastActivityAt").
		Join("TeamMembers tm ON (tm.UserId = u.Id AND tm.TeamId = ?)", teamId).
		Join("Status s ON (s.UserId = u.Id)").
		OrderBy("s.LastActivityAt DESC").
		OrderBy("u.Username ASC").
		Offset(uint64(offset)).Limit(uint64(limit))

	query = applyViewRestrictionsFilter(query, viewRestrictions, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetRecentlyActiveUsers", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*UserWithLastActivityAt
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetRecentlyActiveUsers", "store.sql_user.get_recently_active_users.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	userList := []*model.User{}

	for _, userWithLastActivityAt := range users {
		u := userWithLastActivityAt.User
		u.Sanitize(map[string]bool{})
		u.LastActivityAt = userWithLastActivityAt.LastActivityAt
		userList = append(userList, &u)
	}

	return userList, nil
}

func (us SqlUserStore) GetNewUsersForTeam(teamId string, offset, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		Join("TeamMembers tm ON (tm.UserId = u.Id AND tm.TeamId = ?)", teamId).
		OrderBy("u.CreateAt DESC").
		OrderBy("u.Username ASC").
		Offset(uint64(offset)).Limit(uint64(limit))

	query = applyViewRestrictionsFilter(query, viewRestrictions, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetNewUsersForTeam", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetNewUsersForTeam", "store.sql_user.get_new_users.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetProfileByIds(userIds []string, options *store.UserGetByIdsOpts, _ bool) ([]*model.User, *model.AppError) {
	if options == nil {
		options = &store.UserGetByIdsOpts{}
	}

	users := []*model.User{}
	query := us.usersQuery.
		Where(map[string]interface{}{
			"u.Id": userIds,
		}).
		OrderBy("u.Username ASC")

	if options.Since > 0 {
		query = query.Where(squirrel.Gt(map[string]interface{}{
			"u.UpdateAt": options.Since,
		}))
	}

	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfileByIds", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfileByIds", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

type UserWithChannel struct {
	model.User
	ChannelId string
}

func (us SqlUserStore) GetProfileByGroupChannelIdsForUser(userId string, channelIds []string) (map[string][]*model.User, *model.AppError) {
	if len(channelIds) > MAX_GROUP_CHANNELS_FOR_PROFILES {
		channelIds = channelIds[0:MAX_GROUP_CHANNELS_FOR_PROFILES]
	}

	isMemberQuery := fmt.Sprintf(`
      EXISTS(
        SELECT
          1
        FROM
          ChannelMembers
        WHERE
          UserId = '%s'
        AND
          ChannelId = cm.ChannelId
        )`, userId)

	query := us.getQueryBuilder().
		Select("u.*, cm.ChannelId").
		From("Users u").
		Join("ChannelMembers cm ON u.Id = cm.UserId").
		Join("Channels c ON cm.ChannelId = c.Id").
		Where(sq.Eq{"c.Type": model.CHANNEL_GROUP, "cm.ChannelId": channelIds}).
		Where(isMemberQuery).
		Where(sq.NotEq{"u.Id": userId}).
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfileByGroupChannelIdsForUser", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	usersWithChannel := []*UserWithChannel{}
	if _, err := us.GetReplica().Select(&usersWithChannel, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfileByGroupChannelIdsForUser", "store.sql_user.get_profile_by_group_channel_ids_for_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	usersByChannelId := map[string][]*model.User{}
	for _, user := range usersWithChannel {
		if val, ok := usersByChannelId[user.ChannelId]; ok {
			usersByChannelId[user.ChannelId] = append(val, &user.User)
		} else {
			usersByChannelId[user.ChannelId] = []*model.User{&user.User}
		}
	}

	return usersByChannelId, nil
}

func (us SqlUserStore) GetSystemAdminProfiles() (map[string]*model.User, *model.AppError) {
	query := us.usersQuery.
		Where("Roles LIKE ?", "%system_admin%").
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetSystemAdminProfiles", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetSystemAdminProfiles", "store.sql_user.get_sysadmin_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	userMap := make(map[string]*model.User)

	for _, u := range users {
		u.Sanitize(map[string]bool{})
		userMap[u.Id] = u
	}

	return userMap, nil
}

func (us SqlUserStore) GetByEmail(email string) (*model.User, *model.AppError) {
	email = strings.ToLower(email)

	query := us.usersQuery.Where("Email = ?", email)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetByEmail", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	user := model.User{}
	if err := us.GetReplica().SelectOne(&user, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetByEmail", store.MISSING_ACCOUNT_ERROR, nil, "email="+email+", "+err.Error(), http.StatusInternalServerError)
	}

	return &user, nil
}

func (us SqlUserStore) GetByAuth(authData *string, authService string) (*model.User, *model.AppError) {
	if authData == nil || *authData == "" {
		return nil, model.NewAppError("SqlUserStore.GetByAuth", store.MISSING_AUTH_ACCOUNT_ERROR, nil, "authData='', authService="+authService, http.StatusBadRequest)
	}

	query := us.usersQuery.
		Where("u.AuthData = ?", authData).
		Where("u.AuthService = ?", authService)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetByAuth", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	user := model.User{}
	if err := us.GetReplica().SelectOne(&user, queryString, args...); err == sql.ErrNoRows {
		return nil, model.NewAppError("SqlUserStore.GetByAuth", store.MISSING_AUTH_ACCOUNT_ERROR, nil, "authData="+*authData+", authService="+authService+", "+err.Error(), http.StatusInternalServerError)
	} else if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetByAuth", "store.sql_user.get_by_auth.other.app_error", nil, "authData="+*authData+", authService="+authService+", "+err.Error(), http.StatusInternalServerError)
	}
	return &user, nil
}

func (us SqlUserStore) GetAllUsingAuthService(authService string) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		Where("u.AuthService = ?", authService).
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAllUsingAuthService", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetAllUsingAuthService", "store.sql_user.get_by_auth.other.app_error", nil, "authService="+authService+", "+err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

func (us SqlUserStore) GetByUsername(username string) (*model.User, *model.AppError) {
	query := us.usersQuery.Where("u.Username = ?", username)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetByUsername", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var user *model.User
	if err := us.GetReplica().SelectOne(&user, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetByUsername", "store.sql_user.get_by_username.app_error", nil, err.Error()+" -- "+queryString, http.StatusInternalServerError)
	}

	return user, nil
}

func (us SqlUserStore) GetForLogin(loginId string, allowSignInWithUsername, allowSignInWithEmail bool) (*model.User, *model.AppError) {
	query := us.usersQuery
	if allowSignInWithUsername && allowSignInWithEmail {
		query = query.Where("Username = ? OR Email = ?", loginId, loginId)
	} else if allowSignInWithUsername {
		query = query.Where("Username = ?", loginId)
	} else if allowSignInWithEmail {
		query = query.Where("Email = ?", loginId)
	} else {
		return nil, model.NewAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.app_error", nil, "", http.StatusInternalServerError)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetForLogin", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	users := []*model.User{}
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if len(users) == 0 {
		return nil, model.NewAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.app_error", nil, "", http.StatusInternalServerError)
	}

	if len(users) > 1 {
		return nil, model.NewAppError("SqlUserStore.GetForLogin", "store.sql_user.get_for_login.multiple_users", nil, "", http.StatusInternalServerError)
	}

	return users[0], nil

}

func (us SqlUserStore) VerifyEmail(userId, email string) (string, *model.AppError) {
	curTime := model.GetMillis()
	if _, err := us.GetMaster().Exec("UPDATE Users SET Email = :email, EmailVerified = true, UpdateAt = :Time WHERE Id = :UserId", map[string]interface{}{"email": email, "Time": curTime, "UserId": userId}); err != nil {
		return "", model.NewAppError("SqlUserStore.VerifyEmail", "store.sql_user.verify_email.app_error", nil, "userId="+userId+", "+err.Error(), http.StatusInternalServerError)
	}

	return userId, nil
}

func (us SqlUserStore) PermanentDelete(userId string) *model.AppError {
	if _, err := us.GetMaster().Exec("DELETE FROM Users WHERE Id = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
		return model.NewAppError("SqlUserStore.PermanentDelete", "store.sql_user.permanent_delete.app_error", nil, "userId="+userId+", "+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (us SqlUserStore) Count(options model.UserCountOptions) (int64, *model.AppError) {
	query := us.getQueryBuilder().Select("COUNT(DISTINCT u.Id)").From("Users AS u")

	if !options.IncludeDeleted {
		query = query.Where("u.DeleteAt = 0")
	}

	if options.IncludeBotAccounts {
		if options.ExcludeRegularUsers {
			query = query.Join("Bots ON u.Id = Bots.UserId")
		}
	} else {
		query = query.LeftJoin("Bots ON u.Id = Bots.UserId").Where("Bots.UserId IS NULL")
		if options.ExcludeRegularUsers {
			// Currenty this doesn't make sense because it will always return 0
			return int64(0), model.NewAppError("SqlUserStore.Count", "store.sql_user.count.app_error", nil, "", http.StatusInternalServerError)
		}
	}

	if options.TeamId != "" {
		query = query.LeftJoin("TeamMembers AS tm ON u.Id = tm.UserId").Where("tm.TeamId = ? AND tm.DeleteAt = 0", options.TeamId)
	}
	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, false)

	if us.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = query.PlaceholderFormat(sq.Dollar)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return int64(0), model.NewAppError("SqlUserStore.Get", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	count, err := us.GetReplica().SelectInt(queryString, args...)
	if err != nil {
		return int64(0), model.NewAppError("SqlUserStore.Count", "store.sql_user.get_total_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (us SqlUserStore) AnalyticsActiveCount(timePeriod int64, options model.UserCountOptions) (int64, *model.AppError) {

	time := model.GetMillis() - timePeriod
	query := us.getQueryBuilder().Select("COUNT(*)").From("Status AS s").Where("LastActivityAt > :Time", map[string]interface{}{"Time": time})

	if !options.IncludeBotAccounts {
		query = query.LeftJoin("Bots ON s.UserId = Bots.UserId").Where("Bots.UserId IS NULL")
	}

	if !options.IncludeDeleted {
		query = query.LeftJoin("Users ON s.UserId = Users.Id").Where("Users.DeleteAt = 0")
	}

	queryStr, args, err := query.ToSql()

	if err != nil {
		return 0, model.NewAppError("SqlUserStore.Get", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	v, err := us.GetReplica().SelectInt(queryStr, args...)
	if err != nil {
		return 0, model.NewAppError("SqlUserStore.AnalyticsDailyActiveUsers", "store.sql_user.analytics_daily_active_users.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return v, nil
}

func (us SqlUserStore) GetUnreadCount(userId string) (int64, *model.AppError) {
	query := `
		SELECT SUM(CASE WHEN c.Type = 'D' THEN (c.TotalMsgCount - cm.MsgCount) ELSE cm.MentionCount END)
		FROM Channels c
		INNER JOIN ChannelMembers cm
			ON cm.ChannelId = c.Id
			AND cm.UserId = :UserId
			AND c.DeleteAt = 0
	`
	count, err := us.GetReplica().SelectInt(query, map[string]interface{}{"UserId": userId})
	if err != nil {
		return count, model.NewAppError("SqlUserStore.GetMentionCount", "store.sql_user.get_unread_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return count, nil
}

func (us SqlUserStore) GetUnreadCountForChannel(userId string, channelId string) (int64, *model.AppError) {
	count, err := us.GetReplica().SelectInt("SELECT SUM(CASE WHEN c.Type = 'D' THEN (c.TotalMsgCount - cm.MsgCount) ELSE cm.MentionCount END) FROM Channels c INNER JOIN ChannelMembers cm ON c.Id = cm.ChannelId AND cm.ChannelId = :ChannelId AND cm.UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId})
	if err != nil {
		return 0, model.NewAppError("SqlUserStore.GetMentionCountForChannel", "store.sql_user.get_unread_count_for_channel.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (us SqlUserStore) GetAnyUnreadPostCountForChannel(userId string, channelId string) (int64, *model.AppError) {
	count, err := us.GetReplica().SelectInt("SELECT SUM(c.TotalMsgCount - cm.MsgCount) FROM Channels c INNER JOIN ChannelMembers cm ON c.Id = cm.ChannelId AND cm.ChannelId = :ChannelId AND cm.UserId = :UserId", map[string]interface{}{"ChannelId": channelId, "UserId": userId})
	if err != nil {
		return count, model.NewAppError("SqlUserStore.GetMentionCountForChannel", "store.sql_user.get_unread_count_for_channel.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (us SqlUserStore) Search(teamId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		OrderBy("Username ASC").
		Limit(uint64(options.Limit))

	if teamId != "" {
		query = query.Join("TeamMembers tm ON ( tm.UserId = u.Id AND tm.DeleteAt = 0 AND tm.TeamId = ? )", teamId)
	}
	return us.performSearch(query, term, options)
}

func (us SqlUserStore) SearchWithoutTeam(term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		Where(`(
				SELECT
					COUNT(0)
				FROM
					TeamMembers
				WHERE
					TeamMembers.UserId = u.Id
					AND TeamMembers.DeleteAt = 0
			) = 0`).
		OrderBy("u.Username ASC").
		Limit(uint64(options.Limit))

	return us.performSearch(query, term, options)
}

func (us SqlUserStore) SearchNotInTeam(notInTeamId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		LeftJoin("TeamMembers tm ON ( tm.UserId = u.Id AND tm.DeleteAt = 0 AND tm.TeamId = ? )", notInTeamId).
		Where("tm.UserId IS NULL").
		OrderBy("u.Username ASC").
		Limit(uint64(options.Limit))

	if options.GroupConstrained {
		query = applyTeamGroupConstrainedFilter(query, notInTeamId)
	}

	return us.performSearch(query, term, options)
}

func (us SqlUserStore) SearchNotInChannel(teamId string, channelId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		LeftJoin("ChannelMembers cm ON ( cm.UserId = u.Id AND cm.ChannelId = ? )", channelId).
		Where("cm.UserId IS NULL").
		OrderBy("Username ASC").
		Limit(uint64(options.Limit))

	if teamId != "" {
		query = query.Join("TeamMembers tm ON ( tm.UserId = u.Id AND tm.DeleteAt = 0 AND tm.TeamId = ? )", teamId)
	}

	if options.GroupConstrained {
		query = applyChannelGroupConstrainedFilter(query, channelId)
	}

	return us.performSearch(query, term, options)
}

func (us SqlUserStore) SearchInChannel(channelId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	query := us.usersQuery.
		Join("ChannelMembers cm ON ( cm.UserId = u.Id AND cm.ChannelId = ? )", channelId).
		OrderBy("Username ASC").
		Limit(uint64(options.Limit))

	return us.performSearch(query, term, options)
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

func generateSearchQuery(query sq.SelectBuilder, terms []string, fields []string, isPostgreSQL bool) sq.SelectBuilder {
	for _, term := range terms {
		searchFields := []string{}
		termArgs := []interface{}{}
		for _, field := range fields {
			if isPostgreSQL {
				searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(?) escape '*' ", field))
			} else {
				searchFields = append(searchFields, fmt.Sprintf("%s LIKE ? escape '*' ", field))
			}
			termArgs = append(termArgs, fmt.Sprintf("%s%%", strings.TrimLeft(term, "@")))
		}
		query = query.Where(fmt.Sprintf("(%s)", strings.Join(searchFields, " OR ")), termArgs...)
	}

	return query
}

func (us SqlUserStore) performSearch(query sq.SelectBuilder, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = sanitizeSearchTerm(term, "*")

	var searchType []string
	if options.AllowEmails {
		if options.AllowFullNames {
			searchType = USER_SEARCH_TYPE_ALL
		} else {
			searchType = USER_SEARCH_TYPE_ALL_NO_FULL_NAME
		}
	} else {
		if options.AllowFullNames {
			searchType = USER_SEARCH_TYPE_NAMES
		} else {
			searchType = USER_SEARCH_TYPE_NAMES_NO_FULL_NAME
		}
	}

	isPostgreSQL := us.DriverName() == model.DATABASE_DRIVER_POSTGRES

	query = applyRoleFilter(query, options.Role, isPostgreSQL)

	if !options.AllowInactive {
		query = query.Where("u.DeleteAt = 0")
	}

	if strings.TrimSpace(term) != "" {
		query = generateSearchQuery(query, strings.Fields(term), searchType, isPostgreSQL)
	}

	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.Search", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.Search", "store.sql_user.search.app_error", nil,
			fmt.Sprintf("term=%v, search_type=%v, %v", term, searchType, err.Error()), http.StatusInternalServerError)
	}
	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) AnalyticsGetInactiveUsersCount() (int64, *model.AppError) {
	count, err := us.GetReplica().SelectInt("SELECT COUNT(Id) FROM Users WHERE DeleteAt > 0")
	if err != nil {
		return int64(0), model.NewAppError("SqlUserStore.AnalyticsGetInactiveUsersCount", "store.sql_user.analytics_get_inactive_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (us SqlUserStore) AnalyticsGetSystemAdminCount() (int64, *model.AppError) {
	count, err := us.GetReplica().SelectInt("SELECT count(*) FROM Users WHERE Roles LIKE :Roles and DeleteAt = 0", map[string]interface{}{"Roles": "%system_admin%"})
	if err != nil {
		return int64(0), model.NewAppError("SqlUserStore.AnalyticsGetSystemAdminCount", "store.sql_user.analytics_get_system_admin_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (us SqlUserStore) GetProfilesNotInTeam(teamId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	var users []*model.User
	query := us.usersQuery.
		LeftJoin("TeamMembers tm ON ( tm.UserId = u.Id AND tm.DeleteAt = 0 AND tm.TeamId = ? )", teamId).
		Where("tm.UserId IS NULL").
		OrderBy("u.Username ASC").
		Offset(uint64(offset)).Limit(uint64(limit))

	query = applyViewRestrictionsFilter(query, viewRestrictions, true)

	if groupConstrained {
		query = applyTeamGroupConstrainedFilter(query, teamId)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesNotInTeam", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetProfilesNotInTeam", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}
	return users, nil
}

func (us SqlUserStore) GetEtagForProfilesNotInTeam(teamId string) string {
	querystr := `
		SELECT
			CONCAT(MAX(UpdateAt), '.', COUNT(Id)) as etag
		FROM
			Users as u
		LEFT JOIN TeamMembers tm
			ON tm.UserId = u.Id
			AND tm.TeamId = :TeamId
			AND tm.DeleteAt = 0
		WHERE
			tm.UserId IS NULL
	`
	etag, err := us.GetReplica().SelectStr(querystr, map[string]interface{}{"TeamId": teamId})
	if err != nil {
		return fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
	}

	return fmt.Sprintf("%v.%v", model.CurrentVersion, etag)
}

func (us SqlUserStore) ClearAllCustomRoleAssignments() *model.AppError {
	builtInRoles := model.MakeDefaultRoles()
	lastUserId := strings.Repeat("0", 26)

	for {
		var transaction *gorp.Transaction
		var err error

		if transaction, err = us.GetMaster().Begin(); err != nil {
			return model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		defer finalizeTransaction(transaction)

		var users []*model.User
		if _, err := transaction.Select(&users, "SELECT * from Users WHERE Id > :Id ORDER BY Id LIMIT 1000", map[string]interface{}{"Id": lastUserId}); err != nil {
			return model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.select.app_error", nil, err.Error(), http.StatusInternalServerError)
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
					return model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.update.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			}
		}

		if err := transaction.Commit(); err != nil {
			return model.NewAppError("SqlUserStore.ClearAllCustomRoleAssignments", "store.sql_user.clear_all_custom_role_assignments.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (us SqlUserStore) InferSystemInstallDate() (int64, *model.AppError) {
	createAt, err := us.GetReplica().SelectInt("SELECT CreateAt FROM Users WHERE CreateAt IS NOT NULL ORDER BY CreateAt ASC LIMIT 1")
	if err != nil {
		return 0, model.NewAppError("SqlUserStore.GetSystemInstallDate", "store.sql_user.get_system_install_date.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return createAt, nil
}

func (us SqlUserStore) GetUsersBatchForIndexing(startTime, endTime int64, limit int) ([]*model.UserForIndexing, *model.AppError) {
	var users []*model.User
	usersQuery, args, _ := us.usersQuery.
		Where(sq.GtOrEq{"u.CreateAt": startTime}).
		Where(sq.Lt{"u.CreateAt": endTime}).
		OrderBy("u.CreateAt").
		Limit(uint64(limit)).
		ToSql()
	_, err := us.GetSearchReplica().Select(&users, usersQuery, args...)
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetUsersBatchForIndexing", "store.sql_user.get_users_batch_for_indexing.get_users.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	userIds := []string{}
	for _, user := range users {
		userIds = append(userIds, user.Id)
	}

	var channelMembers []*model.ChannelMember
	channelMembersQuery, args, _ := us.getQueryBuilder().
		Select(`
				cm.ChannelId,
				cm.UserId,
				cm.Roles,
				cm.LastViewedAt,
				cm.MsgCount,
				cm.MentionCount,
				cm.NotifyProps,
				cm.LastUpdateAt,
				cm.SchemeUser,
				cm.SchemeAdmin,
				(cm.SchemeGuest IS NOT NULL AND cm.SchemeGuest) as SchemeGuest
			`).
		From("ChannelMembers cm").
		Join("Channels c ON cm.ChannelId = c.Id").
		Where(sq.Eq{"c.Type": "O", "cm.UserId": userIds}).
		ToSql()
	_, err = us.GetSearchReplica().Select(&channelMembers, channelMembersQuery, args...)
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetUsersBatchForIndexing", "store.sql_user.get_users_batch_for_indexing.get_channel_members.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var teamMembers []*model.TeamMember
	teamMembersQuery, args, _ := us.getQueryBuilder().
		Select("TeamId, UserId, Roles, DeleteAt, (SchemeGuest IS NOT NULL AND SchemeGuest) as SchemeGuest, SchemeUser, SchemeAdmin").
		From("TeamMembers").
		Where(sq.Eq{"UserId": userIds, "DeleteAt": 0}).
		ToSql()
	_, err = us.GetSearchReplica().Select(&teamMembers, teamMembersQuery, args...)
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetUsersBatchForIndexing", "store.sql_user.get_users_batch_for_indexing.get_team_members.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	userMap := map[string]*model.UserForIndexing{}
	for _, user := range users {
		userMap[user.Id] = &model.UserForIndexing{
			Id:          user.Id,
			Username:    user.Username,
			Nickname:    user.Nickname,
			FirstName:   user.FirstName,
			LastName:    user.LastName,
			CreateAt:    user.CreateAt,
			DeleteAt:    user.DeleteAt,
			TeamsIds:    []string{},
			ChannelsIds: []string{},
		}
	}

	for _, c := range channelMembers {
		if userMap[c.UserId] != nil {
			userMap[c.UserId].ChannelsIds = append(userMap[c.UserId].ChannelsIds, c.ChannelId)
		}
	}
	for _, t := range teamMembers {
		if userMap[t.UserId] != nil {
			userMap[t.UserId].TeamsIds = append(userMap[t.UserId].TeamsIds, t.TeamId)
		}
	}

	usersForIndexing := []*model.UserForIndexing{}
	for _, user := range userMap {
		usersForIndexing = append(usersForIndexing, user)
	}
	sort.Slice(usersForIndexing, func(i, j int) bool {
		return usersForIndexing[i].CreateAt < usersForIndexing[j].CreateAt
	})

	return usersForIndexing, nil
}

func (us SqlUserStore) GetTeamGroupUsers(teamID string) ([]*model.User, *model.AppError) {
	query := applyTeamGroupConstrainedFilter(us.usersQuery, teamID)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.UsersPermittedToTeam", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.UsersPermittedToTeam", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetChannelGroupUsers(channelID string) ([]*model.User, *model.AppError) {
	query := applyChannelGroupConstrainedFilter(us.usersQuery, channelID)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlUserStore.GetChannelGroupUsers", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var users []*model.User
	if _, err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlUserStore.GetChannelGroupUsers", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func applyViewRestrictionsFilter(query sq.SelectBuilder, restrictions *model.ViewUsersRestrictions, distinct bool) sq.SelectBuilder {
	if restrictions == nil {
		return query
	}

	// If you have no access to teams or channels, return and empty result.
	if restrictions.Teams != nil && len(restrictions.Teams) == 0 && restrictions.Channels != nil && len(restrictions.Channels) == 0 {
		return query.Where("1 = 0")
	}

	teams := make([]interface{}, len(restrictions.Teams))
	for i, v := range restrictions.Teams {
		teams[i] = v
	}
	channels := make([]interface{}, len(restrictions.Channels))
	for i, v := range restrictions.Channels {
		channels[i] = v
	}
	resultQuery := query
	if restrictions.Teams != nil && len(restrictions.Teams) > 0 {
		resultQuery = resultQuery.Join(fmt.Sprintf("TeamMembers rtm ON ( rtm.UserId = u.Id AND rtm.DeleteAt = 0 AND rtm.TeamId IN (%s))", sq.Placeholders(len(teams))), teams...)
	}
	if restrictions.Channels != nil && len(restrictions.Channels) > 0 {
		resultQuery = resultQuery.Join(fmt.Sprintf("ChannelMembers rcm ON ( rcm.UserId = u.Id AND rcm.ChannelId IN (%s))", sq.Placeholders(len(channels))), channels...)
	}

	if distinct {
		return resultQuery.Distinct()
	}

	return resultQuery
}

func (us SqlUserStore) PromoteGuestToUser(userId string) *model.AppError {
	transaction, err := us.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlUserStore.PromoteGuestToUser", "store.sql_user.promote_guest.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	user, appErr := us.Get(userId)
	if appErr != nil {
		return appErr
	}

	roles := user.GetRoles()

	for idx, role := range roles {
		if role == "system_guest" {
			roles[idx] = "system_user"
		}
	}

	curTime := model.GetMillis()
	query := us.getQueryBuilder().Update("Users").
		Set("Roles", strings.Join(roles, " ")).
		Set("UpdateAt", curTime).
		Where(sq.Eq{"Id": userId})

	queryString, args, err := query.ToSql()
	if err != nil {
		return model.NewAppError("SqlUserStore.PromoteGuestToUser", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlUserStore.PromoteGuestToUser", "store.sql_user.promote_guest.user_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	query = us.getQueryBuilder().Update("ChannelMembers").
		Set("SchemeUser", true).
		Set("SchemeGuest", false).
		Where(sq.Eq{"UserId": userId})

	queryString, args, err = query.ToSql()
	if err != nil {
		return model.NewAppError("SqlUserStore.PromoteGuestToUser", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlUserStore.PromoteGuestToUser", "store.sql_user.promote_guest.channel_members_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	query = us.getQueryBuilder().Update("TeamMembers").
		Set("SchemeUser", true).
		Set("SchemeGuest", false).
		Where(sq.Eq{"UserId": userId})

	queryString, args, err = query.ToSql()
	if err != nil {
		return model.NewAppError("SqlUserStore.PromoteGuestToUser", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err := transaction.Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlUserStore.PromoteGuestToUser", "store.sql_user.promote_guest.team_members_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	if err := transaction.Commit(); err != nil {
		return model.NewAppError("SqlUserStore.PromoteGuestToUser", "store.sql_user.promote_guest.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (us SqlUserStore) DemoteUserToGuest(userId string) *model.AppError {
	transaction, err := us.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlUserStore.DemoteUserToGuest", "store.sql_user.demote_user_to_guest.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	user, appErr := us.Get(userId)
	if appErr != nil {
		return appErr
	}

	roles := user.GetRoles()

	newRoles := []string{}
	for _, role := range roles {
		if role == "system_user" {
			newRoles = append(newRoles, "system_guest")
		} else if role != "system_admin" {
			newRoles = append(newRoles, role)
		}
	}

	curTime := model.GetMillis()
	query := us.getQueryBuilder().Update("Users").
		Set("Roles", strings.Join(newRoles, " ")).
		Set("UpdateAt", curTime).
		Where(sq.Eq{"Id": userId})

	queryString, args, err := query.ToSql()
	if err != nil {
		return model.NewAppError("SqlUserStore.DemoteGuestToUser", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlUserStore.DemoteGuestToUser", "store.sql_user.demote_user_to_guest.user_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	query = us.getQueryBuilder().Update("ChannelMembers").
		Set("SchemeUser", false).
		Set("SchemeGuest", true).
		Where(sq.Eq{"UserId": userId})

	queryString, args, err = query.ToSql()
	if err != nil {
		return model.NewAppError("SqlUserStore.DemoteGuestToUser", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlUserStore.DemoteGuestToUser", "store.sql_user.demote_user_to_guest.channel_members_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	query = us.getQueryBuilder().Update("TeamMembers").
		Set("SchemeUser", false).
		Set("SchemeGuest", true).
		Where(sq.Eq{"UserId": userId})

	queryString, args, err = query.ToSql()
	if err != nil {
		return model.NewAppError("SqlUserStore.DemoteGuestToUser", "store.sql_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err := transaction.Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlUserStore.DemoteGuestToUser", "store.sql_user.demote_user_to_guest.team_members_update.app_error", nil, "user_id="+userId, http.StatusInternalServerError)
	}

	if err := transaction.Commit(); err != nil {
		return model.NewAppError("SqlUserStore.DemoteGuestToUser", "store.sql_user.demote_user_to_guest.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}
