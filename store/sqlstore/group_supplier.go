// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type selectType int

const (
	selectGroups selectType = iota
	selectCountGroups
)

type groupTeam struct {
	model.GroupSyncable
	TeamId string `db:"TeamId"`
}

type groupChannel struct {
	model.GroupSyncable
	ChannelId string `db:"ChannelId"`
}

type groupTeamJoin struct {
	groupTeam
	TeamDisplayName string `db:"TeamDisplayName"`
	TeamType        string `db:"TeamType"`
}

type groupChannelJoin struct {
	groupChannel
	ChannelDisplayName string `db:"ChannelDisplayName"`
	TeamDisplayName    string `db:"TeamDisplayName"`
	TeamType           string `db:"TeamType"`
	ChannelType        string `db:"ChannelType"`
	TeamID             string `db:"TeamId"`
}

func initSqlSupplierGroups(sqlStore SqlStore) {
	for _, db := range sqlStore.GetAllConns() {
		groups := db.AddTableWithName(model.Group{}, "UserGroups").SetKeys(false, "Id")
		groups.ColMap("Id").SetMaxSize(26)
		groups.ColMap("Name").SetMaxSize(model.GroupNameMaxLength).SetUnique(true)
		groups.ColMap("DisplayName").SetMaxSize(model.GroupDisplayNameMaxLength)
		groups.ColMap("Description").SetMaxSize(model.GroupDescriptionMaxLength)
		groups.ColMap("Source").SetMaxSize(model.GroupSourceMaxLength)
		groups.ColMap("RemoteId").SetMaxSize(model.GroupRemoteIDMaxLength)
		groups.SetUniqueTogether("Source", "RemoteId")

		groupMembers := db.AddTableWithName(model.GroupMember{}, "GroupMembers").SetKeys(false, "GroupId", "UserId")
		groupMembers.ColMap("GroupId").SetMaxSize(26)
		groupMembers.ColMap("UserId").SetMaxSize(26)

		groupTeams := db.AddTableWithName(groupTeam{}, "GroupTeams").SetKeys(false, "GroupId", "TeamId")
		groupTeams.ColMap("GroupId").SetMaxSize(26)
		groupTeams.ColMap("TeamId").SetMaxSize(26)

		groupChannels := db.AddTableWithName(groupChannel{}, "GroupChannels").SetKeys(false, "GroupId", "ChannelId")
		groupChannels.ColMap("GroupId").SetMaxSize(26)
		groupChannels.ColMap("ChannelId").SetMaxSize(26)
	}
}

func (s *SqlSupplier) CreateIndexesIfNotExistsGroups() {
	s.CreateIndexIfNotExists("idx_groupmembers_create_at", "GroupMembers", "CreateAt")
	s.CreateIndexIfNotExists("idx_usergroups_remote_id", "UserGroups", "RemoteId")
	s.CreateIndexIfNotExists("idx_usergroups_delete_at", "UserGroups", "DeleteAt")
}

func (s *SqlSupplier) GroupCreate(ctx context.Context, group *model.Group, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if len(group.Id) != 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupCreate", "model.group.id.app_error", nil, "", http.StatusBadRequest)
		return result
	}

	if err := group.IsValidForCreate(); err != nil {
		result.Err = err
		return result
	}

	group.Id = model.NewId()
	group.CreateAt = model.GetMillis()
	group.UpdateAt = group.CreateAt

	if err := s.GetMaster().Insert(group); err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "groups_name_key"}) {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreate", "store.sql_group.unique_constraint", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreate", "store.insert_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	result.Data = group
	return result
}

func (s *SqlSupplier) GroupGet(ctx context.Context, groupId string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var group *model.Group
	if err := s.GetReplica().SelectOne(&group, "SELECT * from UserGroups WHERE Id = :Id", map[string]interface{}{"Id": groupId}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupGet", "store.sql_group.no_rows", nil, err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupGet", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	result.Data = group
	return result
}

func (s *SqlSupplier) GroupGetByRemoteID(ctx context.Context, remoteID string, groupSource model.GroupSource, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var group *model.Group
	if err := s.GetReplica().SelectOne(&group, "SELECT * from UserGroups WHERE RemoteId = :RemoteId AND Source = :Source", map[string]interface{}{"RemoteId": remoteID, "Source": groupSource}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupGetByRemoteID", "store.sql_group.no_rows", nil, err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupGetByRemoteID", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	result.Data = group
	return result
}

func (s *SqlSupplier) GroupGetAllBySource(ctx context.Context, groupSource model.GroupSource, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var groups []*model.Group

	if _, err := s.GetReplica().Select(&groups, "SELECT * from UserGroups WHERE DeleteAt = 0 AND Source = :Source", map[string]interface{}{"Source": groupSource}); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupGetAllBySource", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groups

	return result
}

func (s *SqlSupplier) GroupUpdate(ctx context.Context, group *model.Group, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var retrievedGroup *model.Group
	if err := s.GetMaster().SelectOne(&retrievedGroup, "SELECT * FROM UserGroups WHERE Id = :Id", map[string]interface{}{"Id": group.Id}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupUpdate", "store.sql_group.no_rows", nil, "id="+group.Id+","+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupUpdate", "store.select_error", nil, "id="+group.Id+","+err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	// If updating DeleteAt it can only be to 0
	if group.DeleteAt != retrievedGroup.DeleteAt && group.DeleteAt != 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdate", "model.group.delete_at.app_error", nil, "", http.StatusInternalServerError)
		return result
	}

	// Reset these properties, don't update them based on input
	group.CreateAt = retrievedGroup.CreateAt
	group.UpdateAt = model.GetMillis()

	if err := group.IsValidForUpdate(); err != nil {
		result.Err = err
		return result
	}

	rowsChanged, err := s.GetMaster().Update(group)
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdate", "store.update_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}
	if rowsChanged != 1 {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdate", "store.sql_group.no_rows_changed", nil, "", http.StatusInternalServerError)
		return result
	}

	result.Data = group
	return result
}

func (s *SqlSupplier) GroupDelete(ctx context.Context, groupID string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var group *model.Group
	if err := s.GetReplica().SelectOne(&group, "SELECT * from UserGroups WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": groupID}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupDelete", "store.sql_group.no_rows", nil, "Id="+groupID+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupDelete", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		}

		return result
	}

	time := model.GetMillis()
	group.DeleteAt = time
	group.UpdateAt = time

	if _, err := s.GetMaster().Update(group); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupDelete", "store.update_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result.Data = group
	return result
}

func (s *SqlSupplier) GroupGetMemberUsers(stc context.Context, groupID string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var groupMembers []*model.User

	query := `
		SELECT
			Users.*
		FROM
			GroupMembers
			JOIN Users ON Users.Id = GroupMembers.UserId
		WHERE
			GroupMembers.DeleteAt = 0
			AND Users.DeleteAt = 0
			AND GroupId = :GroupId`

	if _, err := s.GetReplica().Select(&groupMembers, query, map[string]interface{}{"GroupId": groupID}); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupGetAllBySource", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groupMembers

	return result
}

func (s *SqlSupplier) GroupGetMemberUsersPage(stc context.Context, groupID string, offset int, limit int, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var groupMembers []*model.User

	query := `
		SELECT
			Users.*
		FROM
			GroupMembers
			JOIN Users ON Users.Id = GroupMembers.UserId
		WHERE
			GroupMembers.DeleteAt = 0
			AND Users.DeleteAt = 0
			AND GroupId = :GroupId
		ORDER BY
			GroupMembers.CreateAt DESC
		LIMIT
			:Limit
		OFFSET
			:Offset`

	if _, err := s.GetReplica().Select(&groupMembers, query, map[string]interface{}{"GroupId": groupID, "Limit": limit, "Offset": offset}); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupGetMemberUsersPage", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groupMembers

	return result
}

func (s *SqlSupplier) GroupGetMemberCount(stc context.Context, groupID string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var count int64
	var err error

	query := `
		SELECT
			count(*)
		FROM
			GroupMembers
		WHERE
			GroupMembers.GroupId = :GroupId`

	if count, err = s.GetReplica().SelectInt(query, map[string]interface{}{"GroupId": groupID}); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupGetMemberUsersPage", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = count

	return result
}

func (s *SqlSupplier) GroupCreateOrRestoreMember(ctx context.Context, groupID string, userID string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	member := &model.GroupMember{
		GroupId:  groupID,
		UserId:   userID,
		CreateAt: model.GetMillis(),
	}

	if result.Err = member.IsValid(); result.Err != nil {
		return result
	}

	var retrievedGroup *model.Group
	if err := s.GetMaster().SelectOne(&retrievedGroup, "SELECT * FROM UserGroups WHERE Id = :Id", map[string]interface{}{"Id": groupID}); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.insert_error", nil, "group_id="+member.GroupId+"user_id="+member.UserId+","+err.Error(), http.StatusInternalServerError)
		return result
	}

	var retrievedMember *model.GroupMember
	if err := s.GetMaster().SelectOne(&retrievedMember, "SELECT * FROM GroupMembers WHERE GroupId = :GroupId AND UserId = :UserId", map[string]interface{}{"GroupId": member.GroupId, "UserId": member.UserId}); err != nil {
		if err != sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.select_error", nil, "group_id="+member.GroupId+"user_id="+member.UserId+","+err.Error(), http.StatusInternalServerError)
			return result
		}
	}

	if retrievedMember != nil && retrievedMember.DeleteAt == 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.sql_group.uniqueness_error", nil, "group_id="+member.GroupId+", user_id="+member.UserId, http.StatusBadRequest)
		return result
	}

	if retrievedMember == nil {
		if err := s.GetMaster().Insert(member); err != nil {
			if IsUniqueConstraintError(err, []string{"GroupId", "UserId", "groupmembers_pkey", "PRIMARY"}) {
				result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.sql_group.uniqueness_error", nil, "group_id="+member.GroupId+", user_id="+member.UserId+", "+err.Error(), http.StatusBadRequest)
				return result
			}
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.insert_error", nil, "group_id="+member.GroupId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
			return result
		}
	} else {
		member.DeleteAt = 0
		var rowsChanged int64
		var err error
		if rowsChanged, err = s.GetMaster().Update(member); err != nil {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.update_error", nil, "group_id="+member.GroupId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
			return result
		}
		if rowsChanged != 1 {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.sql_group.no_rows_changed", nil, "", http.StatusInternalServerError)
			return result
		}
	}

	result.Data = member
	return result
}

func (s *SqlSupplier) GroupDeleteMember(ctx context.Context, groupID string, userID string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var retrievedMember *model.GroupMember
	if err := s.GetMaster().SelectOne(&retrievedMember, "SELECT * FROM GroupMembers WHERE GroupId = :GroupId AND UserId = :UserId AND DeleteAt = 0", map[string]interface{}{"GroupId": groupID, "UserId": userID}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupDeleteMember", "store.sql_group.no_rows", nil, "group_id="+groupID+"user_id="+userID+","+err.Error(), http.StatusNotFound)
			return result
		}
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteMember", "store.select_error", nil, "group_id="+groupID+"user_id="+userID+","+err.Error(), http.StatusInternalServerError)
		return result
	}

	retrievedMember.DeleteAt = model.GetMillis()

	if _, err := s.GetMaster().Update(retrievedMember); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteMember", "store.update_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = retrievedMember
	return result
}

func (s *SqlSupplier) GroupCreateGroupSyncable(ctx context.Context, groupSyncable *model.GroupSyncable, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if err := groupSyncable.IsValid(); err != nil {
		result.Err = err
		return result
	}

	// Reset values that shouldn't be updatable by parameter
	groupSyncable.DeleteAt = 0
	groupSyncable.CreateAt = model.GetMillis()
	groupSyncable.UpdateAt = groupSyncable.CreateAt

	var err error

	switch groupSyncable.Type {
	case model.GroupSyncableTypeTeam:
		if _, err := s.Team().Get(groupSyncable.SyncableId); err != nil {
			result.Err = err
			return result
		}

		err = s.GetMaster().Insert(groupSyncableToGroupTeam(groupSyncable))
	case model.GroupSyncableTypeChannel:
		_, errCh := s.Channel().Get(groupSyncable.SyncableId, false)
		if errCh != nil {
			result.Err = errCh
			return result
		}

		err = s.GetMaster().Insert(groupSyncableToGroupChannel(groupSyncable))
	default:
		result.Err = model.NewAppError("SqlGroupStore.GroupCreateGroupSyncable", "model.group_syncable.type.app_error", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupCreateGroupSyncable", "store.insert_error", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groupSyncable
	return result
}

func (s *SqlSupplier) GroupGetGroupSyncable(ctx context.Context, groupID string, syncableID string, syncableType model.GroupSyncableType, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	groupSyncable, err := s.getGroupSyncable(groupID, syncableID, syncableType)
	if err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupGetGroupSyncable", "store.sql_group.no_rows", nil, err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupGetGroupSyncable", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	result.Data = groupSyncable

	return result
}

func (s *SqlSupplier) getGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, error) {
	var err error
	var result interface{}

	switch syncableType {
	case model.GroupSyncableTypeTeam:
		result, err = s.GetMaster().Get(groupTeam{}, groupID, syncableID)
	case model.GroupSyncableTypeChannel:
		result, err = s.GetMaster().Get(groupChannel{}, groupID, syncableID)
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

func (s *SqlSupplier) GroupGetAllGroupSyncablesByGroup(ctx context.Context, groupID string, syncableType model.GroupSyncableType, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	args := map[string]interface{}{"GroupId": groupID}

	appErrF := func(msg string) *model.AppError {
		return model.NewAppError("SqlGroupStore.GroupGetAllGroupSyncablesByGroup", "store.select_error", nil, msg, http.StatusInternalServerError)
	}

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
				GroupId = :GroupId AND GroupTeams.DeleteAt = 0`

		results := []*groupTeamJoin{}
		_, err := s.GetMaster().Select(&results, sqlQuery, args)
		if err != nil {
			result.Err = appErrF(err.Error())
			return result
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
				GroupId = :GroupId AND GroupChannels.DeleteAt = 0`

		results := []*groupChannelJoin{}
		_, err := s.GetMaster().Select(&results, sqlQuery, args)
		if err != nil {
			result.Err = appErrF(err.Error())
			return result
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
			}
			groupSyncables = append(groupSyncables, groupSyncable)
		}
	}

	result.Data = groupSyncables
	return result
}

func (s *SqlSupplier) GroupUpdateGroupSyncable(ctx context.Context, groupSyncable *model.GroupSyncable, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	retrievedGroupSyncable, err := s.getGroupSyncable(groupSyncable.GroupId, groupSyncable.SyncableId, groupSyncable.Type)
	if err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "store.sql_group.no_rows", nil, err.Error(), http.StatusInternalServerError)
			return result
		}
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "store.select_error", nil, "GroupId="+groupSyncable.GroupId+", SyncableId="+groupSyncable.SyncableId+", SyncableType="+groupSyncable.Type.String()+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	if err := groupSyncable.IsValid(); err != nil {
		result.Err = err
		return result
	}

	// If updating DeleteAt it can only be to 0
	if groupSyncable.DeleteAt != retrievedGroupSyncable.DeleteAt && groupSyncable.DeleteAt != 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "model.group.delete_at.app_error", nil, "", http.StatusInternalServerError)
		return result
	}

	// Reset these properties, don't update them based on input
	groupSyncable.CreateAt = retrievedGroupSyncable.CreateAt
	groupSyncable.UpdateAt = model.GetMillis()

	switch groupSyncable.Type {
	case model.GroupSyncableTypeTeam:
		_, err = s.GetMaster().Update(groupSyncableToGroupTeam(groupSyncable))
	case model.GroupSyncableTypeChannel:
		_, err = s.GetMaster().Update(groupSyncableToGroupChannel(groupSyncable))
	default:
		model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "model.group_syncable.type.app_error", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "store.update_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groupSyncable
	return result
}

func (s *SqlSupplier) GroupDeleteGroupSyncable(ctx context.Context, groupID string, syncableID string, syncableType model.GroupSyncableType, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	groupSyncable, err := s.getGroupSyncable(groupID, syncableID, syncableType)
	if err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.sql_group.no_rows", nil, "Id="+groupID+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	if groupSyncable.DeleteAt != 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.sql_group.group_syncable_already_deleted", nil, "group_id="+groupID+"syncable_id="+syncableID, http.StatusBadRequest)
		return result
	}

	time := model.GetMillis()
	groupSyncable.DeleteAt = time
	groupSyncable.UpdateAt = time

	switch groupSyncable.Type {
	case model.GroupSyncableTypeTeam:
		_, err = s.GetMaster().Update(groupSyncableToGroupTeam(groupSyncable))
	case model.GroupSyncableTypeChannel:
		_, err = s.GetMaster().Update(groupSyncableToGroupChannel(groupSyncable))
	default:
		model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "model.group_syncable.type.app_error", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.update_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groupSyncable
	return result
}

// TeamMembersToAdd returns a slice of UserTeamIDPair that need newly created memberships
// based on the groups configurations.
//
// Typically since will be the last successful group sync time.
func (s *SqlSupplier) TeamMembersToAdd(ctx context.Context, since int64, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	sql := `
		SELECT
			GroupMembers.UserId, GroupTeams.TeamId
		FROM
			GroupMembers
			JOIN GroupTeams
			ON GroupTeams.GroupId = GroupMembers.GroupId
			JOIN UserGroups ON UserGroups.Id = GroupMembers.GroupId
			JOIN Teams ON Teams.Id = GroupTeams.TeamId
			LEFT OUTER JOIN TeamMembers
			ON
				TeamMembers.TeamId = GroupTeams.TeamId
				AND TeamMembers.UserId = GroupMembers.UserId
		WHERE
			TeamMembers.UserId IS NULL
			AND UserGroups.DeleteAt = 0
			AND GroupTeams.DeleteAt = 0
			AND GroupTeams.AutoAdd = true
			AND GroupMembers.DeleteAt = 0
			AND Teams.DeleteAt = 0
			AND (GroupMembers.CreateAt >= :Since
			OR GroupTeams.UpdateAt >= :Since)`

	var teamMembers []*model.UserTeamIDPair

	_, err := s.GetReplica().Select(&teamMembers, sql, map[string]interface{}{"Since": since})
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.TeamMembersToAdd", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result.Data = teamMembers

	return result
}

// ChannelMembersToAdd returns a slice of UserChannelIDPair that need newly created memberships
// based on the groups configurations.
//
// Typically since will be the last successful group sync time.
func (s *SqlSupplier) ChannelMembersToAdd(ctx context.Context, since int64, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	sql := `
		SELECT
			GroupMembers.UserId, GroupChannels.ChannelId
		FROM
			GroupMembers
			JOIN GroupChannels ON GroupChannels.GroupId = GroupMembers.GroupId
			JOIN UserGroups ON UserGroups.Id = GroupMembers.GroupId
			JOIN Channels ON Channels.Id = GroupChannels.ChannelId
			LEFT OUTER JOIN ChannelMemberHistory
			ON
				ChannelMemberHistory.ChannelId = GroupChannels.ChannelId
				AND ChannelMemberHistory.UserId = GroupMembers.UserId
		WHERE
			ChannelMemberHistory.UserId IS NULL
			AND ChannelMemberHistory.LeaveTime IS NULL
			AND UserGroups.DeleteAt = 0
			AND GroupChannels.DeleteAt = 0
			AND GroupChannels.AutoAdd = true
			AND GroupMembers.DeleteAt = 0
			AND Channels.DeleteAt = 0
			AND (GroupMembers.CreateAt >= :Since
			OR GroupChannels.UpdateAt >= :Since)`

	var channelMembers []*model.UserChannelIDPair

	_, err := s.GetReplica().Select(&channelMembers, sql, map[string]interface{}{"Since": since})
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.ChannelMembersToAdd", "store.select_error", nil, "", http.StatusInternalServerError)
	}

	result.Data = channelMembers

	return result
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

// TeamMembersToRemove returns all team members that should be removed based on group constraints.
func (s *SqlSupplier) TeamMembersToRemove(ctx context.Context, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	sql := `
		SELECT
			TeamMembers.TeamId,
			TeamMembers.UserId,
			TeamMembers.Roles,
			TeamMembers.DeleteAt,
			TeamMembers.SchemeUser,
			TeamMembers.SchemeAdmin,
			(TeamMembers.SchemeGuest IS NOT NULL AND TeamMembers.SchemeGuest) as SchemeGuest
		FROM
			TeamMembers
			JOIN Teams ON Teams.Id = TeamMembers.TeamId
			LEFT JOIN Bots ON Bots.UserId = TeamMembers.UserId
		WHERE
			TeamMembers.DeleteAt = 0
			AND Teams.DeleteAt = 0
			AND Teams.GroupConstrained = TRUE
			AND Bots.UserId IS NULL
			AND (TeamMembers.TeamId, TeamMembers.UserId)
			NOT IN (
				SELECT
					Teams.Id AS TeamId, GroupMembers.UserId
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

	var teamMembers []*model.TeamMember

	_, err := s.GetReplica().Select(&teamMembers, sql)
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.TeamMembersToRemove", "store.select_error", nil, "", http.StatusInternalServerError)
	}

	result.Data = teamMembers

	return result
}

func (s *SqlSupplier) CountGroupsByChannel(ctx context.Context, channelId string, opts model.GroupSearchOpts, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	countQuery := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeChannel, selectCountGroups, channelId, opts)

	countQueryString, args, err := countQuery.ToSql()
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.CountGroupsByChannel", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	count, err := s.GetReplica().SelectInt(countQueryString, args...)
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.CountGroupsByChannel", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = count

	return result
}

func (s *SqlSupplier) GetGroupsByChannel(ctx context.Context, channelId string, opts model.GroupSearchOpts, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	query := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeChannel, selectGroups, channelId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		query = query.OrderBy("ug.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GetGroupsByChannel", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	var groups []*model.Group

	_, err = s.GetReplica().Select(&groups, queryString, args...)
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GetGroupsByChannel", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groups

	return result
}

// ChannelMembersToRemove returns all channel members that should be removed based on group constraints.
func (s *SqlSupplier) ChannelMembersToRemove(ctx context.Context, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	sql := `
		SELECT
			ChannelMembers.ChannelId,
			ChannelMembers.UserId,
			ChannelMembers.LastViewedAt,
			ChannelMembers.MsgCount,
			ChannelMembers.MentionCount,
			ChannelMembers.NotifyProps,
			ChannelMembers.LastUpdateAt,
			ChannelMembers.LastUpdateAt,
			ChannelMembers.SchemeUser,
			ChannelMembers.SchemeAdmin,
			(ChannelMembers.SchemeGuest IS NOT NULL AND ChannelMembers.SchemeGuest) as SchemeGuest
		FROM
			ChannelMembers
			JOIN Channels ON Channels.Id = ChannelMembers.ChannelId
			LEFT JOIN Bots ON Bots.UserId = ChannelMembers.UserId
		WHERE
			Channels.DeleteAt = 0
			AND Channels.GroupConstrained = TRUE
			AND Bots.UserId IS NULL
			AND (ChannelMembers.ChannelId, ChannelMembers.UserId)
			NOT IN (
				SELECT
					Channels.Id AS ChannelId, GroupMembers.UserId
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

	var channelMembers []*model.ChannelMember

	_, err := s.GetReplica().Select(&channelMembers, sql)
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.ChannelMembersToRemove", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result.Data = channelMembers

	return result
}

func (s *SqlSupplier) groupsBySyncableBaseQuery(st model.GroupSyncableType, t selectType, syncableID string, opts model.GroupSearchOpts) squirrel.SelectBuilder {
	selectStrs := map[selectType]string{
		selectGroups:      "ug.*",
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
			Select("ug.*, coalesce(Members.MemberCount, 0) AS MemberCount").
			From("UserGroups ug").
			LeftJoin("(SELECT GroupMembers.GroupId, COUNT(*) AS MemberCount FROM GroupMembers WHERE GroupMembers.DeleteAt = 0 GROUP BY GroupId) AS Members ON Members.GroupId = ug.Id").
			LeftJoin(fmt.Sprintf("%[1]s ON %[1]s.GroupId = ug.Id", table)).
			Where(fmt.Sprintf("%[1]s.DeleteAt = 0 AND %[1]s.%[2]s = ?", table, idCol), syncableID).
			OrderBy("ug.DisplayName")
	}

	if len(opts.Q) > 0 {
		pattern := fmt.Sprintf("%%%s%%", opts.Q)
		operatorKeyword := "ILIKE"
		if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
			operatorKeyword = "LIKE"
		}
		query = query.Where(fmt.Sprintf("(ug.Name %[1]s ? OR ug.DisplayName %[1]s ?)", operatorKeyword), pattern, pattern)
	}

	return query
}

func (s *SqlSupplier) CountGroupsByTeam(ctx context.Context, teamId string, opts model.GroupSearchOpts, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	countQuery := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeTeam, selectCountGroups, teamId, opts)

	countQueryString, args, err := countQuery.ToSql()
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.CountGroupsByTeam", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	count, err := s.GetReplica().SelectInt(countQueryString, args...)
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.CountGroupsByTeam", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = count

	return result
}

func (s *SqlSupplier) GetGroupsByTeam(ctx context.Context, teamId string, opts model.GroupSearchOpts, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	query := s.groupsBySyncableBaseQuery(model.GroupSyncableTypeTeam, selectGroups, teamId, opts)

	if opts.PageOpts != nil {
		offset := uint64(opts.PageOpts.Page * opts.PageOpts.PerPage)
		query = query.OrderBy("ug.DisplayName").Limit(uint64(opts.PageOpts.PerPage)).Offset(offset)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GetGroupsByTeam", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	var groups []*model.Group

	_, err = s.GetReplica().Select(&groups, queryString, args...)
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GetGroupsByTeam", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groups

	return result
}

func (s *SqlSupplier) GetGroups(ctx context.Context, page, perPage int, opts model.GroupSearchOpts, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()
	var groups []*model.Group

	groupsQuery := s.getQueryBuilder().Select("g.*").From("UserGroups g").Limit(uint64(perPage)).Offset(uint64(page * perPage)).OrderBy("g.DisplayName")

	if opts.IncludeMemberCount {
		groupsQuery = s.getQueryBuilder().
			Select("g.*, coalesce(Members.MemberCount, 0) AS MemberCount").
			From("UserGroups g").
			LeftJoin("(SELECT GroupMembers.GroupId, COUNT(*) AS MemberCount FROM GroupMembers WHERE GroupMembers.DeleteAt = 0 GROUP BY GroupId) AS Members ON Members.GroupId = g.Id").
			Limit(uint64(perPage)).
			Offset(uint64(page * perPage)).
			OrderBy("g.DisplayName")
	}

	if len(opts.Q) > 0 {
		pattern := fmt.Sprintf("%%%s%%", opts.Q)
		operatorKeyword := "ILIKE"
		if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
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

	queryString, args, err := groupsQuery.ToSql()
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GetGroups", "store.sql_group.app_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	if _, err = s.GetReplica().Select(&groups, queryString, args...); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GetGroups", "store.select_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groups
	return result
}
