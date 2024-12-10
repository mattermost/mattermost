// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	MaxGroupChannelsForProfiles = 50
)

var (
	UserSearchTypeNamesNoFullName = []string{"Username", "Nickname"}
	UserSearchTypeNames           = []string{"Username", "FirstName", "LastName", "Nickname"}
	UserSearchTypeAllNoFullName   = []string{"Username", "Nickname", "Email"}
	UserSearchTypeAll             = []string{"Username", "FirstName", "LastName", "Nickname", "Email"}
)

type SqlUserStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface

	// usersQuery is a starting point for all queries that return one or more Users.
	usersQuery sq.SelectBuilder
}

func (us *SqlUserStore) ClearCaches() {}

func (us SqlUserStore) InvalidateProfileCacheForUser(userId string) {}

func newSqlUserStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.UserStore {
	us := &SqlUserStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	// note: we are providing field names explicitly here to maintain order of columns (needed when using raw queries)
	us.usersQuery = us.getQueryBuilder().
		Select("u.Id", "u.CreateAt", "u.UpdateAt", "u.DeleteAt", "u.Username", "u.Password", "u.AuthData", "u.AuthService", "u.Email", "u.EmailVerified", "u.Nickname", "u.FirstName", "u.LastName", "u.Position", "u.Roles", "u.AllowMarketing", "u.Props", "u.NotifyProps", "u.LastPasswordUpdate", "u.LastPictureUpdate", "u.FailedAttempts", "u.Locale", "u.Timezone", "u.MfaActive", "u.MfaSecret", "u.MfaUsedTimestamps",
			"b.UserId IS NOT NULL AS IsBot", "COALESCE(b.Description, '') AS BotDescription", "COALESCE(b.LastIconUpdate, 0) AS BotLastIconUpdate", "u.RemoteId", "u.LastLogin").
		From("Users u").
		LeftJoin("Bots b ON ( b.UserId = u.Id )")

	return us
}

func (us SqlUserStore) validateAutoResponderMessageSize(notifyProps model.StringMap) error {
	if notifyProps != nil {
		maxPostSize := us.Post().GetMaxPostSize()
		msg := notifyProps[model.AutoResponderMessageNotifyProp]
		msgSize := utf8.RuneCountInString(msg)
		if msgSize > maxPostSize {
			mlog.Warn("auto_responder_message has size restrictions", mlog.Int("max_characters", maxPostSize), mlog.Int("received_size", msgSize))
			return errors.New("Auto responder message size can't be more than the allowed Post size")
		}
	}
	return nil
}

func (us SqlUserStore) insert(user *model.User) (sql.Result, error) {
	if err := us.validateAutoResponderMessageSize(user.NotifyProps); err != nil {
		return nil, err
	}

	query := `INSERT INTO Users
		(Id, CreateAt, UpdateAt, DeleteAt, Username, Password, AuthData, AuthService,
			Email, EmailVerified, Nickname, FirstName, LastName, Position, Roles, AllowMarketing,
			Props, NotifyProps, LastPasswordUpdate, LastPictureUpdate, FailedAttempts,
			Locale, Timezone, MfaActive, MfaSecret, RemoteId, MfaUsedTimestamps)
		VALUES
		(:Id, :CreateAt, :UpdateAt, :DeleteAt, :Username, :Password, :AuthData, :AuthService,
			:Email, :EmailVerified, :Nickname, :FirstName, :LastName, :Position, :Roles, :AllowMarketing,
			:Props, :NotifyProps, :LastPasswordUpdate, :LastPictureUpdate, :FailedAttempts,
			:Locale, :Timezone, :MfaActive, :MfaSecret, :RemoteId, :MfaUsedTimestamps)`

	user.Props = wrapBinaryParamStringMap(us.IsBinaryParamEnabled(), user.Props)
	return us.GetMaster().NamedExec(query, user)
}

func (us SqlUserStore) InsertUsers(users []*model.User) error {
	for _, user := range users {
		_, err := us.insert(user)
		if err != nil {
			return err
		}
	}

	return nil
}

func (us SqlUserStore) Save(rctx request.CTX, user *model.User) (*model.User, error) {
	if user.Id != "" && !user.IsRemote() {
		return nil, store.NewErrInvalidInput("User", "id", user.Id)
	}

	if err := user.PreSave(); err != nil {
		return nil, err
	}
	if err := user.IsValid(); err != nil {
		return nil, err
	}

	if _, err := us.insert(user); err != nil {
		if IsUniqueConstraintError(err, []string{"Email", "users_email_key", "idx_users_email_unique"}) {
			return nil, store.NewErrInvalidInput("User", "email", user.Email)
		}
		if IsUniqueConstraintError(err, []string{"Username", "users_username_key", "idx_users_username_unique"}) {
			return nil, store.NewErrInvalidInput("User", "username", user.Username)
		}
		return nil, errors.Wrapf(err, "failed to save User with userId=%s", user.Id)
	}

	return user, nil
}

func (us SqlUserStore) DeactivateGuests() ([]string, error) {
	curTime := model.GetMillis()
	updateQuery := us.getQueryBuilder().Update("Users").
		Set("UpdateAt", curTime).
		Set("DeleteAt", curTime).
		Where(sq.Eq{"Roles": "system_guest"}).
		Where(sq.Eq{"DeleteAt": 0})

	_, err := us.GetMaster().ExecBuilder(updateQuery)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update Users with roles=system_guest")
	}

	selectQuery := us.getQueryBuilder().
		Select("Id").
		From("Users").
		Where(sq.Eq{"DeleteAt": curTime})

	userIds := []string{}
	err = us.GetMaster().SelectBuilder(&userIds, selectQuery)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	return userIds, nil
}

func (us SqlUserStore) Update(rctx request.CTX, user *model.User, trustedUpdateData bool) (*model.UserUpdate, error) {
	user.PreUpdate()

	if err := user.IsValid(); err != nil {
		return nil, err
	}

	if err := us.validateAutoResponderMessageSize(user.NotifyProps); err != nil {
		return nil, err
	}

	oldUser := model.User{}
	err := us.GetMaster().Get(&oldUser, "SELECT * FROM Users WHERE Id=?", user.Id)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get User with userId=%s", user.Id)
	}

	if oldUser.Id == "" {
		return nil, store.NewErrInvalidInput("User", "id", user.Id)
	}

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
	user.MfaUsedTimestamps = oldUser.MfaUsedTimestamps
	user.LastLogin = oldUser.LastLogin

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
			return nil, store.NewErrInvalidInput("User", "id", user.Id)
		}
	} else if user.Email != oldUser.Email {
		user.EmailVerified = false
	}

	if user.Username != oldUser.Username {
		user.UpdateMentionKeysFromUsername(oldUser.Username)
	}

	query := `UPDATE Users
			SET CreateAt=:CreateAt, UpdateAt=:UpdateAt, DeleteAt=:DeleteAt, Username=:Username, Password=:Password,
				AuthData=:AuthData, AuthService=:AuthService,Email=:Email, EmailVerified=:EmailVerified,
				Nickname=:Nickname, FirstName=:FirstName, LastName=:LastName, Position=:Position, Roles=:Roles,
				AllowMarketing=:AllowMarketing, Props=:Props, NotifyProps=:NotifyProps,
				LastPasswordUpdate=:LastPasswordUpdate, LastPictureUpdate=:LastPictureUpdate,
				FailedAttempts=:FailedAttempts,Locale=:Locale, Timezone=:Timezone, MfaActive=:MfaActive,
				MfaSecret=:MfaSecret, RemoteId=:RemoteId, LastLogin=:LastLogin, MfaUsedTimestamps=:MfaUsedTimestamps
			WHERE Id=:Id`

	user.Props = wrapBinaryParamStringMap(us.IsBinaryParamEnabled(), user.Props)
	res, err := us.GetMaster().NamedExec(query, user)
	if err != nil {
		if IsUniqueConstraintError(err, []string{"Email", "users_email_key", "idx_users_email_unique"}) {
			return nil, store.NewErrConflict("Email", err, user.Email)
		}
		if IsUniqueConstraintError(err, []string{"Username", "users_username_key", "idx_users_username_unique"}) {
			return nil, store.NewErrConflict("Username", err, user.Username)
		}
		return nil, errors.Wrapf(err, "failed to update User with userId=%s", user.Id)
	}

	count, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get rows_affected")
	}
	if count > 1 {
		return nil, fmt.Errorf("multiple users were update: userId=%s, count=%d", user.Id, count)
	}

	user.Sanitize(map[string]bool{})
	oldUser.Sanitize(map[string]bool{})
	return &model.UserUpdate{New: user.DeepCopy(), Old: &oldUser}, nil
}

func (us SqlUserStore) UpdateNotifyProps(userID string, props map[string]string) error {
	if err := us.validateAutoResponderMessageSize(props); err != nil {
		return err
	}

	buf, err := json.Marshal(props)
	if err != nil {
		return errors.Wrap(err, "failed marshalling session props")
	}
	if us.IsBinaryParamEnabled() {
		buf = AppendBinaryFlag(buf)
	}

	if _, err := us.GetMaster().Exec(`UPDATE Users
		SET NotifyProps = ?
		WHERE Id = ?`, buf, userID); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userID)
	}

	return nil
}

func (us SqlUserStore) UpdateLastPictureUpdate(userId string) error {
	curTime := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET LastPictureUpdate = ?, UpdateAt = ? WHERE Id = ?", curTime, curTime, userId); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}

	return nil
}

func (us SqlUserStore) ResetLastPictureUpdate(userId string) error {
	curTime := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET LastPictureUpdate = ?, UpdateAt = ? WHERE Id = ?", -curTime, curTime, userId); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}

	return nil
}

func (us SqlUserStore) UpdateUpdateAt(userId string) (int64, error) {
	curTime := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET UpdateAt = ? WHERE Id = ?", curTime, userId); err != nil {
		return curTime, errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}

	return curTime, nil
}

func (us SqlUserStore) UpdatePassword(userId, hashedPassword string) error {
	updateAt := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET Password = ?, LastPasswordUpdate = ?, UpdateAt = ?, AuthData = NULL, AuthService = '', FailedAttempts = 0 WHERE Id = ?", hashedPassword, updateAt, updateAt, userId); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}

	return nil
}

func (us SqlUserStore) UpdateFailedPasswordAttempts(userId string, attempts int) error {
	if _, err := us.GetMaster().Exec("UPDATE Users SET FailedAttempts = ? WHERE Id = ?", attempts, userId); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}

	return nil
}

func (us SqlUserStore) UpdateAuthData(userId string, service string, authData *string, email string, resetMfa bool) (string, error) {
	updateAt := model.GetMillis()

	updateQuery := us.getQueryBuilder().Update("Users").
		Set("Password", "").
		Set("LastPasswordUpdate", updateAt).
		Set("UpdateAt", updateAt).
		Set("FailedAttempts", 0).
		Set("AuthService", service).
		Set("AuthData", authData).
		Where(sq.Eq{"Id": userId})

	if email != "" {
		updateQuery = updateQuery.Set("Email", sq.Expr("lower(?)", email))
	}

	if resetMfa {
		updateQuery = updateQuery.Set("MfaActive", false).
			Set("MfaSecret", "").
			Set("MfaUsedTimestamps", model.StringArray{})
	}

	if _, err := us.GetMaster().ExecBuilder(updateQuery); err != nil {
		if IsUniqueConstraintError(err, []string{"Email", "users_email_key", "idx_users_email_unique", "AuthData", "users_authdata_key"}) {
			return "", store.NewErrInvalidInput("User", "id", userId)
		}
		return "", errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}
	return userId, nil
}

func (us SqlUserStore) UpdateLastLogin(userId string, lastLogin int64) error {
	updateQuery := us.getQueryBuilder().
		Update("Users").
		Set("LastLogin", lastLogin).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": userId})

	if _, err := us.GetMaster().ExecBuilder(updateQuery); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}

	return nil
}

// ResetAuthDataToEmailForUsers resets the AuthData of users whose AuthService
// is |service| to their Email. If userIDs is non-empty, only the users whose
// IDs are in userIDs will be affected. If dryRun is true, only the number
// of users who *would* be affected is returned; otherwise, the number of
// users who actually were affected is returned.
func (us SqlUserStore) ResetAuthDataToEmailForUsers(service string, userIDs []string, includeDeleted bool, dryRun bool) (int, error) {
	whereEquals := sq.Eq{"AuthService": service}
	if len(userIDs) > 0 {
		whereEquals["Id"] = userIDs
	}
	if !includeDeleted {
		whereEquals["DeleteAt"] = 0
	}

	if dryRun {
		builder := us.getQueryBuilder().
			Select("COUNT(*)").
			From("Users").
			Where(whereEquals)
		var numAffected int
		err := us.GetReplica().GetBuilder(&numAffected, builder)
		return numAffected, err
	}
	builder := us.getQueryBuilder().
		Update("Users").
		Set("AuthData", sq.Expr("Email")).
		Where(whereEquals)
	result, err := us.GetMaster().ExecBuilder(builder)
	if err != nil {
		return 0, errors.Wrap(err, "failed to update users' AuthData")
	}
	numAffected, err := result.RowsAffected()
	return int(numAffected), err
}

func (us SqlUserStore) UpdateMfaSecret(userId, secret string) error {
	updateAt := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET MfaSecret = ?, MfaUsedTimestamps = ?, UpdateAt = ? WHERE Id = ?", secret, model.StringArray{}, updateAt, userId); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}

	return nil
}

func (us SqlUserStore) UpdateMfaActive(userId string, active bool) error {
	updateAt := model.GetMillis()

	if _, err := us.GetMaster().Exec("UPDATE Users SET MfaActive = ?, UpdateAt = ? WHERE Id = ?", active, updateAt, userId); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}

	return nil
}

func (us SqlUserStore) StoreMfaUsedTimestamps(userId string, ts []int) error {
	tSStrArray := model.StringArray{}
	for _, t := range ts {
		tSStrArray = append(tSStrArray, fmt.Sprintf("%d", t))
	}

	updateAt := model.GetMillis()
	if _, err := us.GetMaster().Exec("UPDATE Users SET MfaUsedTimestamps = ?, UpdateAt = ? WHERE Id = ?", tSStrArray, updateAt, userId); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}
	return nil
}

func (us SqlUserStore) GetMfaUsedTimestamps(userId string) ([]int, error) {
	tsStrArray := model.StringArray{}
	err := us.GetReplica().Get(&tsStrArray, "SELECT MfaUsedTimestamps FROM Users WHERE Id = ?", userId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get MFA used timestamps for user with ID %s", userId)
	}

	ts := make([]int, len(tsStrArray))
	for i, t := range tsStrArray {
		ts[i], err = strconv.Atoi(t)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to parse MFA used timestamp %s for user with ID %s", t, userId)
		}
	}

	return ts, nil
}

// GetMany returns a list of users for the provided list of ids
func (us SqlUserStore) GetMany(ctx context.Context, ids []string) ([]*model.User, error) {
	query := us.usersQuery.Where(sq.Eq{"Id": ids})
	users := []*model.User{}
	if err := us.SqlStore.DBXFromContext(ctx).SelectBuilder(&users, query); err != nil {
		return nil, errors.Wrap(err, "users_get_many_select")
	}

	return users, nil
}

func (us SqlUserStore) Get(ctx context.Context, id string) (*model.User, error) {
	query := us.usersQuery.Where("Id = ?", id)
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "users_get_tosql")
	}
	row := us.SqlStore.DBXFromContext(ctx).QueryRow(queryString, args...)

	var user model.User
	var props, notifyProps, timezone []byte
	err = row.Scan(&user.Id, &user.CreateAt, &user.UpdateAt, &user.DeleteAt, &user.Username,
		&user.Password, &user.AuthData, &user.AuthService, &user.Email, &user.EmailVerified,
		&user.Nickname, &user.FirstName, &user.LastName, &user.Position, &user.Roles,
		&user.AllowMarketing, &props, &notifyProps, &user.LastPasswordUpdate, &user.LastPictureUpdate,
		&user.FailedAttempts, &user.Locale, &timezone, &user.MfaActive, &user.MfaSecret, &user.MfaUsedTimestamps,
		&user.IsBot, &user.BotDescription, &user.BotLastIconUpdate, &user.RemoteId, &user.LastLogin)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("User", id)
		}
		return nil, errors.Wrapf(err, "failed to get User with userId=%s", id)
	}
	if err = json.Unmarshal(props, &user.Props); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal user props")
	}
	if err = json.Unmarshal(notifyProps, &user.NotifyProps); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal user notify props")
	}
	if err = json.Unmarshal(timezone, &user.Timezone); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal user timezone")
	}

	return &user, nil
}

func (us SqlUserStore) GetAll() ([]*model.User, error) {
	query := us.usersQuery.OrderBy("Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_all_users_tosql")
	}

	data := []*model.User{}
	if err := us.GetReplica().Select(&data, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}
	return data, nil
}

func (us SqlUserStore) GetAllAfter(limit int, afterId string) ([]*model.User, error) {
	query := us.usersQuery.
		Where("Id > ?", afterId).
		OrderBy("Id ASC").
		Limit(uint64(limit))

	users := []*model.User{}
	if err := us.GetReplica().SelectBuilder(&users, query); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	return users, nil
}

func (us SqlUserStore) GetEtagForAllProfiles() string {
	var updateAt int64
	err := us.GetReplica().Get(&updateAt, "SELECT UpdateAt FROM Users ORDER BY UpdateAt DESC LIMIT 1")
	if err != nil {
		return fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
	}
	return fmt.Sprintf("%v.%v", model.CurrentVersion, updateAt)
}

func (us SqlUserStore) GetAllProfiles(options *model.UserGetOptions) ([]*model.User, error) {
	isPostgreSQL := us.DriverName() == model.DatabaseDriverPostgres
	query := us.usersQuery.
		OrderBy("u.Username ASC").
		Offset(uint64(options.Page * options.PerPage)).Limit(uint64(options.PerPage))

	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, true)

	query = applyRoleFilter(query, options.Role, isPostgreSQL)
	query = applyMultiRoleFilters(query, options.Roles, []string{}, []string{}, isPostgreSQL)

	if options.Inactive {
		query = query.Where("u.DeleteAt != 0")
	} else if options.Active {
		query = query.Where("u.DeleteAt = 0")
	}

	users := []*model.User{}
	if err := us.GetReplica().SelectBuilder(&users, query); err != nil {
		return nil, errors.Wrap(err, "failed to get User profiles")
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

func applyMultiRoleFilters(query sq.SelectBuilder, systemRoles []string, teamRoles []string, channelRoles []string, isPostgreSQL bool) sq.SelectBuilder {
	sqOr := sq.Or{}

	if len(systemRoles) > 0 && systemRoles[0] != "" {
		for _, role := range systemRoles {
			queryRole := wildcardSearchTerm(role)
			switch role {
			case model.SystemUserRoleId:
				// If querying for a `system_user` ensure that the user is only a system_user.
				sqOr = append(sqOr, sq.Eq{"u.Roles": role})
			case model.SystemGuestRoleId, model.SystemAdminRoleId, model.SystemUserManagerRoleId, model.SystemReadOnlyAdminRoleId, model.SystemManagerRoleId:
				// If querying for any other roles search using a wildcard.
				if isPostgreSQL {
					sqOr = append(sqOr, sq.ILike{"u.Roles": queryRole})
				} else {
					sqOr = append(sqOr, sq.Like{"u.Roles": queryRole})
				}
			}
		}
	}

	if len(channelRoles) > 0 && channelRoles[0] != "" {
		for _, channelRole := range channelRoles {
			switch channelRole {
			case model.ChannelAdminRoleId:
				if isPostgreSQL {
					sqOr = append(sqOr, sq.And{sq.Eq{"cm.SchemeAdmin": true}, sq.NotILike{"u.Roles": wildcardSearchTerm(model.SystemAdminRoleId)}})
				} else {
					sqOr = append(sqOr, sq.And{sq.Eq{"cm.SchemeAdmin": true}, sq.NotLike{"u.Roles": wildcardSearchTerm(model.SystemAdminRoleId)}})
				}
			case model.ChannelUserRoleId:
				if isPostgreSQL {
					sqOr = append(sqOr, sq.And{sq.Eq{"cm.SchemeUser": true}, sq.Eq{"cm.SchemeAdmin": false}, sq.NotILike{"u.Roles": wildcardSearchTerm(model.SystemAdminRoleId)}})
				} else {
					sqOr = append(sqOr, sq.And{sq.Eq{"cm.SchemeUser": true}, sq.Eq{"cm.SchemeAdmin": false}, sq.NotLike{"u.Roles": wildcardSearchTerm(model.SystemAdminRoleId)}})
				}
			case model.ChannelGuestRoleId:
				sqOr = append(sqOr, sq.Eq{"cm.SchemeGuest": true})
			}
		}
	}

	if len(teamRoles) > 0 && teamRoles[0] != "" {
		for _, teamRole := range teamRoles {
			switch teamRole {
			case model.TeamAdminRoleId:
				if isPostgreSQL {
					sqOr = append(sqOr, sq.And{sq.Eq{"tm.SchemeAdmin": true}, sq.NotILike{"u.Roles": wildcardSearchTerm(model.SystemAdminRoleId)}})
				} else {
					sqOr = append(sqOr, sq.And{sq.Eq{"tm.SchemeAdmin": true}, sq.NotLike{"u.Roles": wildcardSearchTerm(model.SystemAdminRoleId)}})
				}
			case model.TeamUserRoleId:
				if isPostgreSQL {
					sqOr = append(sqOr, sq.And{sq.Eq{"tm.SchemeUser": true}, sq.Eq{"tm.SchemeAdmin": false}, sq.NotILike{"u.Roles": wildcardSearchTerm(model.SystemAdminRoleId)}})
				} else {
					sqOr = append(sqOr, sq.And{sq.Eq{"tm.SchemeUser": true}, sq.Eq{"tm.SchemeAdmin": false}, sq.NotLike{"u.Roles": wildcardSearchTerm(model.SystemAdminRoleId)}})
				}
			case model.TeamGuestRoleId:
				sqOr = append(sqOr, sq.Eq{"tm.SchemeGuest": true})
			}
		}
	}

	if len(sqOr) > 0 {
		return query.Where(sqOr)
	}
	return query
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
	var updateAt int64
	err := us.GetReplica().Get(&updateAt, "SELECT UpdateAt FROM Users, TeamMembers WHERE TeamMembers.TeamId = ? AND Users.Id = TeamMembers.UserId ORDER BY UpdateAt DESC LIMIT 1", teamId)
	if err != nil {
		return fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
	}
	return fmt.Sprintf("%v.%v", model.CurrentVersion, updateAt)
}

func (us SqlUserStore) GetProfiles(options *model.UserGetOptions) ([]*model.User, error) {
	isPostgreSQL := us.DriverName() == model.DatabaseDriverPostgres
	query := us.usersQuery.
		Join("TeamMembers tm ON ( tm.UserId = u.Id AND tm.DeleteAt = 0 )").
		Where("tm.TeamId = ?", options.InTeamId).
		OrderBy("u.Username ASC").
		Offset(uint64(options.Page * options.PerPage)).Limit(uint64(options.PerPage))

	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, true)

	query = applyRoleFilter(query, options.Role, isPostgreSQL)
	query = applyMultiRoleFilters(query, options.Roles, options.TeamRoles, options.ChannelRoles, isPostgreSQL)

	if options.Inactive {
		query = query.Where("u.DeleteAt != 0")
	} else if options.Active {
		query = query.Where("u.DeleteAt = 0")
	}

	users := []*model.User{}
	if err := us.GetReplica().SelectBuilder(&users, query); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) InvalidateProfilesInChannelCacheByUser(userId string) {}

func (us SqlUserStore) InvalidateProfilesInChannelCache(channelId string) {}

func (us SqlUserStore) GetProfilesInChannel(options *model.UserGetOptions) ([]*model.User, error) {
	query := us.usersQuery.
		Join("ChannelMembers cm ON ( cm.UserId = u.Id )").
		Where("cm.ChannelId = ?", options.InChannelId).
		OrderBy("u.Username ASC").
		Offset(uint64(options.Page * options.PerPage)).Limit(uint64(options.PerPage))

	if options.Inactive {
		query = query.Where("u.DeleteAt != 0")
	} else if options.Active {
		query = query.Where("u.DeleteAt = 0")
	}

	query = applyMultiRoleFilters(query, options.Roles, options.TeamRoles, options.ChannelRoles, us.DriverName() == model.DatabaseDriverPostgres)

	users := []*model.User{}
	if err := us.GetReplica().SelectBuilder(&users, query); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetProfilesInChannelByStatus(options *model.UserGetOptions) ([]*model.User, error) {
	query := us.usersQuery.
		Join("ChannelMembers cm ON ( cm.UserId = u.Id )").
		LeftJoin("Status s ON ( s.UserId = u.Id )").
		Where("cm.ChannelId = ?", options.InChannelId).
		OrderBy(`
			CASE s.Status
				WHEN 'online' THEN 1
				WHEN 'away' THEN 2
				WHEN 'dnd' THEN 3
				ELSE 4
			END
			`).
		OrderBy("u.Username ASC").
		Offset(uint64(options.Page * options.PerPage)).Limit(uint64(options.PerPage))

	if options.Inactive && !options.Active {
		query = query.Where("u.DeleteAt != 0")
	} else if options.Active && !options.Inactive {
		query = query.Where("u.DeleteAt = 0")
	}

	users := []*model.User{}
	if err := us.GetReplica().SelectBuilder(&users, query); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetProfilesInChannelByAdmin(options *model.UserGetOptions) ([]*model.User, error) {
	query := us.usersQuery.
		Join("ChannelMembers cm ON ( cm.UserId = u.Id )").
		Where("cm.ChannelId = ?", options.InChannelId).
		OrderBy(`cm.SchemeAdmin DESC`).
		OrderBy("u.Username ASC").
		Offset(uint64(options.Page * options.PerPage)).Limit(uint64(options.PerPage))

	if options.Inactive && !options.Active {
		query = query.Where("u.DeleteAt != 0")
	} else if options.Active && !options.Inactive {
		query = query.Where("u.DeleteAt = 0")
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_profiles_in_channel_by_admin_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetAllProfilesInChannel(ctx context.Context, channelID string, allowFromCache bool) (map[string]*model.User, error) {
	query := us.usersQuery.
		Join("ChannelMembers cm ON ( cm.UserId = u.Id )").
		Where("cm.ChannelId = ?", channelID).
		Where("u.DeleteAt = 0").
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_all_profiles_in_channel_tosql")
	}

	users := []*model.User{}
	rows, err := us.SqlStore.DBXFromContext(ctx).Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	defer rows.Close()
	for rows.Next() {
		var user model.User
		var props, notifyProps, timezone []byte
		if err = rows.Scan(&user.Id, &user.CreateAt, &user.UpdateAt, &user.DeleteAt, &user.Username, &user.Password, &user.AuthData, &user.AuthService, &user.Email, &user.EmailVerified, &user.Nickname, &user.FirstName, &user.LastName, &user.Position, &user.Roles, &user.AllowMarketing, &props, &notifyProps, &user.LastPasswordUpdate, &user.LastPictureUpdate, &user.FailedAttempts, &user.Locale, &timezone, &user.MfaActive, &user.MfaSecret, &user.MfaUsedTimestamps, &user.IsBot, &user.BotDescription, &user.BotLastIconUpdate, &user.RemoteId, &user.LastLogin); err != nil {
			return nil, errors.Wrap(err, "failed to scan values from rows into User entity")
		}
		if err = json.Unmarshal(props, &user.Props); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal user props")
		}
		if err = json.Unmarshal(notifyProps, &user.NotifyProps); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal user notify props")
		}
		if err = json.Unmarshal(timezone, &user.Timezone); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal user timezone")
		}
		users = append(users, &user)
	}
	err = rows.Err()
	if err != nil {
		return nil, errors.Wrap(err, "error while iterating over rows")
	}

	userMap := make(map[string]*model.User)

	for _, u := range users {
		u.Sanitize(map[string]bool{})
		userMap[u.Id] = u
	}

	return userMap, nil
}

func (us SqlUserStore) GetProfilesNotInChannel(teamId string, channelId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
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
		return nil, errors.Wrap(err, "get_profiles_not_in_channel_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetProfilesWithoutTeam(options *model.UserGetOptions) ([]*model.User, error) {
	isPostgreSQL := us.DriverName() == model.DatabaseDriverPostgres
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
	} else if options.Active {
		query = query.Where("u.DeleteAt = 0")
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_profiles_without_team_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetProfilesByUsernames(usernames []string, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	query := us.usersQuery

	query = applyViewRestrictionsFilter(query, viewRestrictions, true)

	query = query.
		Where(map[string]any{
			"Username": usernames,
		}).
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_profiles_by_usernames")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	return users, nil
}

type UserWithLastActivityAt struct {
	model.User
	LastActivityAt int64
}

func (us SqlUserStore) GetRecentlyActiveUsersForTeam(teamId string, offset, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
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
		return nil, errors.Wrap(err, "get_recently_active_users_for_team_tosql")
	}

	users := []*UserWithLastActivityAt{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
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

func (us SqlUserStore) GetNewUsersForTeam(teamId string, offset, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	query := us.usersQuery.
		Join("TeamMembers tm ON (tm.UserId = u.Id AND tm.TeamId = ?)", teamId).
		OrderBy("u.CreateAt DESC").
		OrderBy("u.Username ASC").
		Offset(uint64(offset)).Limit(uint64(limit))

	query = applyViewRestrictionsFilter(query, viewRestrictions, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_new_users_for_team_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetProfileByIds(ctx context.Context, userIds []string, options *store.UserGetByIdsOpts, allowFromCache bool) ([]*model.User, error) {
	if options == nil {
		options = &store.UserGetByIdsOpts{}
	}

	users := []*model.User{}
	query := us.usersQuery.
		Where(map[string]any{
			"u.Id": userIds,
		}).
		OrderBy("u.Username ASC")

	if options.Since > 0 {
		query = query.Where(sq.Gt(map[string]any{
			"u.UpdateAt": options.Since,
		}))
	}

	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_profile_by_ids_tosql")
	}

	if err := us.SqlStore.DBXFromContext(ctx).Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	return users, nil
}

type UserWithChannel struct {
	model.User
	ChannelId string
}

func (us SqlUserStore) GetProfileByGroupChannelIdsForUser(userId string, channelIds []string) (map[string][]*model.User, error) {
	if len(channelIds) > MaxGroupChannelsForProfiles {
		channelIds = channelIds[0:MaxGroupChannelsForProfiles]
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
		Where(sq.Eq{"c.Type": model.ChannelTypeGroup, "cm.ChannelId": channelIds}).
		Where(isMemberQuery).
		Where(sq.NotEq{"u.Id": userId}).
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_profiles_by_group_channel_ids_for_user_tosql")
	}

	usersWithChannel := []*UserWithChannel{}
	if err := us.GetReplica().Select(&usersWithChannel, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
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

func (us SqlUserStore) GetSystemAdminProfiles() (map[string]*model.User, error) {
	query := us.usersQuery.
		Where("Roles LIKE ?", "%system_admin%").
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_system_admin_profiles_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	userMap := make(map[string]*model.User)

	for _, u := range users {
		u.Sanitize(map[string]bool{})
		userMap[u.Id] = u
	}

	return userMap, nil
}

func (us SqlUserStore) GetByEmail(email string) (*model.User, error) {
	query := us.usersQuery.Where("Email = lower(?)", email)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_by_email_tosql")
	}

	user := model.User{}
	if err := us.GetReplica().Get(&user, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.Wrap(store.NewErrNotFound("User", fmt.Sprintf("email=%s", email)), "failed to find User")
		}

		return nil, errors.Wrapf(err, "failed to get User with email=%s", email)
	}

	return &user, nil
}

func (us SqlUserStore) GetByRemoteID(remoteID string) (*model.User, error) {
	query := us.usersQuery.Where(sq.Eq{"RemoteId": remoteID})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_by_remote_id_tosql")
	}

	user := model.User{}
	if err := us.GetReplica().Get(&user, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.Wrap(store.NewErrNotFound("User", fmt.Sprintf("remoteid=%s", remoteID)), "failed to find User")
		}

		return nil, errors.Wrapf(err, "failed to get User with RemoteId=%s", remoteID)
	}

	return &user, nil
}

func (us SqlUserStore) GetByAuth(authData *string, authService string) (*model.User, error) {
	if authData == nil || *authData == "" {
		return nil, store.NewErrInvalidInput("User", "<authData>", "empty or nil")
	}

	query := us.usersQuery.
		Where("u.AuthData = ?", authData).
		Where("u.AuthService = ?", authService)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_by_auth_tosql")
	}

	user := model.User{}
	if err := us.GetReplica().Get(&user, queryString, args...); err == sql.ErrNoRows {
		return nil, store.NewErrNotFound("User", fmt.Sprintf("authData=%s, authService=%s", *authData, authService))
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to find User with authData=%s and authService=%s", *authData, authService)
	}
	return &user, nil
}

func (us SqlUserStore) GetAllUsingAuthService(authService string) ([]*model.User, error) {
	query := us.usersQuery.
		Where("u.AuthService = ?", authService).
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_all_using_auth_service_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Users with authService=%s", authService)
	}

	return users, nil
}

func (us SqlUserStore) GetAllNotInAuthService(authServices []string) ([]*model.User, error) {
	query := us.usersQuery.
		Where(sq.NotEq{"u.AuthService": authServices}).
		OrderBy("u.Username ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_all_not_in_auth_service_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Users with authServices in %v", authServices)
	}

	return users, nil
}

func (us SqlUserStore) GetByUsername(username string) (*model.User, error) {
	query := us.usersQuery.Where("u.Username = lower(?)", username)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_by_username_tosql")
	}

	user := model.User{}
	if err := us.GetReplica().Get(&user, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.Wrap(store.NewErrNotFound("User", fmt.Sprintf("username=%s", username)), "failed to find User")
		}

		return nil, errors.Wrapf(err, "failed to find User with username=%s", username)
	}

	return &user, nil
}

func (us SqlUserStore) GetForLogin(loginId string, allowSignInWithUsername, allowSignInWithEmail bool) (*model.User, error) {
	query := us.usersQuery
	if allowSignInWithUsername && allowSignInWithEmail {
		query = query.Where("Username = lower(?) OR Email = lower(?)", loginId, loginId)
	} else if allowSignInWithUsername {
		query = query.Where("Username = lower(?)", loginId)
	} else if allowSignInWithEmail {
		query = query.Where("Email = lower(?)", loginId)
	} else {
		return nil, errors.New("sign in with username and email are disabled")
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_for_login_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	if len(users) == 0 {
		return nil, errors.New("user not found")
	}

	if len(users) > 1 {
		return nil, errors.New("multiple users found")
	}

	return users[0], nil
}

func (us SqlUserStore) VerifyEmail(userId, email string) (string, error) {
	curTime := model.GetMillis()
	if _, err := us.GetMaster().Exec("UPDATE Users SET Email = lower(?), EmailVerified = true, UpdateAt = ? WHERE Id = ?", email, curTime, userId); err != nil {
		return "", errors.Wrapf(err, "failed to update Users with userId=%s and email=%s", userId, email)
	}

	return userId, nil
}

func (us SqlUserStore) PermanentDelete(rctx request.CTX, userId string) error {
	if _, err := us.GetMaster().Exec("DELETE FROM Users WHERE Id = ?", userId); err != nil {
		return errors.Wrapf(err, "failed to delete User with userId=%s", userId)
	}
	return nil
}

func (us SqlUserStore) Count(options model.UserCountOptions) (int64, error) {
	query := us.getQueryBuilder().Select("COUNT(*)").From("Users AS u")

	if !options.IncludeDeleted {
		query = query.Where("u.DeleteAt = 0")
	}

	if !options.IncludeRemoteUsers {
		query = query.Where(sq.Or{sq.Eq{"u.RemoteId": ""}, sq.Eq{"u.RemoteId": nil}})
	}

	isPostgreSQL := us.DriverName() == model.DatabaseDriverPostgres
	if options.IncludeBotAccounts {
		if options.ExcludeRegularUsers {
			query = query.Join("Bots ON u.Id = Bots.UserId")
		}
	} else {
		if isPostgreSQL {
			query = query.LeftJoin("Bots ON u.Id = Bots.UserId").Where("Bots.UserId IS NULL")
		} else {
			query = query.Where(sq.Expr("u.Id NOT IN (SELECT UserId FROM Bots)"))
		}

		if options.ExcludeRegularUsers {
			// Currently this doesn't make sense because it will always return 0
			return int64(0), errors.New("query with IncludeBotAccounts=false and excludeRegularUsers=true always return 0")
		}
	}

	if options.TeamId != "" {
		query = query.LeftJoin("TeamMembers AS tm ON u.Id = tm.UserId").Where("tm.TeamId = ? AND tm.DeleteAt = 0", options.TeamId)
	} else if options.ChannelId != "" {
		query = query.LeftJoin("ChannelMembers AS cm ON u.Id = cm.UserId").Where("cm.ChannelId = ?", options.ChannelId)
	}
	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, false)
	query = applyMultiRoleFilters(query, options.Roles, options.TeamRoles, options.ChannelRoles, isPostgreSQL)

	if isPostgreSQL {
		query = query.PlaceholderFormat(sq.Dollar)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "count_tosql")
	}

	var count int64
	err = us.GetReplica().Get(&count, queryString, args...)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count Users")
	}
	return count, nil
}

func (us SqlUserStore) AnalyticsActiveCount(timePeriod int64, options model.UserCountOptions) (int64, error) {
	time := model.GetMillis() - timePeriod
	query := us.getQueryBuilder().Select("COUNT(*)").From("Status AS s").Where("LastActivityAt > ?", time)

	if !options.IncludeBotAccounts {
		if us.DriverName() == model.DatabaseDriverPostgres {
			query = query.LeftJoin("Bots ON s.UserId = Bots.UserId").Where("Bots.UserId IS NULL")
		} else {
			query = query.Where(sq.Expr("UserId NOT IN (SELECT UserId FROM Bots)"))
		}
	}

	if !options.IncludeRemoteUsers || !options.IncludeDeleted {
		query = query.LeftJoin("Users ON s.UserId = Users.Id")
	}

	if !options.IncludeRemoteUsers {
		query = query.Where(sq.Or{sq.Eq{"Users.RemoteId": ""}, sq.Eq{"Users.RemoteId": nil}})
	}

	if !options.IncludeDeleted {
		query = query.Where("Users.DeleteAt = 0")
	}

	queryStr, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "analytics_active_count_tosql")
	}

	var v int64
	err = us.GetReplica().Get(&v, queryStr, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count Users")
	}
	return v, nil
}

func (us SqlUserStore) AnalyticsActiveCountForPeriod(startTime int64, endTime int64, options model.UserCountOptions) (int64, error) {
	query := us.getQueryBuilder().Select("COUNT(*)").From("Status AS s").Where("LastActivityAt > ? AND LastActivityAt <= ?", startTime, endTime)

	if !options.IncludeBotAccounts {
		if us.DriverName() == model.DatabaseDriverPostgres {
			query = query.LeftJoin("Bots ON s.UserId = Bots.UserId").Where("Bots.UserId IS NULL")
		} else {
			query = query.Where(sq.Expr("UserId NOT IN (SELECT UserId FROM Bots)"))
		}
	}

	if !options.IncludeRemoteUsers || !options.IncludeDeleted {
		query = query.LeftJoin("Users ON s.UserId = Users.Id")
	}

	if !options.IncludeRemoteUsers {
		query = query.Where(sq.Or{sq.Eq{"Users.RemoteId": ""}, sq.Eq{"Users.RemoteId": nil}})
	}

	if !options.IncludeDeleted {
		query = query.Where("Users.DeleteAt = 0")
	}

	queryStr, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "Failed to build query.")
	}

	var v int64
	err = us.GetReplica().Get(&v, queryStr, args...)
	if err != nil {
		return 0, errors.Wrap(err, "Unable to get the active users during the requested period.")
	}
	return v, nil
}

func (us SqlUserStore) GetUnreadCount(userId string, isCRTEnabled bool) (int64, error) {
	var mentionCountColumn = "cm.MentionCount"
	if isCRTEnabled {
		mentionCountColumn = "cm.MentionCountRoot"
	}

	query := `
		SELECT SUM(` + mentionCountColumn + `)
		FROM Channels c
		INNER JOIN ChannelMembers cm
			ON cm.ChannelId = c.Id
			AND cm.UserId = ?
			AND c.DeleteAt = 0
	`

	var count int64
	err := us.GetReplica().Get(&count, query, userId)
	if err != nil {
		return count, errors.Wrapf(err, "failed to count unread Channels for userId=%s", userId)
	}

	return count, nil
}

func (us SqlUserStore) GetUnreadCountForChannel(userId string, channelId string) (int64, error) {
	var count int64
	err := us.GetReplica().Get(&count, "SELECT SUM(CASE WHEN c.Type = ? THEN (c.TotalMsgCount - cm.MsgCount) ELSE cm.MentionCount END) FROM Channels c INNER JOIN ChannelMembers cm ON c.Id = cm.ChannelId AND cm.ChannelId = ? AND cm.UserId = ?", model.ChannelTypeDirect, channelId, userId)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to get unread count for channelId=%s and userId=%s", channelId, userId)
	}
	return count, nil
}

func (us SqlUserStore) GetAnyUnreadPostCountForChannel(userId string, channelId string) (int64, error) {
	var count int64
	err := us.GetReplica().Get(&count, "SELECT SUM(c.TotalMsgCount - cm.MsgCount) FROM Channels c INNER JOIN ChannelMembers cm ON c.Id = cm.ChannelId AND cm.ChannelId = ? AND cm.UserId = ?", channelId, userId)
	if err != nil {
		return count, errors.Wrapf(err, "failed to get any unread count for channelId=%s and userId=%s", channelId, userId)
	}
	return count, nil
}

func (us SqlUserStore) Search(rctx request.CTX, teamId string, term string, options *model.UserSearchOptions) ([]*model.User, error) {
	query := us.usersQuery.
		OrderBy("Username ASC").
		Limit(uint64(options.Limit))

	if teamId != "" {
		query = query.Join("TeamMembers tm ON ( tm.UserId = u.Id AND tm.DeleteAt = 0 AND tm.TeamId = ? )", teamId)
	}
	return us.performSearch(query, term, options)
}

func (us SqlUserStore) SearchWithoutTeam(term string, options *model.UserSearchOptions) ([]*model.User, error) {
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

func (us SqlUserStore) SearchNotInTeam(notInTeamId string, term string, options *model.UserSearchOptions) ([]*model.User, error) {
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

func (us SqlUserStore) SearchNotInChannel(teamId string, channelId string, term string, options *model.UserSearchOptions) ([]*model.User, error) {
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

func (us SqlUserStore) SearchInChannel(channelId string, term string, options *model.UserSearchOptions) ([]*model.User, error) {
	query := us.usersQuery.
		Join("ChannelMembers cm ON ( cm.UserId = u.Id AND cm.ChannelId = ? )", channelId).
		OrderBy("Username ASC").
		Limit(uint64(options.Limit))

	return us.performSearch(query, term, options)
}

func (us SqlUserStore) SearchInGroup(groupID string, term string, options *model.UserSearchOptions) ([]*model.User, error) {
	query := us.usersQuery.
		Join("GroupMembers gm ON ( gm.UserId = u.Id AND gm.GroupId = ? AND gm.DeleteAt = 0 )", groupID).
		OrderBy("Username ASC").
		Limit(uint64(options.Limit))

	return us.performSearch(query, term, options)
}

func (us SqlUserStore) SearchNotInGroup(groupID string, term string, options *model.UserSearchOptions) ([]*model.User, error) {
	query := us.usersQuery.
		LeftJoin("GroupMembers gm ON ( gm.UserId = u.Id AND gm.GroupId = ? )", groupID).
		Where("(gm.UserId IS NULL OR gm.deleteat != 0)").
		OrderBy("Username ASC").
		Limit(uint64(options.Limit))

	return us.performSearch(query, term, options)
}

func generateSearchQuery(query sq.SelectBuilder, terms []string, fields []string, isPostgreSQL bool) sq.SelectBuilder {
	for _, term := range terms {
		searchFields := []string{}
		termArgs := []any{}
		for _, field := range fields {
			if isPostgreSQL {
				searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(?) escape '*' ", field))
			} else {
				searchFields = append(searchFields, fmt.Sprintf("%s LIKE ? escape '*' ", field))
			}
			termArgs = append(termArgs, fmt.Sprintf("%%%s%%", strings.TrimLeft(term, "@")))
		}
		searchFields = append(searchFields, "Id = ?")
		termArgs = append(termArgs, strings.TrimLeft(term, "@"))
		query = query.Where(fmt.Sprintf("(%s)", strings.Join(searchFields, " OR ")), termArgs...)
	}

	return query
}

func (us SqlUserStore) performSearch(query sq.SelectBuilder, term string, options *model.UserSearchOptions) ([]*model.User, error) {
	term = sanitizeSearchTerm(term, "*")

	var searchType []string
	if options.AllowEmails {
		if options.AllowFullNames {
			searchType = UserSearchTypeAll
		} else {
			searchType = UserSearchTypeAllNoFullName
		}
	} else {
		if options.AllowFullNames {
			searchType = UserSearchTypeNames
		} else {
			searchType = UserSearchTypeNamesNoFullName
		}
	}

	isPostgreSQL := us.DriverName() == model.DatabaseDriverPostgres

	query = applyRoleFilter(query, options.Role, isPostgreSQL)
	query = applyMultiRoleFilters(query, options.Roles, options.TeamRoles, options.ChannelRoles, isPostgreSQL)

	if !options.AllowInactive {
		query = query.Where("u.DeleteAt = 0")
	}

	if strings.TrimSpace(term) != "" {
		query = generateSearchQuery(query, strings.Fields(term), searchType, isPostgreSQL)
	}

	query = applyViewRestrictionsFilter(query, options.ViewRestrictions, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "perform_search_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Users with term=%s and searchType=%v", term, searchType)
	}
	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) AnalyticsGetInactiveUsersCount() (int64, error) {
	var count int64
	query := us.getQueryBuilder().
		Select("COUNT(Id)").
		From("Users")
	if us.DriverName() == model.DatabaseDriverPostgres {
		query = query.LeftJoin("Bots ON Users.ID = Bots.UserId").
			Where(sq.And{
				sq.Gt{"Users.DeleteAt": 0},
				sq.Eq{"Bots.UserId": nil},
			})
	} else {
		query = query.Where(sq.And{
			sq.Expr("Users.Id NOT IN (SELECT UserId FROM Bots)"),
			sq.Gt{"Users.DeleteAt": 0},
		})
	}
	queryStr, args, err := query.ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to create a SQL query to count inactive users")
	}
	err = us.GetReplica().Get(&count, queryStr, args...)

	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count inactive Users")
	}
	return count, nil
}

func (us SqlUserStore) AnalyticsGetExternalUsers(hostDomain string) (bool, error) {
	var count int64
	err := us.GetReplica().Get(&count, "SELECT COUNT(Id) FROM Users WHERE LOWER(Email) NOT LIKE ?", "%@"+strings.ToLower(hostDomain))
	if err != nil {
		return false, errors.Wrap(err, "failed to count inactive Users")
	}
	return count > 0, nil
}

func (us SqlUserStore) AnalyticsGetGuestCount() (int64, error) {
	var count int64
	err := us.GetReplica().Get(&count, "SELECT count(*) FROM Users WHERE Roles LIKE ? and DeleteAt = 0", "%system_guest%")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count guest Users")
	}
	return count, nil
}

func (us SqlUserStore) AnalyticsGetSystemAdminCount() (int64, error) {
	var count int64
	err := us.GetReplica().Get(&count, "SELECT count(*) FROM Users WHERE Roles LIKE ? and DeleteAt = 0", "%system_admin%")
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count system admin Users")
	}
	return count, nil
}

func (us SqlUserStore) GetProfilesNotInTeam(teamId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	users := []*model.User{}
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
		return nil, errors.Wrap(err, "get_profiles_not_in_team_tosql")
	}

	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
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
			AND tm.TeamId = ?
			AND tm.DeleteAt = 0
		WHERE
			tm.UserId IS NULL
	`
	var etag string
	err := us.GetReplica().Get(&etag, querystr, teamId)
	if err != nil {
		return fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
	}

	return fmt.Sprintf("%v.%v", model.CurrentVersion, etag)
}

func (us SqlUserStore) ClearAllCustomRoleAssignments() (err error) {
	builtInRoles := model.MakeDefaultRoles()
	lastUserId := strings.Repeat("0", 26)

	for {
		var transaction *sqlxTxWrapper
		var err error

		if transaction, err = us.GetMaster().Beginx(); err != nil {
			return errors.Wrap(err, "begin_transaction")
		}
		defer finalizeTransactionX(transaction, &err)

		users := []*model.User{}
		if err := transaction.Select(&users, "SELECT * from Users WHERE Id > ? ORDER BY Id LIMIT 1000", lastUserId); err != nil {
			return errors.Wrapf(err, "failed to find Users with id > %s", lastUserId)
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
				if _, err := transaction.Exec("UPDATE Users SET Roles = ? WHERE Id = ?", newRolesString, user.Id); err != nil {
					return errors.Wrap(err, "failed to update Users")
				}
			}
		}

		if err := transaction.Commit(); err != nil {
			return errors.Wrap(err, "commit_transaction")
		}
	}

	return nil
}

func (us SqlUserStore) InferSystemInstallDate() (int64, error) {
	var createAt int64
	err := us.GetReplica().Get(&createAt, "SELECT CreateAt FROM Users WHERE CreateAt IS NOT NULL ORDER BY CreateAt ASC LIMIT 1")
	if err != nil {
		return 0, errors.Wrap(err, "failed to infer system install date")
	}

	return createAt, nil
}

func (us SqlUserStore) GetUsersBatchForIndexing(startTime int64, startFileID string, limit int) ([]*model.UserForIndexing, error) {
	users := []*model.User{}
	usersQuery, args, err := us.usersQuery.
		Where(sq.Or{
			sq.Gt{"u.CreateAt": startTime},
			sq.And{
				sq.Eq{"u.CreateAt": startTime},
				sq.Gt{"u.Id": startFileID},
			},
		}).
		OrderBy("u.CreateAt ASC, u.Id ASC").
		Limit(uint64(limit)).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "GetUsersBatchForIndexing_ToSql1")
	}

	err = us.GetSearchReplicaX().Select(&users, usersQuery, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	userIds := []string{}
	for _, user := range users {
		userIds = append(userIds, user.Id)
	}

	channelMembers := []*model.ChannelMember{}
	channelMembersQuery, args, err := us.getQueryBuilder().
		Select(`
				cm.ChannelId,
				cm.UserId,
				cm.Roles,
				cm.LastViewedAt,
				cm.MsgCount,
				cm.MentionCount,
				cm.MentionCountRoot,
				cm.NotifyProps,
				cm.LastUpdateAt,
				cm.SchemeUser,
				cm.SchemeAdmin,
				(cm.SchemeGuest IS NOT NULL AND cm.SchemeGuest) as SchemeGuest
			`).
		From("ChannelMembers cm").
		Join("Channels c ON cm.ChannelId = c.Id").
		Where(sq.And{
			sq.Eq{
				"cm.UserId": userIds,
			},
			sq.Or{
				sq.Eq{"c.Type": model.ChannelTypeOpen},
				sq.Eq{"c.Type": model.ChannelTypeDirect},
				sq.Eq{"c.Type": model.ChannelTypeGroup},
			},
		}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "GetUsersBatchForIndexing_ToSql2")
	}

	err = us.GetSearchReplicaX().Select(&channelMembers, channelMembersQuery, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find ChannelMembers")
	}

	teamMembers := []*model.TeamMember{}
	teamMembersQuery, args, err := us.getQueryBuilder().
		Select("TeamId, UserId, Roles, DeleteAt, (SchemeGuest IS NOT NULL AND SchemeGuest) as SchemeGuest, SchemeUser, SchemeAdmin").
		From("TeamMembers").
		Where(sq.Eq{"UserId": userIds, "DeleteAt": 0}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "GetUsersBatchForIndexing_ToSql3")
	}

	err = us.GetSearchReplicaX().Select(&teamMembers, teamMembersQuery, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find TeamMembers")
	}

	userMap := map[string]*model.UserForIndexing{}
	for _, user := range users {
		userMap[user.Id] = &model.UserForIndexing{
			Id:          user.Id,
			Username:    user.Username,
			Nickname:    user.Nickname,
			FirstName:   user.FirstName,
			LastName:    user.LastName,
			Roles:       user.Roles,
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

func (us SqlUserStore) GetTeamGroupUsers(teamID string) ([]*model.User, error) {
	query := applyTeamGroupConstrainedFilter(us.usersQuery, teamID)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_team_group_users_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) GetChannelGroupUsers(channelID string) ([]*model.User, error) {
	query := applyChannelGroupConstrainedFilter(us.usersQuery, channelID)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_channel_group_users_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Users")
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

	teams := make([]any, len(restrictions.Teams))
	for i, v := range restrictions.Teams {
		teams[i] = v
	}
	channels := make([]any, len(restrictions.Channels))
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

func (us SqlUserStore) PromoteGuestToUser(userId string) (err error) {
	transaction, err := us.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	user, err := us.Get(context.Background(), userId)
	if err != nil {
		return err
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
		return errors.Wrap(err, "promote_guest_to_user_tosql")
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return errors.Wrapf(err, "failed to update User with userId=%s", userId)
	}

	query = us.getQueryBuilder().Update("ChannelMembers").
		Set("SchemeUser", true).
		Set("SchemeGuest", false).
		Where(sq.Eq{"UserId": userId})

	queryString, args, err = query.ToSql()
	if err != nil {
		return errors.Wrap(err, "promote_guest_to_user_tosql")
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return errors.Wrapf(err, "failed to update ChannelMembers with userId=%s", userId)
	}

	query = us.getQueryBuilder().Update("TeamMembers").
		Set("SchemeUser", true).
		Set("SchemeGuest", false).
		Where(sq.Eq{"UserId": userId})

	queryString, args, err = query.ToSql()
	if err != nil {
		return errors.Wrap(err, "promote_guest_to_user_tosql")
	}

	if _, err := transaction.Exec(queryString, args...); err != nil {
		return errors.Wrapf(err, "failed to update TeamMembers with userId=%s", userId)
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}
	return nil
}

func (us SqlUserStore) DemoteUserToGuest(userID string) (_ *model.User, err error) {
	transaction, err := us.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	user, err := us.Get(context.Background(), userID)
	if err != nil {
		return nil, err
	}

	curTime := model.GetMillis()
	newRolesDBStr := model.SystemGuestRoleId

	query := us.getQueryBuilder().Update("Users").
		Set("Roles", newRolesDBStr).
		Set("UpdateAt", curTime).
		Where(sq.Eq{"Id": userID})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "demote_user_to_guest_tosql")
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to update User with userId=%s", userID)
	}

	user.Roles = newRolesDBStr
	user.UpdateAt = curTime

	query = us.getQueryBuilder().Update("ChannelMembers").
		Set("SchemeUser", false).
		Set("SchemeAdmin", false).
		Set("SchemeGuest", true).
		Where(sq.Eq{"UserId": userID})

	queryString, args, err = query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "demote_user_to_guest_tosql")
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to update ChannelMembers with userId=%s", userID)
	}

	query = us.getQueryBuilder().Update("TeamMembers").
		Set("SchemeUser", false).
		Set("SchemeAdmin", false).
		Set("SchemeGuest", true).
		Where(sq.Eq{"UserId": userID})

	queryString, args, err = query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "demote_user_to_guest_tosql")
	}

	if _, err := transaction.Exec(queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to update TeamMembers with userId=%s", userID)
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}
	return user, nil
}

func (us SqlUserStore) AutocompleteUsersInChannel(rctx request.CTX, teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, error) {
	var usersInChannel, usersNotInChannel []*model.User
	g := errgroup.Group{}
	g.Go(func() (err error) {
		usersInChannel, err = us.SearchInChannel(channelId, term, options)
		return err
	})
	g.Go(func() (err error) {
		usersNotInChannel, err = us.SearchNotInChannel(teamId, channelId, term, options)
		return err
	})
	err := g.Wait()
	if err != nil {
		return nil, err
	}

	return &model.UserAutocompleteInChannel{
		InChannel:    usersInChannel,
		OutOfChannel: usersNotInChannel,
	}, nil
}

// GetKnownUsers returns the list of user ids of users with any direct
// relationship with a user. That means any user sharing any channel, including
// direct and group channels.
func (us SqlUserStore) GetKnownUsers(userId string) ([]string, error) {
	userIds := []string{}
	usersQuery, args, err := us.getQueryBuilder().
		Select("DISTINCT ocm.UserId").
		From("ChannelMembers AS cm").
		Join("ChannelMembers AS ocm ON ocm.ChannelId = cm.ChannelId").
		Where(sq.NotEq{"ocm.UserId": userId}).
		Where(sq.Eq{"cm.UserId": userId}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "GetKnownUsers_ToSql")
	}

	err = us.GetSearchReplicaX().Select(&userIds, usersQuery, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find ChannelMembers")
	}

	return userIds, nil
}

// IsEmpty returns whether or not the Users table is empty.
func (us SqlUserStore) IsEmpty(excludeBots bool) (bool, error) {
	var hasRows bool

	builder := us.getQueryBuilder().
		Select("1").
		Prefix("SELECT EXISTS (").
		From("Users")

	if excludeBots {
		if us.DriverName() == model.DatabaseDriverPostgres {
			builder = builder.LeftJoin("Bots ON Users.Id = Bots.UserId").Where("Bots.UserId IS NULL")
		} else {
			builder = builder.Where(sq.Expr("Users.Id NOT IN (SELECT UserId FROM Bots)"))
		}
	}

	builder = builder.Suffix(")")

	query, args, err := builder.ToSql()
	if err != nil {
		return false, errors.Wrapf(err, "users_is_empty_to_sql")
	}

	if err = us.GetReplica().Get(&hasRows, query, args...); err != nil {
		return false, errors.Wrap(err, "failed to check if table is empty")
	}
	return !hasRows, nil
}

func (us SqlUserStore) GetUsersWithInvalidEmails(page int, perPage int, restrictedDomains string) ([]*model.User, error) {
	domainArray := strings.Split(restrictedDomains, ",")
	query := us.usersQuery.
		LeftJoin("Bots ON u.Id = Bots.UserId").
		Where("Bots.UserId IS NULL").
		Where("u.Roles != 'system_guest'").
		Where("u.DeleteAt = 0").
		Where("(u.AuthService = '' OR u.AuthService IS NULL)")

	for _, d := range domainArray {
		if d != "" {
			query = query.Where("u.Email NOT LIKE LOWER(?)", wildcardSearchTerm(d))
		}
	}

	query = query.Offset(uint64(page * perPage)).Limit(uint64(perPage))

	queryString, args, err := query.ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "users_get_many_tosql")
	}

	users := []*model.User{}
	if err := us.GetReplica().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "users_get_many_select")
	}

	for _, u := range users {
		u.Sanitize(map[string]bool{})
	}

	return users, nil
}

func (us SqlUserStore) RefreshPostStatsForUsers() error {
	if us.DriverName() == model.DatabaseDriverPostgres {
		if _, err := us.GetMaster().Exec("REFRESH MATERIALIZED VIEW poststats"); err != nil {
			return errors.Wrap(err, "users_refresh_post_stats_exec")
		}
	} else {
		mlog.Debug("Skipped running refresh post stats, only available on Postgres")
	}

	return nil
}

func applyUserReportFilter(query sq.SelectBuilder, filter *model.UserReportOptions, isPostgres bool) sq.SelectBuilder {
	query = applyRoleFilter(query, filter.Role, isPostgres)
	if filter.HasNoTeam {
		query = query.Where(sq.Expr("u.Id NOT IN (SELECT UserId FROM TeamMembers WHERE DeleteAt = 0)"))
	} else if filter.Team != "" {
		query = query.Join("TeamMembers tm ON (tm.UserId = u.Id AND tm.DeleteAt = 0)").
			Where(sq.Eq{"tm.TeamId": filter.Team})
	}
	if filter.HideActive {
		query = query.Where(sq.Gt{"u.DeleteAt": 0})
	}
	if filter.HideInactive {
		query = query.Where(sq.Eq{"u.DeleteAt": 0})
	}

	if strings.TrimSpace(filter.SearchTerm) != "" {
		query = generateSearchQuery(query, strings.Fields(sanitizeSearchTerm(filter.SearchTerm, "*")), UserSearchTypeAll, isPostgres)
	}

	return query
}

func (us SqlUserStore) GetUserCountForReport(filter *model.UserReportOptions) (int64, error) {
	isPostgres := us.DriverName() == model.DatabaseDriverPostgres
	query := us.getQueryBuilder().
		Select("COUNT(u.Id)").
		From("Users u")

	if isPostgres {
		query = query.LeftJoin("Bots ON u.Id = Bots.UserId").Where("Bots.UserId IS NULL")
	} else {
		query = query.Where(sq.Expr("u.Id NOT IN (SELECT UserId FROM Bots)"))
	}

	query = applyUserReportFilter(query, filter, isPostgres)
	queryStr, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "user_count_report_tosql")
	}
	var v int64
	err = us.GetReplica().Get(&v, queryStr, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count Users for report")
	}
	return v, nil
}

func (us SqlUserStore) GetUserReport(filter *model.UserReportOptions) ([]*model.UserReportQuery, error) {
	isPostgres := us.DriverName() == model.DatabaseDriverPostgres
	selectColumns := []string{"u.*", "MAX(s.LastActivityAt) AS LastStatusAt"}
	if isPostgres {
		selectColumns = append(selectColumns,
			"MAX(ps.LastPostDate) AS LastPostDate",
			"COUNT(ps.Day) AS DaysActive",
			"SUM(ps.NumPosts) AS TotalPosts",
		)
	}

	sortDirection := "ASC"
	if filter.SortDesc {
		sortDirection = "DESC"
	}

	query := us.getQueryBuilder().
		Select(selectColumns...).
		From("Users u").
		LeftJoin("Status s ON s.UserId = u.Id").
		Where(sq.Expr("u.Id NOT IN (SELECT UserId FROM Bots)")).
		GroupBy("u.Id")

	// no need to apply any filtering and pagination if there are no
	// previous element ID and value provided.
	if filter.FromId != "" && filter.FromColumnValue != "" {
		if (filter.Direction == "prev" && !filter.SortDesc) || (filter.Direction == "next" && filter.SortDesc) {
			sortDirection = "DESC"

			query = query.Where(sq.Or{
				sq.Lt{filter.SortColumn: filter.FromColumnValue},
				sq.And{
					sq.Eq{filter.SortColumn: filter.FromColumnValue},
					sq.Lt{"u.Id": filter.FromId},
				},
			})
		} else {
			sortDirection = "ASC"

			query = query.Where(sq.Or{
				sq.Gt{filter.SortColumn: filter.FromColumnValue},
				sq.And{
					sq.Eq{filter.SortColumn: filter.FromColumnValue},
					sq.Gt{"u.Id": filter.FromId},
				},
			})
		}
	}

	query = query.OrderBy(filter.SortColumn+" "+sortDirection, "u.Id")

	if filter.PageSize > 0 {
		query = query.Limit(uint64(filter.PageSize))
	}

	if isPostgres {
		joinSql := sq.And{}
		if filter.StartAt > 0 {
			startDate := time.UnixMilli(filter.StartAt)
			joinSql = append(joinSql, sq.GtOrEq{"ps.Day": startDate.Format("2006-01-02")})
		}
		if filter.EndAt > 0 {
			endDate := time.UnixMilli(filter.EndAt)
			joinSql = append(joinSql, sq.Lt{"ps.Day": endDate.Format("2006-01-02")})
		}
		sql, args, err := joinSql.ToSql()
		if err != nil {
			return nil, err
		}
		query = query.LeftJoin("PostStats ps ON ps.UserId = u.Id AND "+sql, args...)
	}

	query = applyUserReportFilter(query, filter, isPostgres)

	parentQuery := query
	// If we're going a page back...
	//
	// The way pagination works, we get the previous page's rows
	// in reverse order. So, we use parent query on it to
	// reverse the order in database itself.
	if filter.Direction == "prev" {
		reverseSortDirection := "ASC"
		if sortDirection == "ASC" {
			reverseSortDirection = "DESC"
		}

		parentQuery = us.getQueryBuilder().
			Select("*").
			FromSelect(query, "data").
			OrderBy(filter.SortColumn+" "+reverseSortDirection, "Id")
	}

	userResults := []*model.UserReportQuery{}
	err := us.GetReplica().SelectBuilder(&userResults, parentQuery)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get users for reporting")
	}

	return userResults, nil
}
