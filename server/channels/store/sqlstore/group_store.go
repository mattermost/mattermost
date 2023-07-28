// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type selectType int

const (
	selectGroups selectType = iota
	selectCountGroups
)

type groupTeam struct {
	model.GroupSyncable
	TeamId string
}

type groupChannel struct {
	model.GroupSyncable
	ChannelId string
}

type groupTeamJoin struct {
	groupTeam
	TeamDisplayName string
	TeamType        string
}

type groupChannelJoin struct {
	groupChannel
	ChannelDisplayName string
	TeamDisplayName    string
	TeamType           string
	ChannelType        string
	TeamId             string
}

type SqlGroupStore struct {
	*SqlStore
}

func newSqlGroupStore(sqlStore *SqlStore) store.GroupStore {
	return &SqlGroupStore{SqlStore: sqlStore}
}

func (s *SqlGroupStore) Create(group *model.Group) (*model.Group, error) {
	if group.Id != "" {
		return nil, store.NewErrInvalidInput("Group", "id", group.Id)
	}

	if err := group.IsValidForCreate(); err != nil {
		return nil, err
	}

	group.Id = model.NewId()
	group.CreateAt = model.GetMillis()
	group.UpdateAt = group.CreateAt

	if _, err := s.GetMasterX().NamedExec(`INSERT INTO UserGroups
		(Id, Name, DisplayName, Description, Source, RemoteId, CreateAt, UpdateAt, DeleteAt, AllowReference)
		VALUES
		(:Id, :Name, :DisplayName, :Description, :Source, :RemoteId, :CreateAt, :UpdateAt, :DeleteAt, :AllowReference)`, group); err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "groups_name_key"}) {
			return nil, errors.Wrapf(err, "Group with name %s already exists", *group.Name)
		}
		return nil, errors.Wrap(err, "failed to save Group")
	}

	return group, nil
}

func (s *SqlGroupStore) CreateWithUserIds(g *model.GroupWithUserIds) (_ *model.Group, err error) {
	if g.Id != "" {
		return nil, store.NewErrInvalidInput("Group", "id", g.Id)
	}

	// Check if group values are formatted correctly
	if appErr := g.IsValidForCreate(); appErr != nil {
		return nil, appErr
	}

	// Check Users exist
	if err = s.checkUsersExist(g.UserIds); err != nil {
		return nil, err
	}

	g.Id = model.NewId()
	g.CreateAt = model.GetMillis()
	g.UpdateAt = g.CreateAt

	groupInsertQuery, groupInsertArgs, err := s.getQueryBuilder().
		Insert("UserGroups").
		Columns("Id", "Name", "DisplayName", "Description", "Source", "RemoteId", "CreateAt", "UpdateAt", "DeleteAt", "AllowReference").
		Values(g.Id, g.Name, g.DisplayName, g.Description, g.Source, g.RemoteId, g.CreateAt, g.UpdateAt, 0, g.AllowReference).
		ToSql()
	if err != nil {
		return nil, err
	}

	usersInsertQuery, usersInsertArgs, err := s.buildInsertGroupUsersQuery(g.Id, g.UserIds)
	if err != nil {
		return nil, err
	}

	txn, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(txn, &err)

	// Create a new usergroup
	if _, err = txn.Exec(groupInsertQuery, groupInsertArgs...); err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "groups_name_key"}) {
			return nil, store.NewErrUniqueConstraint("Name")
		}
		return nil, errors.Wrap(err, "failed to save Group")
	}
	// Insert the Group Members
	if _, err = executePossiblyEmptyQuery(txn, usersInsertQuery, usersInsertArgs...); err != nil {
		return nil, err
	}

	// Get the new Group along with the member count
	groupGroupQuery := `
		SELECT
			UserGroups.*,
			A.Count AS MemberCount
		FROM
			UserGroups
			INNER JOIN (
				SELECT
					UserGroups.Id,
					COUNT(GroupMembers.UserId) AS Count
				FROM
					UserGroups
					LEFT JOIN GroupMembers ON UserGroups.Id = GroupMembers.GroupId
				WHERE
					UserGroups.Id = ?
				GROUP BY
					UserGroups.Id
				ORDER BY
					UserGroups.DisplayName,
					UserGroups.Id
				LIMIT
					? OFFSET ?
			) AS A ON UserGroups.Id = A.Id
		ORDER BY
			UserGroups.CreateAt DESC`
	var newGroup group
	if err = txn.Get(&newGroup, groupGroupQuery, g.Id, 1, 0); err != nil {
		return nil, err
	}
	if err = txn.Commit(); err != nil {
		return nil, err
	}
	return newGroup.ToModel(), nil
}

func (s *SqlGroupStore) checkUsersExist(userIDs []string) error {
	if len(userIDs) == 0 {
		return nil
	}
	usersSelectQuery, usersSelectArgs, err := s.getQueryBuilder().
		Select("Id").
		From("Users").
		Where(sq.Eq{"Id": userIDs, "DeleteAt": 0}).
		ToSql()
	if err != nil {
		return err
	}
	var rows []string
	err = s.GetReplicaX().Select(&rows, usersSelectQuery, usersSelectArgs...)
	if err != nil {
		return err
	}
	if len(rows) == len(userIDs) {
		return nil
	}
	retrievedIDs := make(map[string]bool)
	for _, userID := range rows {
		retrievedIDs[userID] = true
	}
	for _, userID := range userIDs {
		if _, ok := retrievedIDs[userID]; !ok {
			return store.NewErrNotFound("User", userID)
		}
	}
	return nil
}

func (s *SqlGroupStore) buildInsertGroupUsersQuery(groupId string, userIds []string) (query string, args []any, err error) {
	if len(userIds) > 0 {
		builder := s.getQueryBuilder().
			Insert("GroupMembers").
			Columns("GroupId", "UserId", "CreateAt", "DeleteAt")
		for _, userId := range userIds {
			builder = builder.Values(groupId, userId, model.GetMillis(), 0)
		}
		query, args, err = builder.ToSql()
	}
	return
}

func (s *SqlGroupStore) Get(groupId string) (*model.Group, error) {
	var group model.Group
	query, args, _ := s.getQueryBuilder().
		Select("*").
		From("UserGroups").
		Where(sq.Eq{"Id": groupId}).
		ToSql()
	if err := s.GetReplicaX().Get(&group, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", groupId)
		}
		return nil, errors.Wrapf(err, "failed to get Group with id=%s", groupId)
	}

	return &group, nil
}

func (s *SqlGroupStore) GetByName(name string, opts model.GroupSearchOpts) (*model.Group, error) {
	var group model.Group
	query := s.getQueryBuilder().Select("*").From("UserGroups").Where(sq.Eq{"Name": name})
	if opts.FilterAllowReference {
		query = query.Where("AllowReference = true")
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_by_name_tosql")
	}
	if err := s.GetReplicaX().Get(&group, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", fmt.Sprintf("name=%s", name))
		}
		return nil, errors.Wrapf(err, "failed to get Group with name=%s", name)
	}

	return &group, nil
}

func (s *SqlGroupStore) GetByIDs(groupIDs []string) ([]*model.Group, error) {
	groups := []*model.Group{}
	query := s.getQueryBuilder().Select("*").From("UserGroups").Where(sq.Eq{"Id": groupIDs})
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_by_ids_tosql")
	}
	if err := s.GetReplicaX().Select(&groups, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Groups by ids")
	}
	return groups, nil
}

func (s *SqlGroupStore) GetByRemoteID(remoteID string, groupSource model.GroupSource) (*model.Group, error) {
	var group model.Group
	if err := s.GetReplicaX().Get(&group, "SELECT * from UserGroups WHERE RemoteId = ? AND Source = ?", remoteID, groupSource); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", fmt.Sprintf("remoteId=%s", remoteID))
		}
		return nil, errors.Wrapf(err, "failed to get Group with remoteId=%s", remoteID)
	}

	return &group, nil
}

func (s *SqlGroupStore) GetAllBySource(groupSource model.GroupSource) ([]*model.Group, error) {
	groups := []*model.Group{}

	if err := s.GetReplicaX().Select(&groups, "SELECT * from UserGroups WHERE DeleteAt = 0 AND Source = ?", groupSource); err != nil {
		return nil, errors.Wrapf(err, "failed to find Groups by groupSource=%v", groupSource)
	}

	return groups, nil
}

func (s *SqlGroupStore) GetByUser(userId string) ([]*model.Group, error) {
	groups := []*model.Group{}

	query := `
		SELECT
			UserGroups.*
		FROM
			GroupMembers
			JOIN UserGroups ON UserGroups.Id = GroupMembers.GroupId
		WHERE
			GroupMembers.DeleteAt = 0
			AND UserId = ?`

	if err := s.GetReplicaX().Select(&groups, query, userId); err != nil {
		return nil, errors.Wrapf(err, "failed to find Groups with userId=%s", userId)
	}

	return groups, nil
}

func (s *SqlGroupStore) Update(group *model.Group) (*model.Group, error) {
	var retrievedGroup model.Group
	query, args, _ := s.getQueryBuilder().
		Select("*").
		From("UserGroups").
		Where(sq.Eq{"Id": group.Id}).
		ToSql()
	if err := s.GetReplicaX().Get(&retrievedGroup, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", group.Id)
		}
		return nil, errors.Wrapf(err, "failed to get Group with id=%s", group.Id)
	}

	// If updating DeleteAt it can only be to 0
	if group.DeleteAt != retrievedGroup.DeleteAt && group.DeleteAt != 0 {
		return nil, errors.New("DeleteAt should be 0 when updating")
	}

	// Reset these properties, don't update them based on input
	group.CreateAt = retrievedGroup.CreateAt
	group.UpdateAt = model.GetMillis()

	if err := group.IsValidForUpdate(); err != nil {
		return nil, err
	}

	res, err := s.GetMasterX().NamedExec(`UPDATE UserGroups
		SET Name=:Name, DisplayName=:DisplayName, Description=:Description, Source=:Source,
		RemoteId=:RemoteId, CreateAt=:CreateAt, UpdateAt=:UpdateAt, DeleteAt=:DeleteAt, AllowReference=:AllowReference
		WHERE Id=:Id`, group)
	if err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "groups_name_key"}) {
			return nil, store.NewErrUniqueConstraint("Name")
		}
		return nil, errors.Wrap(err, "failed to update Group")
	}
	rowsChanged, _ := res.RowsAffected()
	if rowsChanged > 1 {
		return nil, errors.Wrapf(err, "multiple Groups were update: %d", rowsChanged)
	}

	return group, nil
}

func (s *SqlGroupStore) Delete(groupID string) (*model.Group, error) {
	var group model.Group
	query, args, _ := s.getQueryBuilder().
		Select("*").
		From("UserGroups").
		Where(sq.Eq{
			"Id":       groupID,
			"DeleteAt": 0,
		}).
		ToSql()
	if err := s.GetReplicaX().Get(&group, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", groupID)
		}
		return nil, errors.Wrapf(err, "failed to get Group with id=%s", groupID)
	}

	time := model.GetMillis()
	if _, err := s.GetMasterX().Exec(`UPDATE UserGroups
		SET DeleteAt=?, UpdateAt=?
		WHERE Id=? AND DeleteAt=0`, time, time, groupID); err != nil {
		return nil, errors.Wrapf(err, "failed to update Group with id=%s", groupID)
	}

	return &group, nil
}

func (s *SqlGroupStore) Restore(groupID string) (*model.Group, error) {
	var group model.Group
	if err := s.GetReplicaX().Get(&group, "SELECT * from UserGroups WHERE Id = ? AND DeleteAt != 0", groupID); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", groupID)
		}
		return nil, errors.Wrapf(err, "failed to get Group with id=%s", groupID)
	}

	time := model.GetMillis()
	if _, err := s.GetMasterX().Exec(`UPDATE UserGroups
		SET DeleteAt=0, UpdateAt=?
		WHERE Id=? AND DeleteAt!=0`, time, groupID); err != nil {
		return nil, errors.Wrapf(err, "failed to update Group with id=%s", groupID)
	}

	return &group, nil
}

func (s *SqlGroupStore) GetMember(groupID, userID string) (*model.GroupMember, error) {
	query, args, err := s.getQueryBuilder().
		Select("*").
		From("GroupMembers").
		Where(sq.Eq{"UserId": userID}).
		Where(sq.Eq{"GroupId": groupID}).
		Where(sq.Eq{"DeleteAt": 0}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_member_query")
	}
	var groupMember model.GroupMember
	err = s.GetReplicaX().Get(&groupMember, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "GetMember")
	}

	return &groupMember, nil
}

func (s *SqlGroupStore) GetMemberUsers(groupID string) ([]*model.User, error) {
	groupMembers := []*model.User{}

	query := `
		SELECT
			Users.*
		FROM
			GroupMembers
			JOIN Users ON Users.Id = GroupMembers.UserId
		WHERE
			GroupMembers.DeleteAt = 0
			AND Users.DeleteAt = 0
			AND GroupId = ?`

	if err := s.GetReplicaX().Select(&groupMembers, query, groupID); err != nil {
		return nil, errors.Wrapf(err, "failed to find member Users for Group with id=%s", groupID)
	}

	return groupMembers, nil
}

func (s *SqlGroupStore) GetMemberUsersPage(groupID string, page int, perPage int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	return s.GetMemberUsersSortedPage(groupID, page, perPage, viewRestrictions, model.ShowUsername)
}

func (s *SqlGroupStore) GetMemberUsersSortedPage(groupID string, page int, perPage int, viewRestrictions *model.ViewUsersRestrictions, teammateNameDisplay string) ([]*model.User, error) {
	groupMembers := []*model.User{}

	userQuery := s.getQueryBuilder().
		Select(`u.*`).
		From("GroupMembers").
		Join("Users u ON u.Id = GroupMembers.UserId").
		Where(sq.Eq{"GroupMembers.DeleteAt": 0}).
		Where(sq.Eq{"u.DeleteAt": 0}).
		Where(sq.Eq{"GroupId": groupID})

	userQuery = applyViewRestrictionsFilter(userQuery, viewRestrictions, true)
	queryString, args, err := userQuery.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "")
	}

	orderQuery := s.getQueryBuilder().
		Select("u.*").
		From("(" + queryString + ") AS u")

	if teammateNameDisplay == model.ShowNicknameFullName {
		orderQuery = orderQuery.OrderBy(`
		CASE
			WHEN u.Nickname != '' THEN u.Nickname
			WHEN u.FirstName !=  '' AND u.LastName != '' THEN CONCAT(u.FirstName, ' ', u.LastName)
			WHEN u.FirstName != '' THEN u.FirstName
			WHEN u.LastName != '' THEN u.LastName
			ELSE u.Username
		END`)
	} else if teammateNameDisplay == model.ShowFullName {
		orderQuery = orderQuery.OrderBy(`
		CASE
			WHEN u.FirstName !=  '' AND u.LastName != '' THEN CONCAT(u.FirstName, ' ', u.LastName)
			WHEN u.FirstName != '' THEN u.FirstName
			WHEN u.LastName != '' THEN u.LastName
			ELSE u.Username
		END`)
	} else {
		orderQuery = orderQuery.OrderBy("u.Username")
	}

	orderQuery = orderQuery.
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage))

	queryString, _, err = orderQuery.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "")
	}

	if err := s.GetReplicaX().Select(&groupMembers, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find member Users for Group with id=%s", groupID)
	}

	return groupMembers, nil
}

func (s *SqlGroupStore) GetNonMemberUsersPage(groupID string, page int, perPage int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	groupMembers := []*model.User{}

	if err := s.GetReplicaX().Get(&model.Group{}, "SELECT * FROM UserGroups WHERE Id = ?", groupID); err != nil {
		return nil, errors.Wrap(err, "GetNonMemberUsersPage")
	}

	query := s.getQueryBuilder().
		Select("u.*").
		From("Users u").
		LeftJoin("GroupMembers ON (GroupMembers.UserId = u.Id AND GroupMembers.GroupId = ?)", groupID).
		Where(sq.Eq{"u.DeleteAt": 0}).
		Where("(GroupMembers.UserID IS NULL OR GroupMembers.DeleteAt != 0)").
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage)).
		OrderBy("u.Username ASC")

	query = applyViewRestrictionsFilter(query, viewRestrictions, true)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "")
	}

	if err := s.GetReplicaX().Select(&groupMembers, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find member Users for Group with id=%s", groupID)
	}

	return groupMembers, nil
}

func (s *SqlGroupStore) GetMemberCount(groupID string) (int64, error) {
	return s.GetMemberCountWithRestrictions(groupID, nil)
}

func (s *SqlGroupStore) GetMemberCountWithRestrictions(groupID string, viewRestrictions *model.ViewUsersRestrictions) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(DISTINCT u.Id)").
		From("GroupMembers").
		Join("Users u ON u.Id = GroupMembers.UserId").
		Where(sq.Eq{"GroupMembers.GroupId": groupID}).
		Where(sq.Eq{"u.DeleteAt": 0}).
		Where(sq.Eq{"GroupMembers.DeleteAt": 0})

	query = applyViewRestrictionsFilter(query, viewRestrictions, false)

	queryString, args, err := query.ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "")
	}

	var count int64
	err = s.GetReplicaX().Get(&count, queryString, args...)
	if err != nil {
		return int64(0), errors.Wrapf(err, "failed to count member Users for Group with id=%s", groupID)
	}

	return count, nil
}

func (s *SqlGroupStore) GetMemberUsersInTeam(groupID string, teamID string) ([]*model.User, error) {
	groupMembers := []*model.User{}

	query := `
		SELECT
			Users.*
		FROM
			GroupMembers
			JOIN Users ON Users.Id = GroupMembers.UserId
		WHERE
			GroupId = ?
			AND GroupMembers.UserId IN (
				SELECT TeamMembers.UserId
				FROM TeamMembers
				JOIN Teams ON Teams.Id = ?
				WHERE TeamMembers.TeamId = Teams.Id
				AND TeamMembers.DeleteAt = 0
			)
			AND GroupMembers.DeleteAt = 0
			AND Users.DeleteAt = 0
		`

	if err := s.GetReplicaX().Select(&groupMembers, query, groupID, teamID); err != nil {
		return nil, errors.Wrapf(err, "failed to member Users for groupId=%s and teamId=%s", groupID, teamID)
	}

	return groupMembers, nil
}

func (s *SqlGroupStore) GetMemberUsersNotInChannel(groupID string, channelID string) ([]*model.User, error) {
	groupMembers := []*model.User{}

	query := `
		SELECT
			Users.*
		FROM
			GroupMembers
			JOIN Users ON Users.Id = GroupMembers.UserId
		WHERE
			GroupId = ?
			AND GroupMembers.UserId NOT IN (
				SELECT ChannelMembers.UserId
				FROM ChannelMembers
				WHERE ChannelMembers.ChannelId = ?
			)
			AND GroupMembers.UserId IN (
				SELECT TeamMembers.UserId
				FROM TeamMembers
				JOIN Channels ON Channels.Id = ?
				JOIN Teams ON Teams.Id = Channels.TeamId
				WHERE TeamMembers.TeamId = Teams.Id
				AND TeamMembers.DeleteAt = 0
			)
			AND GroupMembers.DeleteAt = 0
			AND Users.DeleteAt = 0
		`

	if err := s.GetReplicaX().Select(&groupMembers, query, groupID, channelID, channelID); err != nil {
		return nil, errors.Wrapf(err, "failed to member Users for groupId=%s and channelId!=%s", groupID, channelID)
	}

	return groupMembers, nil
}

func (s *SqlGroupStore) UpsertMember(groupID string, userID string) (*model.GroupMember, error) {
	members, query, args, err := s.buildUpsertMembersQuery(groupID, []string{userID})
	if err != nil {
		return nil, err
	}
	if _, err = s.GetMasterX().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to save GroupMember")
	}
	return members[0], nil
}

func (s *SqlGroupStore) DeleteMember(groupID string, userID string) (*model.GroupMember, error) {
	members, query, args, err := s.buildDeleteMembersQuery(groupID, []string{userID})
	if err != nil {
		return nil, err
	}
	if _, err = s.GetMasterX().Exec(query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to update GroupMember with groupId=%s and userId=%s", groupID, userID)
	}

	return members[0], nil
}

func (s *SqlGroupStore) PermanentDeleteMembersByUser(userId string) error {
	if _, err := s.GetMasterX().Exec("DELETE FROM GroupMembers WHERE UserId = ?", userId); err != nil {
		return errors.Wrapf(err, "failed to permanent delete GroupMember with userId=%s", userId)
	}
	return nil
}

func (s *SqlGroupStore) CreateGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, error) {
	if err := groupSyncable.IsValid(); err != nil {
		return nil, err
	}

	// Reset values that shouldn't be updatable by parameter
	groupSyncable.DeleteAt = 0
	groupSyncable.CreateAt = model.GetMillis()
	groupSyncable.UpdateAt = groupSyncable.CreateAt

	var insertErr error

	switch groupSyncable.Type {
	case model.GroupSyncableTypeTeam:
		if _, err := s.Team().Get(groupSyncable.SyncableId); err != nil {
			return nil, err
		}

		_, insertErr = s.GetMasterX().NamedExec(`INSERT INTO GroupTeams
			(GroupId, AutoAdd, SchemeAdmin, CreateAt, DeleteAt, UpdateAt, TeamId)
			VALUES
			(:GroupId, :AutoAdd, :SchemeAdmin, :CreateAt, :DeleteAt, :UpdateAt, :TeamId)`, groupSyncableToGroupTeam(groupSyncable))
	case model.GroupSyncableTypeChannel:
		var channel *model.Channel
		channel, err := s.Channel().Get(groupSyncable.SyncableId, false)
		if err != nil {
			return nil, err
		}
		_, insertErr = s.GetMasterX().NamedExec(`INSERT INTO GroupChannels
			(GroupId, AutoAdd, SchemeAdmin, CreateAt, DeleteAt, UpdateAt, ChannelId)
			VALUES
			(:GroupId, :AutoAdd, :SchemeAdmin, :CreateAt, :DeleteAt, :UpdateAt, :ChannelId)`, groupSyncableToGroupChannel(groupSyncable))
		groupSyncable.TeamID = channel.TeamId
	default:
		return nil, fmt.Errorf("invalid GroupSyncableType: %s", groupSyncable.Type)
	}

	if insertErr != nil {
		return nil, errors.Wrap(insertErr, "unable to insert GroupSyncable")
	}

	return groupSyncable, nil
}

func (s *SqlGroupStore) GetGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, error) {
	groupSyncable, err := s.getGroupSyncable(groupID, syncableID, syncableType)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("GroupSyncable", fmt.Sprintf("groupId=%s, syncableId=%s, syncableType=%s", groupID, syncableID, syncableType))
		}
		return nil, errors.Wrapf(err, "failed to find GroupSyncable with groupId=%s, syncableId=%s, syncableType=%s", groupID, syncableID, syncableType)
	}

	return groupSyncable, nil
}

func (s *SqlGroupStore) getGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, error) {
	var err error
	var result any

	switch syncableType {
	case model.GroupSyncableTypeTeam:
		var team groupTeam
		err = s.GetReplicaX().Get(&team, `SELECT * FROM GroupTeams WHERE GroupId=? AND TeamId=?`, groupID, syncableID)
		result = &team
	case model.GroupSyncableTypeChannel:
		var ch groupChannel
		err = s.GetReplicaX().Get(&ch, `SELECT * FROM GroupChannels WHERE GroupId=? AND ChannelId=?`, groupID, syncableID)
		result = &ch
	}

	if err != nil {
		return nil, err
	}

	if result == nil {
		return nil, sql.ErrNoRows
	}

	groupSyncable := model.GroupSyncable{}
	switch syncableType {
	case model.GroupSyncableTypeTeam:
		groupTeam := result.(*groupTeam)
		groupSyncable.SyncableId = groupTeam.TeamId
		groupSyncable.GroupId = groupTeam.GroupId
		groupSyncable.AutoAdd = groupTeam.AutoAdd
		groupSyncable.CreateAt = groupTeam.CreateAt
		groupSyncable.DeleteAt = groupTeam.DeleteAt
		groupSyncable.UpdateAt = groupTeam.UpdateAt
		groupSyncable.Type = syncableType
	case model.GroupSyncableTypeChannel:
		groupChannel := result.(*groupChannel)
		groupSyncable.SyncableId = groupChannel.ChannelId
		groupSyncable.GroupId = groupChannel.GroupId
		groupSyncable.AutoAdd = groupChannel.AutoAdd
		groupSyncable.CreateAt = groupChannel.CreateAt
		groupSyncable.DeleteAt = groupChannel.DeleteAt
		groupSyncable.UpdateAt = groupChannel.UpdateAt
		groupSyncable.Type = syncableType
	default:
		return nil, fmt.Errorf("unable to convert syncableType: %s", syncableType.String())
	}

	return &groupSyncable, nil
}

func (s *SqlGroupStore) GetAllGroupSyncablesByGroupId(groupID string, syncableType model.GroupSyncableType) ([]*model.GroupSyncable, error) {
	groupSyncables := []*model.GroupSyncable{}

	switch syncableType {
	case model.GroupSyncableTypeTeam:
		sqlQuery := `
			SELECT
				GroupTeams.*,
				Teams.DisplayName AS TeamDisplayName,
				Teams.Type AS TeamType
			FROM
				GroupTeams
				JOIN Teams ON Teams.Id = GroupTeams.TeamId
			WHERE
				GroupId = ? AND GroupTeams.DeleteAt = 0`

		results := []*groupTeamJoin{}
		err := s.GetReplicaX().Select(&results, sqlQuery, groupID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to find GroupTeams with groupId=%s", groupID)
		}
		for _, result := range results {
			groupSyncable := &model.GroupSyncable{
				SyncableId:      result.TeamId,
				GroupId:         result.GroupId,
				AutoAdd:         result.AutoAdd,
				CreateAt:        result.CreateAt,
				DeleteAt:        result.DeleteAt,
				UpdateAt:        result.UpdateAt,
				Type:            syncableType,
				TeamDisplayName: result.TeamDisplayName,
				TeamType:        result.TeamType,
				SchemeAdmin:     result.SchemeAdmin,
			}
			groupSyncables = append(groupSyncables, groupSyncable)
		}
	case model.GroupSyncableTypeChannel:
		sqlQuery := `
			SELECT
				GroupChannels.*,
				Channels.DisplayName AS ChannelDisplayName,
				Teams.DisplayName AS TeamDisplayName,
				Channels.Type As ChannelType,
				Teams.Type As TeamType,
				Teams.Id AS TeamId
			FROM
				GroupChannels
				JOIN Channels ON Channels.Id = GroupChannels.ChannelId
				JOIN Teams ON Teams.Id = Channels.TeamId
			WHERE
				GroupId = ? AND GroupChannels.DeleteAt = 0`

		results := []*groupChannelJoin{}
		err := s.GetReplicaX().Select(&results, sqlQuery, groupID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to find GroupChannels with groupId=%s", groupID)
		}
		for _, result := range results {
			groupSyncable := &model.GroupSyncable{
				SyncableId:         result.ChannelId,
				GroupId:            result.GroupId,
				AutoAdd:            result.AutoAdd,
				CreateAt:           result.CreateAt,
				DeleteAt:           result.DeleteAt,
				UpdateAt:           result.UpdateAt,
				Type:               syncableType,
				ChannelDisplayName: result.ChannelDisplayName,
				ChannelType:        result.ChannelType,
				TeamDisplayName:    result.TeamDisplayName,
				TeamType:           result.TeamType,
				TeamID:             result.TeamID,
				SchemeAdmin:        result.SchemeAdmin,
			}
			groupSyncables = append(groupSyncables, groupSyncable)
		}
	}

	return groupSyncables, nil
}

func (s *SqlGroupStore) UpdateGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, error) {
	retrievedGroupSyncable, err := s.getGroupSyncable(groupSyncable.GroupId, groupSyncable.SyncableId, groupSyncable.Type)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.Wrap(store.NewErrNotFound("GroupSyncable", fmt.Sprintf("groupId=%s, syncableId=%s, syncableType=%s", groupSyncable.GroupId, groupSyncable.SyncableId, groupSyncable.Type)), "GroupSyncable not found")
		}
		return nil, errors.Wrapf(err, "failed to find GroupSyncable with groupId=%s, syncableId=%s, syncableType=%s", groupSyncable.GroupId, groupSyncable.SyncableId, groupSyncable.Type)
	}

	if err := groupSyncable.IsValid(); err != nil {
		return nil, err
	}

	// If updating DeleteAt it can only be to 0
	if groupSyncable.DeleteAt != retrievedGroupSyncable.DeleteAt && groupSyncable.DeleteAt != 0 {
		return nil, errors.New("DeleteAt should be 0 when updating")
	}

	// Reset these properties, don't update them based on input
	groupSyncable.CreateAt = retrievedGroupSyncable.CreateAt
	groupSyncable.UpdateAt = model.GetMillis()

	switch groupSyncable.Type {
	case model.GroupSyncableTypeTeam:
		_, err = s.GetMasterX().NamedExec(`UPDATE GroupTeams
			SET AutoAdd=:AutoAdd, SchemeAdmin=:SchemeAdmin, CreateAt=:CreateAt,
				DeleteAt=:DeleteAt, UpdateAt=:UpdateAt
			WHERE GroupId=:GroupId AND TeamId=:TeamId`, groupSyncableToGroupTeam(groupSyncable))
	case model.GroupSyncableTypeChannel:
		// We need to get the TeamId so redux can manage channels when teams are unlinked
		var channel *model.Channel
		channel, channelErr := s.Channel().Get(groupSyncable.SyncableId, false)
		if channelErr != nil {
			return nil, channelErr
		}

		_, err = s.GetMasterX().NamedExec(`UPDATE GroupChannels
			SET AutoAdd=:AutoAdd, SchemeAdmin=:SchemeAdmin, CreateAt=:CreateAt,
				DeleteAt=:DeleteAt, UpdateAt=:UpdateAt
			WHERE GroupId=:GroupId AND ChannelId=:ChannelId`, groupSyncableToGroupChannel(groupSyncable))

		groupSyncable.TeamID = channel.TeamId
	default:
		return nil, fmt.Errorf("invalid GroupSyncableType: %s", groupSyncable.Type)
	}

	if err != nil {
		return nil, errors.Wrap(err, "failed to update GroupSyncable")
	}

	return groupSyncable, nil
}

func (s *SqlGroupStore) DeleteGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, error) {
	groupSyncable, err := s.getGroupSyncable(groupID, syncableID, syncableType)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("GroupSyncable", fmt.Sprintf("groupId=%s, syncableId=%s, syncableType=%s", groupID, syncableID, syncableType))
		}
		return nil, errors.Wrapf(err, "failed to find GroupSyncable with groupId=%s, syncableId=%s, syncableType=%s", groupID, syncableID, syncableType)
	}

	if groupSyncable.DeleteAt != 0 {
		return nil, store.NewErrInvalidInput("GroupSyncable", "<groupId, syncableId, syncableType>", fmt.Sprintf("<%s, %s, %s>", groupSyncable.GroupId, groupSyncable.SyncableId, groupSyncable.Type))
	}

	time := model.GetMillis()
	groupSyncable.DeleteAt = time
	groupSyncable.UpdateAt = time

	switch groupSyncable.Type {
	case model.GroupSyncableTypeTeam:
		_, err = s.GetMasterX().NamedExec(`UPDATE GroupTeams
			SET AutoAdd=:AutoAdd, SchemeAdmin=:SchemeAdmin, CreateAt=:CreateAt,
				DeleteAt=:DeleteAt, UpdateAt=:UpdateAt
			WHERE GroupId=:GroupId AND TeamId=:TeamId`, groupSyncableToGroupTeam(groupSyncable))
	case model.GroupSyncableTypeChannel:
		_, err = s.GetMasterX().NamedExec(`UPDATE GroupChannels
			SET AutoAdd=:AutoAdd, SchemeAdmin=:SchemeAdmin, CreateAt=:CreateAt,
				DeleteAt=:DeleteAt, UpdateAt=:UpdateAt
			WHERE GroupId=:GroupId AND ChannelId=:ChannelId`, groupSyncableToGroupChannel(groupSyncable))
	default:
		return nil, fmt.Errorf("invalid GroupSyncableType: %s", groupSyncable.Type)
	}

	if err != nil {
		return nil, errors.Wrap(err, "failed to update GroupSyncable")
	}

	return groupSyncable, nil
}

func (s *SqlGroupStore) TeamMembersToAdd(since int64, teamID *string, includeRemovedMembers bool) ([]*model.UserTeamIDPair, error) {
	builder := s.getQueryBuilder().Select("GroupMembers.UserId UserID", "GroupTeams.TeamId TeamID").
		From("GroupMembers").
		Join("GroupTeams ON GroupTeams.GroupId = GroupMembers.GroupId").
		Join("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Join("Teams ON Teams.Id = GroupTeams.TeamId").
		Where(sq.Eq{
			"UserGroups.DeleteAt":   0,
			"GroupTeams.DeleteAt":   0,
			"GroupTeams.AutoAdd":    true,
			"GroupMembers.DeleteAt": 0,
			"Teams.DeleteAt":        0,
		})

	if !includeRemovedMembers {
		builder = builder.
			JoinClause("LEFT OUTER JOIN TeamMembers ON TeamMembers.TeamId = GroupTeams.TeamId AND TeamMembers.UserId = GroupMembers.UserId").
			Where(sq.Eq{"TeamMembers.UserId": nil}).
			Where(sq.Or{
				sq.GtOrEq{"GroupMembers.CreateAt": since},
				sq.GtOrEq{"GroupTeams.UpdateAt": since},
			})
	}
	if teamID != nil {
		builder = builder.Where(sq.Eq{"Teams.Id": *teamID})
	}

	query, params, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_members_to_add_tosql")
	}

	teamMembers := []*model.UserTeamIDPair{}

	err = s.GetMasterX().Select(&teamMembers, query, params...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find UserTeamIDPairs")
	}

	return teamMembers, nil
}

func (s *SqlGroupStore) ChannelMembersToAdd(since int64, channelID *string, includeRemovedMembers bool) ([]*model.UserChannelIDPair, error) {
	builder := s.getQueryBuilder().Select("GroupMembers.UserId UserID", "GroupChannels.ChannelId ChannelID").
		From("GroupMembers").
		Join("GroupChannels ON GroupChannels.GroupId = GroupMembers.GroupId").
		Join("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Join("Channels ON Channels.Id = GroupChannels.ChannelId").
		Where(sq.Eq{
			"UserGroups.DeleteAt":    0,
			"GroupChannels.DeleteAt": 0,
			"GroupChannels.AutoAdd":  true,
			"GroupMembers.DeleteAt":  0,
			"Channels.DeleteAt":      0,
		})

	if !includeRemovedMembers {
		builder = builder.
			JoinClause("LEFT OUTER JOIN ChannelMemberHistory ON ChannelMemberHistory.ChannelId = GroupChannels.ChannelId AND ChannelMemberHistory.UserId = GroupMembers.UserId").
			Where(sq.Eq{
				"ChannelMemberHistory.UserId":    nil,
				"ChannelMemberHistory.LeaveTime": nil,
			}).
			Where(sq.Or{
				sq.GtOrEq{"GroupMembers.CreateAt": since},
				sq.GtOrEq{"GroupChannels.UpdateAt": since},
			})
	}
	if channelID != nil {
		builder = builder.Where(sq.Eq{"Channels.Id": *channelID})
	}

	query, params, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_members_to_add_tosql")
	}

	channelMembers := []*model.UserChannelIDPair{}

	err = s.GetMasterX().Select(&channelMembers, query, params...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find UserChannelIDPairs")
	}

	return channelMembers, nil
}

func groupSyncableToGroupTeam(groupSyncable *model.GroupSyncable) *groupTeam {
	return &groupTeam{
		GroupSyncable: *groupSyncable,
		TeamId:        groupSyncable.SyncableId,
	}
}

func groupSyncableToGroupChannel(groupSyncable *model.GroupSyncable) *groupChannel {
	return &groupChannel{
		GroupSyncable: *groupSyncable,
		ChannelId:     groupSyncable.SyncableId,
	}
}

func (s *SqlGroupStore) TeamMembersToRemove(teamID *string) ([]*model.TeamMember, error) {
	whereStmt := `
		(TeamMembers.TeamId,
			TeamMembers.UserId)
		NOT IN (
			SELECT
				Teams.Id AS TeamId,
				GroupMembers.UserId
			FROM
				Teams
				JOIN GroupTeams ON GroupTeams.TeamId = Teams.Id
				JOIN UserGroups ON UserGroups.Id = GroupTeams.GroupId
				JOIN GroupMembers ON GroupMembers.GroupId = UserGroups.Id
			WHERE
				Teams.GroupConstrained = TRUE
				AND GroupTeams.DeleteAt = 0
				AND UserGroups.DeleteAt = 0
				AND Teams.DeleteAt = 0
				AND GroupMembers.DeleteAt = 0
			GROUP BY
				Teams.Id,
				GroupMembers.UserId)`

	builder := s.getQueryBuilder().Select(
		"TeamMembers.TeamId",
		"TeamMembers.UserId",
		"TeamMembers.Roles",
		"TeamMembers.DeleteAt",
		"TeamMembers.SchemeUser",
		"TeamMembers.SchemeAdmin",
		"(TeamMembers.SchemeGuest IS NOT NULL AND TeamMembers.SchemeGuest) AS SchemeGuest",
	).
		From("TeamMembers").
		Join("Teams ON Teams.Id = TeamMembers.TeamId").
		LeftJoin("Bots ON Bots.UserId = TeamMembers.UserId").
		Where(sq.Eq{"TeamMembers.DeleteAt": 0, "Teams.DeleteAt": 0, "Teams.GroupConstrained": true, "Bots.UserId": nil}).
		Where(whereStmt)

	if teamID != nil {
		builder = builder.Where(sq.Eq{"TeamMembers.TeamId": *teamID})
	}

	query, params, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_members_to_remove_tosql")
	}

	teamMembers := []*model.TeamMember{}

	err = s.GetReplicaX().Select(&teamMembers, query, params...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find TeamMembers")
	}

	return teamMembers, nil
}

func (s *SqlGroupStore) CountGroupsByChannel(channelId string, opts model.GroupSearchOpts) (int64, error) {
	countQuery := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeChannel, selectCountGroups, channelId, opts)

	countQueryString, args, err := countQuery.ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "count_groups_by_channel_tosql")
	}

	var count int64
	err = s.GetReplicaX().Get(&count, countQueryString, args...)
	if err != nil {
		return int64(0), errors.Wrapf(err, "failed to count Groups by channel with channelId=%s", channelId)
	}

	return count, nil
}

type group struct {
	Id                          string
	Name                        *string
	DisplayName                 string
	Description                 string
	Source                      model.GroupSource
	RemoteId                    *string
	CreateAt                    int64
	UpdateAt                    int64
	DeleteAt                    int64
	HasSyncables                bool
	MemberCount                 *int
	AllowReference              bool
	ChannelMemberCount          *int
	ChannelMemberTimezonesCount *int
}

func (g group) ToModel() *model.Group {
	return &model.Group{
		Id:                          g.Id,
		Name:                        g.Name,
		DisplayName:                 g.DisplayName,
		Description:                 g.Description,
		Source:                      g.Source,
		RemoteId:                    g.RemoteId,
		CreateAt:                    g.CreateAt,
		UpdateAt:                    g.UpdateAt,
		DeleteAt:                    g.DeleteAt,
		HasSyncables:                g.HasSyncables,
		AllowReference:              g.AllowReference,
		MemberCount:                 g.MemberCount,
		ChannelMemberCount:          g.ChannelMemberCount,
		ChannelMemberTimezonesCount: g.ChannelMemberTimezonesCount,
	}
}

type groups []*group

func (groups groups) ToModel() []*model.Group {
	res := make([]*model.Group, 0, len(groups))
	for _, g := range groups {
		res = append(res, g.ToModel())
	}
	return res
}

type groupWithSchemeAdmin struct {
	group
	SyncableSchemeAdmin *bool
}

func (g groupWithSchemeAdmin) ToModel() *model.GroupWithSchemeAdmin {
	if g.SyncableSchemeAdmin == nil {
		g.SyncableSchemeAdmin = model.NewBool(false)
	}
	res := &model.GroupWithSchemeAdmin{
		Group:       *g.group.ToModel(),
		SchemeAdmin: g.SyncableSchemeAdmin,
	}
	return res
}

type groupsWithSchemeAdmin []*groupWithSchemeAdmin

func (groups groupsWithSchemeAdmin) ToModel() []*model.GroupWithSchemeAdmin {
	res := make([]*model.GroupWithSchemeAdmin, 0, len(groups))
	for _, g := range groups {
		res = append(res, g.ToModel())
	}
	return res
}

type groupAssociatedToChannelWithSchemeAdmin struct {
	groupWithSchemeAdmin
	ChannelId string
}

func (g groupAssociatedToChannelWithSchemeAdmin) ToModel() *model.GroupsAssociatedToChannelWithSchemeAdmin {
	withSchemeAdmin := g.groupWithSchemeAdmin.ToModel()
	return &model.GroupsAssociatedToChannelWithSchemeAdmin{
		ChannelId:   g.ChannelId,
		SchemeAdmin: withSchemeAdmin.SchemeAdmin,
		Group:       withSchemeAdmin.Group,
	}
}

type groupsAssociatedToChannelWithSchemeAdmin []groupAssociatedToChannelWithSchemeAdmin

func (groups groupsAssociatedToChannelWithSchemeAdmin) ToModel() []*model.GroupsAssociatedToChannelWithSchemeAdmin {
	res := make([]*model.GroupsAssociatedToChannelWithSchemeAdmin, 0, len(groups))
	for _, g := range groups {
		res = append(res, g.ToModel())
	}
	return res
}

func (s *SqlGroupStore) GetGroupsByChannel(channelId string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, error) {
	query := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeChannel, selectGroups, channelId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		query = query.OrderBy("ug.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_groups_by_channel_tosql")
	}

	groups := groupsWithSchemeAdmin{}
	err = s.GetReplicaX().Select(&groups, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Groups with channelId=%s", channelId)
	}

	return groups.ToModel(), nil
}

func (s *SqlGroupStore) ChannelMembersToRemove(channelID *string) ([]*model.ChannelMember, error) {
	whereStmt := `
		(ChannelMembers.ChannelId,
			ChannelMembers.UserId)
		NOT IN (
			SELECT
				Channels.Id AS ChannelId,
				GroupMembers.UserId
			FROM
				Channels
				JOIN GroupChannels ON GroupChannels.ChannelId = Channels.Id
				JOIN UserGroups ON UserGroups.Id = GroupChannels.GroupId
				JOIN GroupMembers ON GroupMembers.GroupId = UserGroups.Id
			WHERE
				Channels.GroupConstrained = TRUE
				AND GroupChannels.DeleteAt = 0
				AND UserGroups.DeleteAt = 0
				AND Channels.DeleteAt = 0
				AND GroupMembers.DeleteAt = 0
			GROUP BY
				Channels.Id,
				GroupMembers.UserId)`

	builder := s.getQueryBuilder().Select(
		"ChannelMembers.ChannelId",
		"ChannelMembers.UserId",
		"ChannelMembers.LastViewedAt",
		"ChannelMembers.MsgCount",
		"ChannelMembers.MsgCountRoot",
		"ChannelMembers.MentionCount",
		"ChannelMembers.MentionCountRoot",
		"ChannelMembers.NotifyProps",
		"ChannelMembers.LastUpdateAt",
		"ChannelMembers.LastUpdateAt",
		"ChannelMembers.SchemeUser",
		"ChannelMembers.SchemeAdmin",
		"(ChannelMembers.SchemeGuest IS NOT NULL AND ChannelMembers.SchemeGuest) AS SchemeGuest",
	).
		From("ChannelMembers").
		Join("Channels ON Channels.Id = ChannelMembers.ChannelId").
		LeftJoin("Bots ON Bots.UserId = ChannelMembers.UserId").
		Where(sq.Eq{"Channels.DeleteAt": 0, "Channels.GroupConstrained": true, "Bots.UserId": nil}).
		Where(whereStmt)

	if channelID != nil {
		builder = builder.Where(sq.Eq{"ChannelMembers.ChannelId": *channelID})
	}

	query, params, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_members_to_remove_tosql")
	}

	channelMembers := []*model.ChannelMember{}

	err = s.GetReplicaX().Select(&channelMembers, query, params...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find ChannelMembers")
	}

	return channelMembers, nil
}

func (s *SqlGroupStore) groupsBySyncableBaseQuery(st model.GroupSyncableType, t selectType, syncableID string, opts model.GroupSearchOpts) sq.SelectBuilder {
	selectStrs := map[selectType]string{
		selectGroups:      "ug.*, gs.SchemeAdmin AS SyncableSchemeAdmin",
		selectCountGroups: "COUNT(*)",
	}

	var table string
	var idCol string
	if st == model.GroupSyncableTypeTeam {
		table = "GroupTeams"
		idCol = "TeamId"
	} else {
		table = "GroupChannels"
		idCol = "ChannelId"
	}

	query := s.getQueryBuilder().
		Select(selectStrs[t]).
		From(fmt.Sprintf("%s gs", table)).
		LeftJoin("UserGroups ug ON gs.GroupId = ug.Id").
		Where(fmt.Sprintf("ug.DeleteAt = 0 AND gs.%s = ? AND gs.DeleteAt = 0", idCol), syncableID)

	if opts.IncludeMemberCount && t == selectGroups {
		query = s.getQueryBuilder().
			Select(fmt.Sprintf("ug.*, coalesce(Members.MemberCount, 0) AS MemberCount, Group%ss.SchemeAdmin AS SyncableSchemeAdmin", st)).
			From("UserGroups ug").
			LeftJoin("(SELECT GroupMembers.GroupId, COUNT(*) AS MemberCount FROM GroupMembers LEFT JOIN Users ON Users.Id = GroupMembers.UserId WHERE GroupMembers.DeleteAt = 0 AND Users.DeleteAt = 0 GROUP BY GroupId) AS Members ON Members.GroupId = ug.Id").
			LeftJoin(fmt.Sprintf("%[1]s ON %[1]s.GroupId = ug.Id", table)).
			Where(fmt.Sprintf("ug.DeleteAt = 0 AND %[1]s.DeleteAt = 0 AND %[1]s.%[2]s = ?", table, idCol), syncableID).
			OrderBy("ug.DisplayName")
	}

	if opts.FilterAllowReference && t == selectGroups {
		query = query.Where("ug.AllowReference = true")
	}

	if opts.Q != "" {
		pattern := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(opts.Q, "\\"))
		operatorKeyword := "ILIKE"
		if s.DriverName() == model.DatabaseDriverMysql {
			operatorKeyword = "LIKE"
		}
		query = query.Where(fmt.Sprintf("(ug.Name %[1]s ? OR ug.DisplayName %[1]s ?)", operatorKeyword), pattern, pattern)
	}

	return query
}

func (s *SqlGroupStore) getGroupsAssociatedToChannelsByTeam(teamID string, opts model.GroupSearchOpts) sq.SelectBuilder {
	query := s.getQueryBuilder().
		Select("gc.ChannelId, ug.*, gc.SchemeAdmin AS SyncableSchemeAdmin").
		From("UserGroups ug").
		LeftJoin(`
			(SELECT
				GroupChannels.GroupId, GroupChannels.ChannelId, GroupChannels.DeleteAt, GroupChannels.SchemeAdmin
			FROM
				GroupChannels
			LEFT JOIN
				Channels ON (Channels.Id = GroupChannels.ChannelId)
			WHERE
				GroupChannels.DeleteAt = 0
				AND Channels.DeleteAt = 0
				AND Channels.TeamId = ?) AS gc ON gc.GroupId = ug.Id`, teamID).
		Where("ug.DeleteAt = 0 AND gc.DeleteAt = 0").
		OrderBy("ug.DisplayName")

	if opts.IncludeMemberCount {
		query = s.getQueryBuilder().
			Select("gc.ChannelId, ug.*, coalesce(Members.MemberCount, 0) AS MemberCount, gc.SchemeAdmin AS SyncableSchemeAdmin").
			From("UserGroups ug").
			LeftJoin(`
				(SELECT
					GroupChannels.ChannelId, GroupChannels.DeleteAt, GroupChannels.GroupId, GroupChannels.SchemeAdmin
				FROM
					GroupChannels
				LEFT JOIN
					Channels ON (Channels.Id = GroupChannels.ChannelId)
				WHERE
					GroupChannels.DeleteAt = 0
					AND Channels.DeleteAt = 0
					AND Channels.TeamId = ?) AS gc ON gc.GroupId = ug.Id`, teamID).
			LeftJoin(`(
				SELECT
					GroupMembers.GroupId, COUNT(*) AS MemberCount
				FROM
					GroupMembers
				LEFT JOIN
					Users ON Users.Id = GroupMembers.UserId
				WHERE
					GroupMembers.DeleteAt = 0
					AND Users.DeleteAt = 0
				GROUP BY GroupId) AS Members
			ON Members.GroupId = ug.Id`).
			Where("ug.DeleteAt = 0 AND gc.DeleteAt = 0").
			OrderBy("ug.DisplayName")
	}

	if opts.FilterAllowReference {
		query = query.Where("ug.AllowReference = true")
	}

	if opts.Q != "" {
		pattern := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(opts.Q, "\\"))
		operatorKeyword := "ILIKE"
		if s.DriverName() == model.DatabaseDriverMysql {
			operatorKeyword = "LIKE"
		}
		query = query.Where(fmt.Sprintf("(ug.Name %[1]s ? OR ug.DisplayName %[1]s ?)", operatorKeyword), pattern, pattern)
	}

	return query
}

func (s *SqlGroupStore) CountGroupsByTeam(teamId string, opts model.GroupSearchOpts) (int64, error) {
	countQuery := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeTeam, selectCountGroups, teamId, opts)

	countQueryString, args, err := countQuery.ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "count_groups_by_team_tosql")
	}

	var count int64
	err = s.GetReplicaX().Get(&count, countQueryString, args...)
	if err != nil {
		return int64(0), errors.Wrapf(err, "failed to count Groups with teamId=%s", teamId)
	}

	return count, nil
}

func (s *SqlGroupStore) GetGroupsByTeam(teamId string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, error) {
	query := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeTeam, selectGroups, teamId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		query = query.OrderBy("ug.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_groups_by_team_tosql")
	}

	groups := groupsWithSchemeAdmin{}
	err = s.GetReplicaX().Select(&groups, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Groups with teamId=%s", teamId)
	}

	return groups.ToModel(), nil
}

func (s *SqlGroupStore) GetGroupsAssociatedToChannelsByTeam(teamId string, opts model.GroupSearchOpts) (map[string][]*model.GroupWithSchemeAdmin, error) {
	query := s.getGroupsAssociatedToChannelsByTeam(teamId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		query = query.OrderBy("ug.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_groups_associated_to_channel_by_team_tosql")
	}

	tgroups := groupsAssociatedToChannelWithSchemeAdmin{}

	err = s.GetReplicaX().Select(&tgroups, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Groups with teamId=%s", teamId)
	}

	groups := map[string][]*model.GroupWithSchemeAdmin{}
	for _, tgroup := range tgroups {
		group := tgroup.groupWithSchemeAdmin.ToModel()
		groups[tgroup.ChannelId] = append(groups[tgroup.ChannelId], group)
	}

	return groups, nil
}

func (s *SqlGroupStore) GetGroups(page, perPage int, opts model.GroupSearchOpts, viewRestrictions *model.ViewUsersRestrictions) ([]*model.Group, error) {
	groupsVar := groups{}

	selectQuery := []string{"g.*"}

	if opts.IncludeMemberCount {
		selectQuery = append(selectQuery, "coalesce(Members.MemberCount, 0) AS MemberCount")
	}

	if opts.IncludeChannelMemberCount != "" {
		selectQuery = append(selectQuery, "coalesce(ChannelMembers.ChannelMemberCount, 0) AS ChannelMemberCount")
		if opts.IncludeTimezones {
			selectQuery = append(selectQuery, "coalesce(ChannelMembers.ChannelMemberTimezonesCount, 0) AS ChannelMemberTimezonesCount")
		}
	}

	groupsQuery := s.getQueryBuilder().Select(strings.Join(selectQuery, ", "))

	if opts.IncludeMemberCount {
		countQuery := s.getQueryBuilder().
			Select("GroupMembers.GroupId, COUNT(DISTINCT u.Id) AS MemberCount").
			From("GroupMembers").
			LeftJoin("Users u ON u.Id = GroupMembers.UserId").
			Where(sq.Eq{"GroupMembers.DeleteAt": 0}).
			Where(sq.Eq{"u.DeleteAt": 0}).
			GroupBy("GroupId")

		countQuery = applyViewRestrictionsFilter(countQuery, viewRestrictions, false)

		countString, params, err := countQuery.PlaceholderFormat(sq.Question).ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "get_groups_tosql")
		}
		groupsQuery = groupsQuery.
			LeftJoin("("+countString+") AS Members ON Members.GroupId = g.Id", params...)
	}

	if opts.IncludeChannelMemberCount != "" {
		selectStr := "GroupMembers.GroupId, COUNT(ChannelMembers.UserId) AS ChannelMemberCount"
		joinStr := ""

		if opts.IncludeTimezones {
			if s.DriverName() == model.DatabaseDriverMysql {
				selectStr += `,
					COUNT(DISTINCT
					(
						CASE WHEN JSON_EXTRACT(Timezone, '$.useAutomaticTimezone') = 'true' AND LENGTH(JSON_UNQUOTE(JSON_EXTRACT(Timezone, '$.automaticTimezone'))) > 0
						THEN JSON_EXTRACT(Timezone, '$.automaticTimezone')
						WHEN JSON_EXTRACT(Timezone, '$.useAutomaticTimezone') = 'false' AND LENGTH(JSON_UNQUOTE(JSON_EXTRACT(Timezone, '$.manualTimezone'))) > 0
						THEN JSON_EXTRACT(Timezone, '$.manualTimezone')
						END
					)) AS ChannelMemberTimezonesCount`
			} else if s.DriverName() == model.DatabaseDriverPostgres {
				selectStr += `,
					COUNT(DISTINCT
					(
						CASE WHEN Timezone->>'useAutomaticTimezone' = 'true' AND length(Timezone->>'automaticTimezone') > 0
						THEN Timezone->>'automaticTimezone'
						WHEN Timezone->>'useAutomaticTimezone' = 'false' AND length(Timezone->>'manualTimezone') > 0
						THEN Timezone->>'manualTimezone'
						END
					)) AS ChannelMemberTimezonesCount`
			}
			joinStr = "LEFT JOIN Users ON Users.Id = GroupMembers.UserId"
		}

		groupsQuery = groupsQuery.
			LeftJoin("(SELECT "+selectStr+" FROM ChannelMembers LEFT JOIN GroupMembers ON GroupMembers.UserId = ChannelMembers.UserId AND GroupMembers.DeleteAt = 0 "+joinStr+" WHERE ChannelMembers.ChannelId = ? GROUP BY GroupId) AS ChannelMembers ON ChannelMembers.GroupId = g.Id", opts.IncludeChannelMemberCount)
	}

	if opts.FilterHasMember != "" {
		groupsQuery = groupsQuery.
			LeftJoin("GroupMembers ON GroupMembers.GroupId = g.Id").
			Where("GroupMembers.UserId = ?", opts.FilterHasMember).
			Where("GroupMembers.DeleteAt = 0")
	}

	groupsQuery = groupsQuery.
		From("UserGroups g").
		OrderBy("g.DisplayName")

	if opts.Since > 0 {
		groupsQuery = groupsQuery.Where(sq.Gt{
			"g.UpdateAt": opts.Since,
		})
	} else {
		groupsQuery = groupsQuery.Where("g.DeleteAt = 0")
	}

	if perPage != 0 {
		groupsQuery = groupsQuery.
			Limit(uint64(perPage)).
			Offset(uint64(page * perPage))
	}

	if opts.FilterAllowReference {
		groupsQuery = groupsQuery.Where("g.AllowReference = true")
	}

	if opts.Q != "" {
		pattern := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(opts.Q, "\\"))
		operatorKeyword := "ILIKE"
		if s.DriverName() == model.DatabaseDriverMysql {
			operatorKeyword = "LIKE"
		}
		groupsQuery = groupsQuery.Where(fmt.Sprintf("(g.Name %[1]s ? OR g.DisplayName %[1]s ?)", operatorKeyword), pattern, pattern)
	}

	if len(opts.NotAssociatedToTeam) == 26 {
		groupsQuery = groupsQuery.Where(`
			g.Id NOT IN (
				SELECT
					Id
				FROM
					UserGroups
					JOIN GroupTeams ON GroupTeams.GroupId = UserGroups.Id
				WHERE
					GroupTeams.DeleteAt = 0
					AND UserGroups.DeleteAt = 0
					AND GroupTeams.TeamId = ?
			)
		`, opts.NotAssociatedToTeam)
	}

	if len(opts.NotAssociatedToChannel) == 26 {
		groupsQuery = groupsQuery.Where(`
			g.Id NOT IN (
				SELECT
					Id
				FROM
					UserGroups
					JOIN GroupChannels ON GroupChannels.GroupId = UserGroups.Id
				WHERE
					GroupChannels.DeleteAt = 0
					AND UserGroups.DeleteAt = 0
					AND GroupChannels.ChannelId = ?
			)
		`, opts.NotAssociatedToChannel)
	}

	if opts.FilterParentTeamPermitted && len(opts.NotAssociatedToChannel) == 26 {
		groupsQuery = groupsQuery.Where(`
			CASE
			WHEN (
				SELECT
					Teams.GroupConstrained
				FROM
					Teams
					JOIN Channels ON Channels.TeamId = Teams.Id
				WHERE
					Channels.Id = ?
			) THEN g.Id IN (
				SELECT
					GroupId
				FROM
					GroupTeams
				WHERE
					GroupTeams.DeleteAt = 0
					AND GroupTeams.TeamId = (
						SELECT
							TeamId
						FROM
							Channels
						WHERE
							Id = ?
					)
			)
			ELSE TRUE
		END
		`, opts.NotAssociatedToChannel, opts.NotAssociatedToChannel)
	}

	if opts.Source != "" {
		groupsQuery = groupsQuery.Where("g.Source = ?", opts.Source)
	}

	queryString, args, err := groupsQuery.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_groups_tosql")
	}

	if err = s.GetReplicaX().Select(&groupsVar, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Groups")
	}

	return groupsVar.ToModel(), nil
}

func (s *SqlGroupStore) teamMembersMinusGroupMembersQuery(teamID string, groupIDs []string, isCount bool) sq.SelectBuilder {
	var selectStr string

	if isCount {
		selectStr = "count(DISTINCT Users.Id)"
	} else {
		tmpl := "Users.*, coalesce(TeamMembers.SchemeGuest, false) SchemeGuest, TeamMembers.SchemeAdmin, TeamMembers.SchemeUser, %s AS GroupIDs"
		if s.DriverName() == model.DatabaseDriverMysql {
			selectStr = fmt.Sprintf(tmpl, "group_concat(UserGroups.Id)")
		} else {
			selectStr = fmt.Sprintf(tmpl, "string_agg(UserGroups.Id, ',')")
		}
	}

	subQuery := s.getQueryBuilder().Select("GroupMembers.UserId").
		From("GroupMembers").
		Join("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("GroupMembers.DeleteAt = 0").
		Where(fmt.Sprintf("GroupMembers.GroupId IN ('%s')", strings.Join(groupIDs, "', '")))

	query, _ := subQuery.MustSql()

	builder := s.getQueryBuilder().Select(selectStr).
		From("TeamMembers").
		Join("Teams ON Teams.Id = TeamMembers.TeamId").
		Join("Users ON Users.Id = TeamMembers.UserId").
		LeftJoin("Bots ON Bots.UserId = TeamMembers.UserId").
		LeftJoin("GroupMembers ON GroupMembers.UserId = Users.Id").
		LeftJoin("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("TeamMembers.DeleteAt = 0").
		Where("Teams.DeleteAt = 0").
		Where("Users.DeleteAt = 0").
		Where("Bots.UserId IS NULL").
		Where("Teams.Id = ?", teamID).
		Where(fmt.Sprintf("Users.Id NOT IN (%s)", query))

	if !isCount {
		builder = builder.GroupBy("Users.Id, TeamMembers.SchemeGuest, TeamMembers.SchemeAdmin, TeamMembers.SchemeUser")
	}

	return builder
}

// TeamMembersMinusGroupMembers returns the set of users on the given team minus the set of users in the given
// groups.
func (s *SqlGroupStore) TeamMembersMinusGroupMembers(teamID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, error) {
	query := s.teamMembersMinusGroupMembersQuery(teamID, groupIDs, false)
	query = query.OrderBy("Users.Username ASC").Limit(uint64(perPage)).Offset(uint64(page * perPage))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "team_members_minus_group_members")
	}

	users := []*model.UserWithGroups{}
	if err = s.GetReplicaX().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find UserWithGroups")
	}

	return users, nil
}

// CountTeamMembersMinusGroupMembers returns the count of the set of users on the given team minus the set of users
// in the given groups.
func (s *SqlGroupStore) CountTeamMembersMinusGroupMembers(teamID string, groupIDs []string) (int64, error) {
	queryString, args, err := s.teamMembersMinusGroupMembersQuery(teamID, groupIDs, true).ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "count_team_members_minus_group_members_tosql")
	}

	var count int64
	if err := s.GetReplicaX().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count TeamMembers minus GroupMembers")
	}

	return count, nil
}

func (s *SqlGroupStore) channelMembersMinusGroupMembersQuery(channelID string, groupIDs []string, isCount bool) sq.SelectBuilder {
	var selectStr string

	if isCount {
		selectStr = "count(DISTINCT Users.Id)"
	} else {
		tmpl := "Users.*, coalesce(ChannelMembers.SchemeGuest, false) SchemeGuest, ChannelMembers.SchemeAdmin, ChannelMembers.SchemeUser, %s AS GroupIDs"
		if s.DriverName() == model.DatabaseDriverMysql {
			selectStr = fmt.Sprintf(tmpl, "group_concat(UserGroups.Id)")
		} else {
			selectStr = fmt.Sprintf(tmpl, "string_agg(UserGroups.Id, ',')")
		}
	}

	subQuery := s.getQueryBuilder().Select("GroupMembers.UserId").
		From("GroupMembers").
		Join("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("GroupMembers.DeleteAt = 0").
		Where(fmt.Sprintf("GroupMembers.GroupId IN ('%s')", strings.Join(groupIDs, "', '")))

	query, _ := subQuery.MustSql()

	builder := s.getQueryBuilder().Select(selectStr).
		From("ChannelMembers").
		Join("Channels ON Channels.Id = ChannelMembers.ChannelId").
		Join("Users ON Users.Id = ChannelMembers.UserId").
		LeftJoin("Bots ON Bots.UserId = ChannelMembers.UserId").
		LeftJoin("GroupMembers ON GroupMembers.UserId = Users.Id").
		LeftJoin("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("Channels.DeleteAt = 0").
		Where("Users.DeleteAt = 0").
		Where("Bots.UserId IS NULL").
		Where("Channels.Id = ?", channelID).
		Where(fmt.Sprintf("Users.Id NOT IN (%s)", query))

	if !isCount {
		builder = builder.GroupBy("Users.Id, ChannelMembers.SchemeGuest, ChannelMembers.SchemeAdmin, ChannelMembers.SchemeUser")
	}

	return builder
}

// ChannelMembersMinusGroupMembers returns the set of users in the given channel minus the set of users in the given
// groups.
func (s *SqlGroupStore) ChannelMembersMinusGroupMembers(channelID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, error) {
	query := s.channelMembersMinusGroupMembersQuery(channelID, groupIDs, false)
	query = query.OrderBy("Users.Username ASC").Limit(uint64(perPage)).Offset(uint64(page * perPage))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_members_minus_group_members_tosql")
	}

	users := []*model.UserWithGroups{}
	if err = s.GetReplicaX().Select(&users, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find UserWithGroups")
	}

	return users, nil
}

// CountChannelMembersMinusGroupMembers returns the count of the set of users in the given channel minus the set of users
// in the given groups.
func (s *SqlGroupStore) CountChannelMembersMinusGroupMembers(channelID string, groupIDs []string) (int64, error) {
	queryString, args, err := s.channelMembersMinusGroupMembersQuery(channelID, groupIDs, true).ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "count_channel_members_minus_group_members_tosql")
	}

	var count int64
	if err := s.GetReplicaX().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count ChannelMembers")
	}

	return count, nil
}

func (s *SqlGroupStore) AdminRoleGroupsForSyncableMember(userID, syncableID string, syncableType model.GroupSyncableType) ([]string, error) {
	var groupIds []string

	query := fmt.Sprintf(`
		SELECT
			GroupMembers.GroupId
		FROM
			GroupMembers
		INNER JOIN
			Group%[1]ss ON Group%[1]ss.GroupId = GroupMembers.GroupId
		WHERE
			GroupMembers.UserId = ?
			AND GroupMembers.DeleteAt = 0
			AND %[1]sId = ?
			AND Group%[1]ss.DeleteAt = 0
			AND Group%[1]ss.SchemeAdmin = TRUE`, syncableType)

	err := s.GetReplicaX().Select(&groupIds, query, userID, syncableID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Group ids")
	}

	return groupIds, nil
}

func (s *SqlGroupStore) PermittedSyncableAdmins(syncableID string, syncableType model.GroupSyncableType) ([]string, error) {
	builder := s.getQueryBuilder().Select("UserId").
		From(fmt.Sprintf("Group%ss", syncableType)).
		Join(fmt.Sprintf("GroupMembers ON GroupMembers.GroupId = Group%ss.GroupId AND Group%[1]ss.SchemeAdmin = TRUE AND GroupMembers.DeleteAt = 0", syncableType.String())).Where(fmt.Sprintf("Group%[1]ss.%[1]sId = ?", syncableType.String()), syncableID)

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "permitted_syncable_admins_tosql")
	}

	var userIDs []string
	if err = s.GetMasterX().Select(&userIDs, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find User ids")
	}

	return userIDs, nil
}

func (s *SqlGroupStore) GroupCount() (int64, error) {
	return s.countTable("UserGroups")
}

func (s *SqlGroupStore) GroupCountBySource(source model.GroupSource) (int64, error) {
	return s.countTableWithSelectAndWhere("COUNT(*)", "UserGroups", sq.Eq{"Source": source, "DeleteAt": 0})
}

func (s *SqlGroupStore) GroupTeamCount() (int64, error) {
	return s.countTable("GroupTeams")
}

func (s *SqlGroupStore) GroupChannelCount() (int64, error) {
	return s.countTable("GroupChannels")
}

func (s *SqlGroupStore) GroupMemberCount() (int64, error) {
	return s.countTable("GroupMembers")
}

func (s *SqlGroupStore) DistinctGroupMemberCount() (int64, error) {
	return s.countTableWithSelectAndWhere("COUNT(DISTINCT UserId)", "GroupMembers", nil)
}

func (s *SqlGroupStore) DistinctGroupMemberCountForSource(source model.GroupSource) (int64, error) {
	builder := s.getQueryBuilder().
		Select("COUNT(DISTINCT GroupMembers.UserId)").
		From("GroupMembers").
		Join("UserGroups ON GroupMembers.GroupId = UserGroups.Id").
		Where(sq.Eq{"UserGroups.Source": source, "GroupMembers.DeleteAt": 0})

	query, args, err := builder.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "distinct_group_member_count_for_source_tosql")
	}

	var count int64
	if err = s.GetReplicaX().Get(&count, query, args...); err != nil {
		return 0, errors.Wrapf(err, "failed to select distinct groupmember count for source %q", source)
	}

	return count, nil
}

func (s *SqlGroupStore) GroupCountWithAllowReference() (int64, error) {
	return s.countTableWithSelectAndWhere("COUNT(*)", "UserGroups", sq.Eq{"AllowReference": true, "DeleteAt": 0})
}

func (s *SqlGroupStore) countTable(tableName string) (int64, error) {
	return s.countTableWithSelectAndWhere("COUNT(*)", tableName, nil)
}

func (s *SqlGroupStore) countTableWithSelectAndWhere(selectStr, tableName string, whereStmt map[string]any) (int64, error) {
	if whereStmt == nil {
		whereStmt = sq.Eq{"DeleteAt": 0}
	}

	query := s.getQueryBuilder().Select(selectStr).From(tableName).Where(whereStmt)

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "count_table_with_select_and_where_tosql")
	}

	var count int64
	err = s.GetReplicaX().Get(&count, sql, args...)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count from table %s", tableName)
	}

	return count, nil
}

func (s *SqlGroupStore) UpsertMembers(groupID string, userIDs []string) ([]*model.GroupMember, error) {
	members, query, args, err := s.buildUpsertMembersQuery(groupID, userIDs)
	if err != nil {
		return nil, err
	}

	if _, err = s.GetMasterX().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to save GroupMember")
	}

	return members, err
}

func (s *SqlGroupStore) buildUpsertMembersQuery(groupID string, userIDs []string) (members []*model.GroupMember, query string, args []any, err error) {
	var retrievedGroup model.Group
	// Check Group exists
	if err = s.GetReplicaX().Get(&retrievedGroup, "SELECT * FROM UserGroups WHERE Id = ?", groupID); err != nil {
		err = errors.Wrapf(err, "failed to get UserGroup with groupId=%s", groupID)
		return
	}

	// Check Users exist
	if err = s.checkUsersExist(userIDs); err != nil {
		return
	}

	builder := s.getQueryBuilder().
		Insert("GroupMembers").
		Columns("GroupId", "UserId", "CreateAt", "DeleteAt")

	members = make([]*model.GroupMember, 0, len(userIDs))
	createAt := model.GetMillis()
	for _, userId := range userIDs {
		member := &model.GroupMember{
			GroupId:  groupID,
			UserId:   userId,
			CreateAt: createAt,
			DeleteAt: 0,
		}
		builder = builder.Values(member.GroupId, member.UserId, member.CreateAt, member.DeleteAt)
		members = append(members, member)
	}

	if s.DriverName() == model.DatabaseDriverMysql {
		builder = builder.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE CreateAt = ?, DeleteAt = ?", createAt, 0))
	} else if s.DriverName() == model.DatabaseDriverPostgres {
		builder = builder.SuffixExpr(sq.Expr("ON CONFLICT (groupid, userid) DO UPDATE SET CreateAt = ?, DeleteAt = ?", createAt, 0))
	}

	query, args, err = builder.ToSql()
	return
}

func (s *SqlGroupStore) DeleteMembers(groupID string, userIDs []string) ([]*model.GroupMember, error) {
	members, query, args, err := s.buildDeleteMembersQuery(groupID, userIDs)
	if err != nil {
		return nil, err
	}

	if _, err = s.GetMasterX().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to delete GroupMembers")
	}
	return members, err
}

func (s *SqlGroupStore) buildDeleteMembersQuery(groupID string, userIDs []string) (members []*model.GroupMember, query string, args []any, err error) {
	membersSelectQuery, membersSelectArgs, err := s.getQueryBuilder().
		Select("*").
		From("GroupMembers").
		Where(sq.And{
			sq.Eq{"GroupId": groupID},
			sq.Eq{"UserId": userIDs},
			sq.Eq{"DeleteAt": 0},
		}).
		ToSql()
	if err != nil {
		return
	}

	err = s.GetReplicaX().Select(&members, membersSelectQuery, membersSelectArgs...)
	if err != nil {
		return
	}
	if len(members) != len(userIDs) {
		retrievedRecords := make(map[string]bool)
		for _, member := range members {
			retrievedRecords[member.UserId] = true
		}
		for _, userID := range userIDs {
			if _, ok := retrievedRecords[userID]; !ok {
				err = store.NewErrNotFound("User", userID)
				return
			}
		}
	}

	deleteAt := model.GetMillis()

	for _, member := range members {
		member.DeleteAt = deleteAt
	}

	builder := s.getQueryBuilder().
		Update("GroupMembers").
		Set("DeleteAt", deleteAt).
		Where(sq.And{
			sq.Eq{"GroupId": groupID},
			sq.Eq{"UserId": userIDs},
		})

	query, args, err = builder.ToSql()
	return
}
