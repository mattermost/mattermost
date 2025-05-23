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
	userGroupsSelectQuery       sq.SelectBuilder
	groupMembersSelectQuery     sq.SelectBuilder
	groupMemberUsersSelectQuery sq.SelectBuilder
	groupTeamsSelectQuery       sq.SelectBuilder
	groupChannelsSelectQuery    sq.SelectBuilder
}

func newSqlGroupStore(sqlStore *SqlStore) store.GroupStore {
	s := &SqlGroupStore{SqlStore: sqlStore}

	s.userGroupsSelectQuery = s.getQueryBuilder().
		Select(
			"UserGroups.Id",
			"UserGroups.Name",
			"UserGroups.DisplayName",
			"UserGroups.Description",
			"UserGroups.Source",
			"UserGroups.RemoteId",
			"UserGroups.CreateAt",
			"UserGroups.UpdateAt",
			"UserGroups.DeleteAt",
			"UserGroups.AllowReference",
		).
		From("UserGroups")

	s.groupMembersSelectQuery = s.getQueryBuilder().
		Select(
			"GroupMembers.GroupId",
			"GroupMembers.UserId",
			"GroupMembers.CreateAt",
			"GroupMembers.DeleteAt",
		).From("GroupMembers")

	s.groupMemberUsersSelectQuery = s.getQueryBuilder().
		Select(getUsersColumns()...).
		From("GroupMembers").
		Join("Users ON Users.Id = GroupMembers.UserId")

	s.groupTeamsSelectQuery = s.getQueryBuilder().
		Select(
			"GroupTeams.GroupId",
			"GroupTeams.TeamId",
			"GroupTeams.AutoAdd",
			"GroupTeams.SchemeAdmin",
			"GroupTeams.CreateAt",
			"GroupTeams.UpdateAt",
			"GroupTeams.DeleteAt",
		).From("GroupTeams")

	s.groupChannelsSelectQuery = s.getQueryBuilder().
		Select(
			"GroupChannels.GroupId",
			"GroupChannels.ChannelId",
			"GroupChannels.AutoAdd",
			"GroupChannels.SchemeAdmin",
			"GroupChannels.CreateAt",
			"GroupChannels.UpdateAt",
			"GroupChannels.DeleteAt",
		).From("GroupChannels")

	return s
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

	if _, err := s.GetMaster().NamedExec(`INSERT INTO UserGroups
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

	txn, err := s.GetMaster().Beginx()
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

	groupGroupQuery := s.userGroupsSelectQuery.
		Column("A.Count AS MemberCount").
		InnerJoin(`(
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
					1 OFFSET 0
			) AS A ON UserGroups.Id = A.Id`, g.Id).
		OrderBy("UserGroups.CreateAt DESC")

	var newGroup group
	if err = txn.GetBuilder(&newGroup, groupGroupQuery); err != nil {
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
	usersSelectQuery := s.getQueryBuilder().
		Select("Id").
		From("Users").
		Where(sq.Eq{"Id": userIDs, "DeleteAt": 0})

	var rows []string
	err := s.GetReplica().SelectBuilder(&rows, usersSelectQuery)
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
	builder := s.userGroupsSelectQuery.
		Where(sq.Eq{"Id": groupId})

	if err := s.GetReplica().GetBuilder(&group, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", groupId)
		}
		return nil, errors.Wrapf(err, "failed to get Group with id=%s", groupId)
	}

	return &group, nil
}

func (s *SqlGroupStore) GetByName(name string, opts model.GroupSearchOpts) (*model.Group, error) {
	var group model.Group
	query := s.userGroupsSelectQuery.
		Where(sq.Eq{"Name": name})

	if opts.FilterAllowReference {
		query = query.Where("AllowReference = true")
	}

	if err := s.GetReplica().GetBuilder(&group, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", fmt.Sprintf("name=%s", name))
		}
		return nil, errors.Wrapf(err, "failed to get Group with name=%s", name)
	}

	return &group, nil
}

func (s *SqlGroupStore) GetByIDs(groupIDs []string) ([]*model.Group, error) {
	groups := []*model.Group{}
	query := s.userGroupsSelectQuery.Where(sq.Eq{"Id": groupIDs})
	if err := s.GetReplica().SelectBuilder(&groups, query); err != nil {
		return nil, errors.Wrap(err, "failed to find Groups by ids")
	}
	return groups, nil
}

func (s *SqlGroupStore) GetByRemoteID(remoteID string, groupSource model.GroupSource) (*model.Group, error) {
	var group model.Group
	builder := s.userGroupsSelectQuery.
		Where(sq.Eq{
			"RemoteId": remoteID,
			"Source":   groupSource,
		})

	if err := s.GetReplica().GetBuilder(&group, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", fmt.Sprintf("remoteId=%s", remoteID))
		}
		return nil, errors.Wrapf(err, "failed to get Group with remoteId=%s", remoteID)
	}

	return &group, nil
}

func (s *SqlGroupStore) GetAllBySource(groupSource model.GroupSource) ([]*model.Group, error) {
	groups := []*model.Group{}
	builder := s.userGroupsSelectQuery.
		Where(sq.Eq{
			"DeleteAt": 0,
			"Source":   groupSource,
		})

	if err := s.GetReplica().SelectBuilder(&groups, builder); err != nil {
		return nil, errors.Wrapf(err, "failed to find Groups by groupSource=%v", groupSource)
	}

	return groups, nil
}

func (s *SqlGroupStore) GetByUser(userID string, opts model.GroupSearchOpts) ([]*model.Group, error) {
	groups := []*model.Group{}

	builder := s.userGroupsSelectQuery.
		Join("GroupMembers ON GroupMembers.GroupId = UserGroups.Id").
		Where(sq.Eq{
			"GroupMembers.DeleteAt": 0,
			"GroupMembers.UserId":   userID,
		})

	if opts.FilterAllowReference {
		builder = builder.Where("UserGroups.AllowReference = true")
	}

	if err := s.GetReplica().SelectBuilder(&groups, builder); err != nil {
		return nil, errors.Wrapf(err, "failed to find Groups with userId=%s", userID)
	}

	return groups, nil
}

func (s *SqlGroupStore) Update(group *model.Group) (*model.Group, error) {
	var retrievedGroup model.Group
	builder := s.userGroupsSelectQuery.Where(sq.Eq{"Id": group.Id})

	if err := s.GetReplica().GetBuilder(&retrievedGroup, builder); err != nil {
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

	res, err := s.GetMaster().NamedExec(`UPDATE UserGroups
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
	builder := s.userGroupsSelectQuery.
		Where(sq.Eq{
			"Id":       groupID,
			"DeleteAt": 0,
		})

	if err := s.GetReplica().GetBuilder(&group, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", groupID)
		}
		return nil, errors.Wrapf(err, "failed to get Group with id=%s", groupID)
	}

	time := model.GetMillis()
	group.DeleteAt = time
	group.UpdateAt = time
	if _, err := s.GetMaster().Exec(`UPDATE UserGroups
		SET DeleteAt=?, UpdateAt=?
		WHERE Id=? AND DeleteAt=0`, group.DeleteAt, group.UpdateAt, groupID); err != nil {
		return nil, errors.Wrapf(err, "failed to update Group with id=%s", groupID)
	}

	return &group, nil
}

func (s *SqlGroupStore) Restore(groupID string) (*model.Group, error) {
	var group model.Group
	builder := s.userGroupsSelectQuery.
		Where(sq.And{
			sq.Eq{"Id": groupID},
			sq.NotEq{"DeleteAt": 0},
		})

	if err := s.GetReplica().GetBuilder(&group, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Group", groupID)
		}
		return nil, errors.Wrapf(err, "failed to get Group with id=%s", groupID)
	}

	group.UpdateAt = model.GetMillis()
	group.DeleteAt = 0
	if _, err := s.GetMaster().Exec(`UPDATE UserGroups
		SET DeleteAt=0, UpdateAt=?
		WHERE Id=? AND DeleteAt!=0`, group.UpdateAt, groupID); err != nil {
		return nil, errors.Wrapf(err, "failed to update Group with id=%s", groupID)
	}

	return &group, nil
}

func (s *SqlGroupStore) GetMember(groupID, userID string) (*model.GroupMember, error) {
	builder := s.groupMembersSelectQuery.
		Where(sq.Eq{"UserId": userID}).
		Where(sq.Eq{"GroupId": groupID}).
		Where(sq.Eq{"DeleteAt": 0})

	var groupMember model.GroupMember
	if err := s.GetReplica().GetBuilder(&groupMember, builder); err != nil {
		return nil, errors.Wrap(err, "GetMember")
	}
	return &groupMember, nil
}

func (s *SqlGroupStore) GetMemberUsers(groupID string) ([]*model.User, error) {
	groupMembers := []*model.User{}

	builder := s.groupMemberUsersSelectQuery.
		Where(sq.Eq{
			"GroupMembers.DeleteAt": 0,
			"Users.DeleteAt":        0,
			"GroupMembers.GroupId":  groupID,
		})

	if err := s.GetReplica().SelectBuilder(&groupMembers, builder); err != nil {
		return nil, errors.Wrapf(err, "failed to find member Users for Group with id=%s", groupID)
	}

	return groupMembers, nil
}

func (s *SqlGroupStore) GetMemberUsersPage(groupID string, page int, perPage int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	return s.GetMemberUsersSortedPage(groupID, page, perPage, viewRestrictions, model.ShowUsername)
}

func (s *SqlGroupStore) GetMemberUsersSortedPage(groupID string, page int, perPage int, viewRestrictions *model.ViewUsersRestrictions, teammateNameDisplay string) ([]*model.User, error) {
	groupMembers := []*model.User{}

	userQuery := s.groupMemberUsersSelectQuery.
		Where(sq.Eq{"GroupMembers.DeleteAt": 0}).
		Where(sq.Eq{"Users.DeleteAt": 0}).
		Where(sq.Eq{"GroupMembers.GroupId": groupID})

	userQuery = applyViewRestrictionsFilter(userQuery, viewRestrictions, true)

	orderQuery := s.getQueryBuilder().
		Select(getUsersColumns()...).
		FromSelect(userQuery, "Users")

	if teammateNameDisplay == model.ShowNicknameFullName {
		orderQuery = orderQuery.OrderBy(`
		CASE
			WHEN Users.Nickname != '' THEN Users.Nickname
			WHEN Users.FirstName !=  '' AND Users.LastName != '' THEN CONCAT(Users.FirstName, ' ', Users.LastName)
			WHEN Users.FirstName != '' THEN Users.FirstName
			WHEN Users.LastName != '' THEN Users.LastName
			ELSE Users.Username
		END`)
	} else if teammateNameDisplay == model.ShowFullName {
		orderQuery = orderQuery.OrderBy(`
		CASE
			WHEN Users.FirstName !=  '' AND Users.LastName != '' THEN CONCAT(Users.FirstName, ' ', Users.LastName)
			WHEN Users.FirstName != '' THEN Users.FirstName
			WHEN Users.LastName != '' THEN Users.LastName
			ELSE Users.Username
		END`)
	} else {
		orderQuery = orderQuery.OrderBy("Users.Username")
	}

	orderQuery = orderQuery.
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage))

	if err := s.GetReplica().SelectBuilder(&groupMembers, orderQuery); err != nil {
		return nil, errors.Wrapf(err, "failed to find member Users for Group with id=%s", groupID)
	}

	return groupMembers, nil
}

func (s *SqlGroupStore) GetNonMemberUsersPage(groupID string, page int, perPage int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	groupMembers := []*model.User{}

	builder := s.userGroupsSelectQuery.
		Where(sq.Eq{"Id": groupID})

	if err := s.GetReplica().GetBuilder(&model.Group{}, builder); err != nil {
		return nil, errors.Wrap(err, "GetNonMemberUsersPage")
	}

	builder = s.getQueryBuilder().
		Select(getUsersColumns()...).
		From("Users").
		LeftJoin("GroupMembers ON (GroupMembers.UserId = Users.Id AND GroupMembers.GroupId = ?)", groupID).
		Where(sq.Eq{"Users.DeleteAt": 0}).
		Where("(GroupMembers.UserID IS NULL OR GroupMembers.DeleteAt != 0)").
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage)).
		OrderBy("Users.Username ASC")

	builder = applyViewRestrictionsFilter(builder, viewRestrictions, true)

	if err := s.GetReplica().SelectBuilder(&groupMembers, builder); err != nil {
		return nil, errors.Wrapf(err, "failed to find member Users for Group with id=%s", groupID)
	}

	return groupMembers, nil
}

func (s *SqlGroupStore) GetMemberCount(groupID string) (int64, error) {
	return s.GetMemberCountWithRestrictions(groupID, nil)
}

func (s *SqlGroupStore) GetMemberCountWithRestrictions(groupID string, viewRestrictions *model.ViewUsersRestrictions) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(DISTINCT Users.Id)").
		From("GroupMembers").
		Join("Users ON Users.Id = GroupMembers.UserId").
		Where(sq.Eq{"GroupMembers.GroupId": groupID}).
		Where(sq.Eq{"Users.DeleteAt": 0}).
		Where(sq.Eq{"GroupMembers.DeleteAt": 0})

	query = applyViewRestrictionsFilter(query, viewRestrictions, false)

	var count int64
	if err := s.GetReplica().GetBuilder(&count, query); err != nil {
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

	if err := s.GetReplica().Select(&groupMembers, query, groupID, teamID); err != nil {
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

	if err := s.GetReplica().Select(&groupMembers, query, groupID, channelID, channelID); err != nil {
		return nil, errors.Wrapf(err, "failed to member Users for groupId=%s and channelId!=%s", groupID, channelID)
	}

	return groupMembers, nil
}

func (s *SqlGroupStore) UpsertMember(groupID string, userID string) (*model.GroupMember, error) {
	members, query, err := s.buildUpsertMembersQuery(groupID, []string{userID})
	if err != nil {
		return nil, err
	}
	if _, err = s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrap(err, "failed to save GroupMember")
	}
	return members[0], nil
}

func (s *SqlGroupStore) DeleteMember(groupID string, userID string) (*model.GroupMember, error) {
	members, query, err := s.buildDeleteMembersQuery(groupID, []string{userID})
	if err != nil {
		return nil, err
	}
	if _, err = s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrapf(err, "failed to update GroupMember with groupId=%s and userId=%s", groupID, userID)
	}

	return members[0], nil
}

func (s *SqlGroupStore) PermanentDeleteMembersByUser(userId string) error {
	builder := s.getQueryBuilder().
		Delete("GroupMembers").
		Where(sq.Eq{"UserId": userId})
	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
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

		_, insertErr = s.GetMaster().NamedExec(`INSERT INTO GroupTeams
			(GroupId, AutoAdd, SchemeAdmin, CreateAt, DeleteAt, UpdateAt, TeamId)
			VALUES
			(:GroupId, :AutoAdd, :SchemeAdmin, :CreateAt, :DeleteAt, :UpdateAt, :TeamId)`, groupSyncableToGroupTeam(groupSyncable))
	case model.GroupSyncableTypeChannel:
		var channel *model.Channel
		channel, err := s.Channel().Get(groupSyncable.SyncableId, false)
		if err != nil {
			return nil, err
		}
		_, insertErr = s.GetMaster().NamedExec(`INSERT INTO GroupChannels
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
		err = s.GetReplica().GetBuilder(&team, s.groupTeamsSelectQuery.Where(sq.Eq{
			"GroupTeams.GroupId": groupID,
			"GroupTeams.TeamId":  syncableID,
		}))
		result = &team
	case model.GroupSyncableTypeChannel:
		var ch groupChannel
		err = s.GetReplica().GetBuilder(&ch, s.groupChannelsSelectQuery.Where(sq.Eq{
			"GroupChannels.GroupId":   groupID,
			"GroupChannels.ChannelId": syncableID,
		}))
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
		query := s.groupTeamsSelectQuery.
			Columns("Teams.DisplayName AS TeamDisplayName", "Teams.Type AS TeamType").
			Join("Teams ON Teams.Id = GroupTeams.TeamId").
			Where(sq.Eq{
				"GroupTeams.GroupId":  groupID,
				"GroupTeams.DeleteAt": 0,
			})

		results := []*groupTeamJoin{}
		err := s.GetReplica().SelectBuilder(&results, query)
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
		query := s.groupChannelsSelectQuery.
			Columns(
				"Channels.DisplayName AS ChannelDisplayName",
				"Teams.DisplayName AS TeamDisplayName",
				"Channels.Type As ChannelType",
				"Teams.Type As TeamType",
				"Teams.Id AS TeamId",
			).Join("Channels ON Channels.Id = GroupChannels.ChannelId").
			Join("Teams ON Teams.Id = Channels.TeamId").
			Where(sq.Eq{
				"GroupChannels.GroupId":  groupID,
				"GroupChannels.DeleteAt": 0,
			})

		results := []*groupChannelJoin{}
		err := s.GetReplica().SelectBuilder(&results, query)
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
		_, err = s.GetMaster().NamedExec(`UPDATE GroupTeams
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

		_, err = s.GetMaster().NamedExec(`UPDATE GroupChannels
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
		_, err = s.GetMaster().NamedExec(`UPDATE GroupTeams
			SET AutoAdd=:AutoAdd, SchemeAdmin=:SchemeAdmin, CreateAt=:CreateAt,
				DeleteAt=:DeleteAt, UpdateAt=:UpdateAt
			WHERE GroupId=:GroupId AND TeamId=:TeamId`, groupSyncableToGroupTeam(groupSyncable))
	case model.GroupSyncableTypeChannel:
		_, err = s.GetMaster().NamedExec(`UPDATE GroupChannels
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

func (s *SqlGroupStore) TeamMembersToAdd(since int64, teamID *string, reAddRemovedMembers bool) ([]*model.UserTeamIDPair, error) {
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

	if !reAddRemovedMembers {
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

	teamMembers := []*model.UserTeamIDPair{}

	if err := s.GetMaster().SelectBuilder(&teamMembers, builder); err != nil {
		return nil, errors.Wrap(err, "failed to find UserTeamIDPairs")
	}

	return teamMembers, nil
}

func (s *SqlGroupStore) ChannelMembersToAdd(since int64, channelID *string, reAddRemovedMembers bool) ([]*model.UserChannelIDPair, error) {
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

	if !reAddRemovedMembers {
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

	channelMembers := []*model.UserChannelIDPair{}

	if err := s.GetMaster().SelectBuilder(&channelMembers, builder); err != nil {
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

	teamMembers := []*model.TeamMember{}

	if err := s.GetReplica().SelectBuilder(&teamMembers, builder); err != nil {
		return nil, errors.Wrap(err, "failed to find TeamMembers")
	}

	return teamMembers, nil
}

func (s *SqlGroupStore) CountGroupsByChannel(channelId string, opts model.GroupSearchOpts) (int64, error) {
	builder := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeChannel, selectCountGroups, channelId, opts)

	var count int64
	if err := s.GetReplica().GetBuilder(&count, builder); err != nil {
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
		g.SyncableSchemeAdmin = model.NewPointer(false)
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
	builder := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeChannel, selectGroups, channelId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		builder = builder.OrderBy("UserGroups.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	groups := groupsWithSchemeAdmin{}
	if err := s.GetReplica().SelectBuilder(&groups, builder); err != nil {
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

	channelMembers := []*model.ChannelMember{}

	if err := s.GetReplica().SelectBuilder(&channelMembers, builder); err != nil {
		return nil, errors.Wrap(err, "failed to find ChannelMembers")
	}

	return channelMembers, nil
}

func (s *SqlGroupStore) groupsBySyncableBaseQuery(st model.GroupSyncableType, t selectType, syncableID string, opts model.GroupSearchOpts) sq.SelectBuilder {
	var query sq.SelectBuilder
	switch t {
	case selectGroups:
		query = s.userGroupsSelectQuery.
			Column("gs.SchemeAdmin AS SyncableSchemeAdmin")
	case selectCountGroups:
		query = s.getQueryBuilder().
			Select("COUNT(*)").
			From("UserGroups")
	}

	if st == model.GroupSyncableTypeTeam {
		query = query.
			Join("GroupTeams gs ON gs.GroupId = UserGroups.Id").
			Where(sq.Eq{
				"gs.TeamId":   syncableID,
				"gs.DeleteAt": 0,
			})
	} else {
		query = query.
			Join("GroupChannels gs ON gs.GroupId = UserGroups.Id").
			Where(sq.Eq{
				"gs.ChannelId": syncableID,
				"gs.DeleteAt":  0,
			})
	}

	query = query.
		Where(sq.Eq{
			"UserGroups.DeleteAt": 0,
		})

	if opts.IncludeMemberCount && t == selectGroups {
		query = query.
			Column("coalesce(Members.MemberCount, 0) AS MemberCount").
			LeftJoin("(SELECT GroupMembers.GroupId, COUNT(*) AS MemberCount FROM GroupMembers LEFT JOIN Users ON Users.Id = GroupMembers.UserId WHERE GroupMembers.DeleteAt = 0 AND Users.DeleteAt = 0 GROUP BY GroupId) AS Members ON Members.GroupId = UserGroups.Id").
			OrderBy("UserGroups.DisplayName")
	}

	if opts.FilterAllowReference && t == selectGroups {
		query = query.Where("UserGroups.AllowReference = true")
	}

	if opts.Q != "" {
		pattern := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(opts.Q, "\\"))
		operatorKeyword := "ILIKE"
		if s.DriverName() == model.DatabaseDriverMysql {
			operatorKeyword = "LIKE"
		}
		query = query.Where(fmt.Sprintf("(UserGroups.Name %[1]s ? OR UserGroups.DisplayName %[1]s ?)", operatorKeyword), pattern, pattern)
	}

	return query
}

func (s *SqlGroupStore) getGroupsAssociatedToChannelsByTeam(teamID string, opts model.GroupSearchOpts) sq.SelectBuilder {
	query := s.userGroupsSelectQuery.
		Columns("gc.ChannelId", "gc.SchemeAdmin AS SyncableSchemeAdmin").
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
				AND Channels.TeamId = ?) AS gc ON gc.GroupId = UserGroups.Id`, teamID).
		Where("UserGroups.DeleteAt = 0 AND gc.DeleteAt = 0").
		OrderBy("UserGroups.DisplayName")

	if opts.IncludeMemberCount {
		query = s.userGroupsSelectQuery.
			Columns("gc.ChannelId", "coalesce(Members.MemberCount, 0) AS MemberCount", "gc.SchemeAdmin AS SyncableSchemeAdmin").
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
					AND Channels.TeamId = ?) AS gc ON gc.GroupId = UserGroups.Id`, teamID).
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
			ON Members.GroupId = UserGroups.Id`).
			Where("UserGroups.DeleteAt = 0 AND gc.DeleteAt = 0").
			OrderBy("UserGroups.DisplayName")
	}

	if opts.FilterAllowReference {
		query = query.Where("UserGroups.AllowReference = true")
	}

	if opts.Q != "" {
		pattern := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(opts.Q, "\\"))
		operatorKeyword := "ILIKE"
		if s.DriverName() == model.DatabaseDriverMysql {
			operatorKeyword = "LIKE"
		}
		query = query.Where(fmt.Sprintf("(UserGroups.Name %[1]s ? OR UserGroups.DisplayName %[1]s ?)", operatorKeyword), pattern, pattern)
	}

	return query
}

func (s *SqlGroupStore) CountGroupsByTeam(teamId string, opts model.GroupSearchOpts) (int64, error) {
	builder := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeTeam, selectCountGroups, teamId, opts)

	var count int64
	if err := s.GetReplica().GetBuilder(&count, builder); err != nil {
		return int64(0), errors.Wrapf(err, "failed to count Groups with teamId=%s", teamId)
	}

	return count, nil
}

func (s *SqlGroupStore) GetGroupsByTeam(teamId string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, error) {
	builder := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeTeam, selectGroups, teamId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		builder = builder.OrderBy("UserGroups.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	groups := groupsWithSchemeAdmin{}
	if err := s.GetReplica().SelectBuilder(&groups, builder); err != nil {
		return nil, errors.Wrapf(err, "failed to find Groups with teamId=%s", teamId)
	}

	return groups.ToModel(), nil
}

func (s *SqlGroupStore) GetGroupsAssociatedToChannelsByTeam(teamId string, opts model.GroupSearchOpts) (map[string][]*model.GroupWithSchemeAdmin, error) {
	builder := s.getGroupsAssociatedToChannelsByTeam(teamId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		builder = builder.OrderBy("UserGroups.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	tgroups := groupsAssociatedToChannelWithSchemeAdmin{}

	if err := s.GetReplica().SelectBuilder(&tgroups, builder); err != nil {
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

	groupsQuery := s.userGroupsSelectQuery

	if opts.IncludeMemberCount {
		groupsQuery = groupsQuery.Column("coalesce(Members.MemberCount, 0) AS MemberCount")
	}

	if opts.IncludeChannelMemberCount != "" {
		groupsQuery = groupsQuery.Column("coalesce(ChannelMembers.ChannelMemberCount, 0) AS ChannelMemberCount")
		if opts.IncludeTimezones {
			groupsQuery = groupsQuery.Column("coalesce(ChannelMembers.ChannelMemberTimezonesCount, 0) AS ChannelMemberTimezonesCount")
		}
	}

	if opts.IncludeMemberCount {
		countQuery := s.getQueryBuilder().
			Select("GroupMembers.GroupId, COUNT(DISTINCT Users.Id) AS MemberCount").
			From("GroupMembers").
			LeftJoin("Users ON Users.Id = GroupMembers.UserId").
			Where(sq.Eq{"GroupMembers.DeleteAt": 0}).
			Where(sq.Eq{"Users.DeleteAt": 0}).
			GroupBy("GroupId")

		countQuery = applyViewRestrictionsFilter(countQuery, viewRestrictions, false)

		countString, params, err := countQuery.PlaceholderFormat(sq.Question).ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "get_groups_tosql")
		}
		groupsQuery = groupsQuery.
			LeftJoin("("+countString+") AS Members ON Members.GroupId = UserGroups.Id", params...)
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
			LeftJoin("(SELECT "+selectStr+" FROM ChannelMembers LEFT JOIN GroupMembers ON GroupMembers.UserId = ChannelMembers.UserId AND GroupMembers.DeleteAt = 0 "+joinStr+" WHERE ChannelMembers.ChannelId = ? GROUP BY GroupId) AS ChannelMembers ON ChannelMembers.GroupId = UserGroups.Id", opts.IncludeChannelMemberCount)
	}

	if opts.FilterHasMember != "" {
		groupsQuery = groupsQuery.
			LeftJoin("GroupMembers ON GroupMembers.GroupId = UserGroups.Id").
			Where("GroupMembers.UserId = ?", opts.FilterHasMember).
			Where("GroupMembers.DeleteAt = 0")
	}

	if opts.Since > 0 {
		groupsQuery = groupsQuery.Where(sq.Gt{
			"UserGroups.UpdateAt": opts.Since,
		})
	}

	if opts.FilterArchived {
		groupsQuery = groupsQuery.Where("UserGroups.DeleteAt > 0")
	} else if !opts.IncludeArchived && opts.Since <= 0 {
		// Mobile needs to return archived groups when the since parameter is set, will need to keep this for backwards compatibility
		groupsQuery = groupsQuery.Where("UserGroups.DeleteAt = 0")
	}

	if opts.IncludeArchived {
		groupsQuery = groupsQuery.OrderBy("CASE WHEN UserGroups.DeleteAt = 0 THEN UserGroups.DisplayName end, CASE WHEN UserGroups.DeleteAt != 0 THEN UserGroups.DisplayName END")
	} else {
		groupsQuery = groupsQuery.OrderBy("UserGroups.DisplayName")
	}

	if perPage != 0 {
		groupsQuery = groupsQuery.
			Limit(uint64(perPage)).
			Offset(uint64(page * perPage))
	}

	if opts.FilterAllowReference {
		groupsQuery = groupsQuery.Where("UserGroups.AllowReference = true")
	}

	if opts.Q != "" {
		pattern := fmt.Sprintf("%%%s%%", sanitizeSearchTerm(opts.Q, "\\"))
		operatorKeyword := "ILIKE"
		if s.DriverName() == model.DatabaseDriverMysql {
			operatorKeyword = "LIKE"
		}
		groupsQuery = groupsQuery.Where(fmt.Sprintf("(UserGroups.Name %[1]s ? OR UserGroups.DisplayName %[1]s ?)", operatorKeyword), pattern, pattern)
	}

	if len(opts.NotAssociatedToTeam) == 26 {
		groupsQuery = groupsQuery.Where(`
			UserGroups.Id NOT IN (
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
			UserGroups.Id NOT IN (
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
			) THEN UserGroups.Id IN (
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
		groupsQuery = groupsQuery.Where("UserGroups.Source = ?", opts.Source)
	} else if opts.OnlySyncableSources {
		sources := model.GetSyncableGroupSources()
		sourcePrefixes := model.GetSyncableGroupSourcePrefixes()

		orClauses := sq.Or{}
		if len(sources) > 0 {
			orClauses = append(orClauses, sq.Eq{"UserGroups.Source": sources})
		}
		for _, prefix := range sourcePrefixes {
			orClauses = append(orClauses, sq.Like{"UserGroups.Source": string(prefix) + "%"})
		}
		groupsQuery = groupsQuery.Where(orClauses)
	}

	if err := s.GetReplica().SelectBuilder(&groupsVar, groupsQuery); err != nil {
		return nil, errors.Wrap(err, "failed to find Groups")
	}

	return groupsVar.ToModel(), nil
}

func (s *SqlGroupStore) teamMembersMinusGroupMembersQuery(teamID string, groupIDs []string, isCount bool) sq.SelectBuilder {
	var builder sq.SelectBuilder

	if isCount {
		builder = s.getQueryBuilder().Select("count(DISTINCT Users.Id)")
	} else {
		builder = s.getQueryBuilder().Select().
			Columns(getUsersColumns()...).
			Column("coalesce(TeamMembers.SchemeGuest, false) SchemeGuest").
			Column("TeamMembers.SchemeAdmin").
			Column("TeamMembers.SchemeUser")

		if s.DriverName() == model.DatabaseDriverMysql {
			builder = builder.Column("group_concat(UserGroups.Id) AS GroupIDs")
		} else {
			builder = builder.Column("string_agg(UserGroups.Id, ',') AS GroupIDs")
		}
	}

	subQuery := s.getQueryBuilder().Select("GroupMembers.UserId").
		From("GroupMembers").
		Join("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("GroupMembers.DeleteAt = 0").
		Where(fmt.Sprintf("GroupMembers.GroupId IN ('%s')", strings.Join(groupIDs, "', '")))

	query, _ := subQuery.MustSql()

	builder = builder.
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
	builder := s.teamMembersMinusGroupMembersQuery(teamID, groupIDs, false)
	builder = builder.OrderBy("Users.Username ASC").Limit(uint64(perPage)).Offset(uint64(page * perPage))

	users := []*model.UserWithGroups{}
	if err := s.GetReplica().SelectBuilder(&users, builder); err != nil {
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
	if err := s.GetReplica().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count TeamMembers minus GroupMembers")
	}

	return count, nil
}

func (s *SqlGroupStore) channelMembersMinusGroupMembersQuery(channelID string, groupIDs []string, isCount bool) sq.SelectBuilder {
	builder := s.getQueryBuilder().Select()

	if isCount {
		builder = builder.Column("count(DISTINCT Users.Id)")
	} else {
		builder = builder.Columns(getUsersColumns()...)
		builder = builder.Columns(
			"COALESCE(ChannelMembers.SchemeGuest, FALSE) SchemeGuest",
			"ChannelMembers.SchemeAdmin",
			"ChannelMembers.SchemeUser",
		)

		if s.DriverName() == model.DatabaseDriverMysql {
			builder = builder.Column("group_concat(UserGroups.Id) AS GroupIDs")
		} else {
			builder = builder.Column("string_agg(UserGroups.Id, ',') AS GroupIDs")
		}
	}

	subQuery := s.getQueryBuilder().Select("GroupMembers.UserId").
		From("GroupMembers").
		Join("UserGroups ON UserGroups.Id = GroupMembers.GroupId").
		Where("GroupMembers.DeleteAt = 0").
		Where(fmt.Sprintf("GroupMembers.GroupId IN ('%s')", strings.Join(groupIDs, "', '")))

	query, _ := subQuery.MustSql()

	builder = builder.
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
	builder := s.channelMembersMinusGroupMembersQuery(channelID, groupIDs, false)
	builder = builder.OrderBy("Users.Username ASC").Limit(uint64(perPage)).Offset(uint64(page * perPage))

	users := []*model.UserWithGroups{}
	if err := s.GetReplica().SelectBuilder(&users, builder); err != nil {
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
	if err := s.GetReplica().Get(&count, queryString, args...); err != nil {
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

	err := s.GetReplica().Select(&groupIds, query, userID, syncableID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Group ids")
	}

	return groupIds, nil
}

func (s *SqlGroupStore) PermittedSyncableAdmins(syncableID string, syncableType model.GroupSyncableType) ([]string, error) {
	builder := s.getQueryBuilder().Select("UserId").
		From(fmt.Sprintf("Group%ss", syncableType)).
		Join(fmt.Sprintf("GroupMembers ON GroupMembers.GroupId = Group%ss.GroupId AND Group%[1]ss.SchemeAdmin = TRUE AND GroupMembers.DeleteAt = 0", syncableType.String())).Where(fmt.Sprintf("Group%[1]ss.%[1]sId = ?", syncableType.String()), syncableID)

	var userIDs []string
	if err := s.GetMaster().SelectBuilder(&userIDs, builder); err != nil {
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

	var count int64
	if err := s.GetReplica().GetBuilder(&count, builder); err != nil {
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
	err = s.GetReplica().Get(&count, sql, args...)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count from table %s", tableName)
	}

	return count, nil
}

func (s *SqlGroupStore) UpsertMembers(groupID string, userIDs []string) ([]*model.GroupMember, error) {
	members, query, err := s.buildUpsertMembersQuery(groupID, userIDs)
	if err != nil {
		return nil, err
	}

	if _, err = s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrap(err, "failed to save GroupMember")
	}

	return members, err
}

func (s *SqlGroupStore) buildUpsertMembersQuery(groupID string, userIDs []string) (members []*model.GroupMember, builder sq.InsertBuilder, err error) {
	var retrievedGroup model.Group
	// Check Group exists
	if err = s.GetReplica().GetBuilder(&retrievedGroup, s.userGroupsSelectQuery.Where(sq.Eq{"UserGroups.Id": groupID})); err != nil {
		err = errors.Wrapf(err, "failed to get UserGroup with groupId=%s", groupID)
		return
	}

	// Check Users exist
	if err = s.checkUsersExist(userIDs); err != nil {
		return
	}

	builder = s.getQueryBuilder().
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

	return
}

func (s *SqlGroupStore) DeleteMembers(groupID string, userIDs []string) ([]*model.GroupMember, error) {
	members, query, err := s.buildDeleteMembersQuery(groupID, userIDs)
	if err != nil {
		return nil, err
	}

	if _, err = s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrap(err, "failed to delete GroupMembers")
	}
	return members, err
}

func (s *SqlGroupStore) buildDeleteMembersQuery(groupID string, userIDs []string) (members []*model.GroupMember, builder sq.UpdateBuilder, err error) {
	membersSelectQuery := s.groupMembersSelectQuery.
		Where(sq.And{
			sq.Eq{"GroupMembers.GroupId": groupID},
			sq.Eq{"GroupMembers.UserId": userIDs},
			sq.Eq{"GroupMembers.DeleteAt": 0},
		})

	if err = s.GetReplica().SelectBuilder(&members, membersSelectQuery); err != nil {
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

	builder = s.getQueryBuilder().
		Update("GroupMembers").
		Set("DeleteAt", deleteAt).
		Where(sq.And{
			sq.Eq{"GroupId": groupID},
			sq.Eq{"UserId": userIDs},
		})

	return
}
