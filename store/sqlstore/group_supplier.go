// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type GroupTeam struct {
	model.GroupSyncable
	TeamId string `db:"TeamId"`
}

type GroupChannel struct {
	model.GroupSyncable
	ChannelId string `db:"ChannelId"`
}

func initSqlSupplierGroups(sqlStore SqlStore) {
	for _, db := range sqlStore.GetAllConns() {
		groups := db.AddTableWithName(model.Group{}, "Groups").SetKeys(false, "Id")
		groups.ColMap("Id").SetMaxSize(26)
		groups.ColMap("Name").SetMaxSize(model.GroupNameMaxLength).SetUnique(true)
		groups.ColMap("DisplayName").SetMaxSize(model.GroupDisplayNameMaxLength)
		groups.ColMap("Description").SetMaxSize(model.GroupDescriptionMaxLength)
		groups.ColMap("Type").SetMaxSize(model.GroupTypeMaxLength)
		groups.ColMap("RemoteId").SetMaxSize(model.GroupRemoteIDMaxLength)
		groups.SetUniqueTogether("Type", "RemoteId")

		groupMembers := db.AddTableWithName(model.GroupMember{}, "GroupMembers").SetKeys(false, "GroupId", "UserId")
		groupMembers.ColMap("GroupId").SetMaxSize(26)
		groupMembers.ColMap("UserId").SetMaxSize(26)

		groupTeams := db.AddTableWithName(GroupTeam{}, "GroupTeams").SetKeys(false, "GroupId", "TeamId")
		groupTeams.ColMap("GroupId").SetMaxSize(26)
		groupTeams.ColMap("TeamId").SetMaxSize(26)

		groupChannels := db.AddTableWithName(GroupChannel{}, "GroupChannels").SetKeys(false, "GroupId", "ChannelId")
		groupChannels.ColMap("GroupId").SetMaxSize(26)
		groupChannels.ColMap("ChannelId").SetMaxSize(26)
	}
}

func (s *SqlSupplier) GroupCreate(ctx context.Context, group *model.Group, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if len(group.Id) != 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupCreate", "store.sql_group.invalid_group_id", nil, "", http.StatusBadRequest)
		return result
	}

	if err := group.IsValidForCreate(); err != nil {
		result.Err = err
		return result
	}

	var transaction *gorp.Transaction
	var tErr error
	if transaction, tErr = s.GetMaster().Begin(); tErr != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupCreate", "store.sql_group.begin_transaction_error", nil, tErr.Error(), http.StatusInternalServerError)
		return result
	}

	if err := group.IsValidForCreate(); err != nil {
		result.Err = err
		return result
	}

	group.Id = model.NewId()
	group.CreateAt = model.GetMillis()
	group.UpdateAt = group.CreateAt

	if err := transaction.Insert(group); err != nil {
		if IsUniqueConstraintError(err, []string{"Name", "groups_name_key"}) {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreate", "store.sql_group.unique_constraint", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreate", "store.sql_group.insert_error", nil, err.Error(), http.StatusInternalServerError)
		}
		transaction.Rollback()
	} else {
		result.Data = group
	}

	if err := transaction.Commit(); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupCreate", "store.sql_group.commit_error", nil, err.Error(), http.StatusInternalServerError)
		result.Data = nil
	}

	return result
}

func (s *SqlSupplier) GroupGet(ctx context.Context, groupId string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var group *model.Group
	if err := s.GetReplica().SelectOne(&group, "SELECT * from Groups WHERE Id = :Id", map[string]interface{}{"Id": groupId}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupGet", "store.sql_group.no_rows", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupGet", "store.sql_group.select_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	result.Data = group
	return result
}

func (s *SqlSupplier) GroupGetByRemoteID(ctx context.Context, remoteID string, groupType model.GroupType, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var group *model.Group
	if err := s.GetReplica().SelectOne(&group, "SELECT * from Groups WHERE RemoteId = :RemoteId AND Type = :Type", map[string]interface{}{"RemoteId": remoteID, "Type": groupType}); err != nil {
		if err == sql.ErrNoRows {
			// This AppError's details may be compared against in a call to GroupGetByRemoteID, so don't change it.
			result.Err = model.NewAppError("SqlGroupStore.GroupGetByRemoteID", "store.sql_group.no_rows", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupGetByRemoteID", "store.sql_group.select_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	result.Data = group
	return result
}

func (s *SqlSupplier) GroupGetAllByType(ctx context.Context, groupType model.GroupType, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var groups []*model.Group

	if _, err := s.GetReplica().Select(&groups, "SELECT * from Groups WHERE DeleteAt = 0 AND Type = :Type", map[string]interface{}{"Type": groupType}); err != nil {
		if err != sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupGetAllByType", "store.sql_group.select_error", nil, err.Error(), http.StatusInternalServerError)
			return result
		}
	}

	result.Data = groups

	return result
}

func (s *SqlSupplier) GroupUpdate(ctx context.Context, group *model.Group, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var retrievedGroup *model.Group
	if err := s.GetMaster().SelectOne(&retrievedGroup, "SELECT * FROM Groups WHERE Id = :Id", map[string]interface{}{"Id": group.Id}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupUpdate", "store.sql_group.no_rows", nil, "id="+group.Id+","+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupUpdate", "store.sql_group.select_error", nil, "id="+group.Id+","+err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	// If updating DeleteAt it can only be to 0
	if group.DeleteAt != retrievedGroup.DeleteAt && group.DeleteAt != 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdate", "store.sql_group.invalid_delete_at", nil, "", http.StatusInternalServerError)
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
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdate", "store.sql_group.update_error", nil, err.Error(), http.StatusInternalServerError)
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

	if !model.IsValidId(groupID) {
		result.Err = model.NewAppError("SqlGroupStore.GroupDelete", "store.sql_group.invalid_group_id", nil, "Id="+groupID, http.StatusBadRequest)
	}

	var group *model.Group
	if err := s.GetReplica().SelectOne(&group, "SELECT * from Groups WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": groupID}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupDelete", "store.sql_group.no_rows", nil, "Id="+groupID+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupDelete", "store.sql_group.select_error", nil, err.Error(), http.StatusInternalServerError)
		}

		return result
	}

	time := model.GetMillis()
	group.DeleteAt = time
	group.UpdateAt = time

	if rowsChanged, err := s.GetMaster().Update(group); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupDelete", "store.sql_group.update_error", nil, err.Error(), http.StatusInternalServerError)
	} else if rowsChanged != 1 {
		result.Err = model.NewAppError("SqlGroupStore.GroupDelete", "store.sql_group.no_rows_affected", nil, "no record to update", http.StatusInternalServerError)
	} else {
		result.Data = group
	}

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
		if err != sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupGetAllByType", "store.sql_group.select_error", nil, err.Error(), http.StatusInternalServerError)
			return result
		}
	}

	result.Data = groupMembers

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

	var retrievedMember *model.GroupMember
	if err := s.GetMaster().SelectOne(&retrievedMember, "SELECT * FROM GroupMembers WHERE GroupId = :GroupId AND UserId = :UserId", map[string]interface{}{"GroupId": member.GroupId, "UserId": member.UserId}); err != nil {
		if err != sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.sql_group.select_error", nil, "group_id="+member.GroupId+"user_id="+member.UserId+","+err.Error(), http.StatusInternalServerError)
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
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.sql_group.insert_error", nil, "group_id="+member.GroupId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
			return result
		}
	} else {
		member.DeleteAt = 0
		var rowsChanged int64
		var err error
		if rowsChanged, err = s.GetMaster().Update(member); err != nil {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.sql_group.update_error", nil, "group_id="+member.GroupId+", user_id="+member.UserId+", "+err.Error(), http.StatusInternalServerError)
			return result
		}
		if rowsChanged != 1 {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.sql_group.no_rows_changed", nil, "", http.StatusInternalServerError)
			return result
		}
	}

	retrievedMember = nil

	if err := s.GetMaster().SelectOne(&retrievedMember, "SELECT * FROM GroupMembers WHERE GroupId = :GroupId AND UserId = :UserId AND DeleteAt = 0", map[string]interface{}{"GroupId": member.GroupId, "UserId": member.UserId}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.sql_group.no_rows", nil, "group_id="+member.GroupId+"user_id="+member.UserId+","+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateOrRestoreMember", "store.sql_group.select_error", nil, "group_id="+member.GroupId+"user_id="+member.UserId+","+err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	result.Data = retrievedMember
	return result
}

func (s *SqlSupplier) GroupDeleteMember(ctx context.Context, groupID string, userID string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if !model.IsValidId(groupID) {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteMember", "store.sql_group.invalid_group_id", nil, "", http.StatusBadRequest)
		return result
	}
	if !model.IsValidId(userID) {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteMember", "store.sql_group.invalid_user_id", nil, "", http.StatusBadRequest)
		return result
	}

	var retrievedMember *model.GroupMember
	if err := s.GetMaster().SelectOne(&retrievedMember, "SELECT * FROM GroupMembers WHERE GroupId = :GroupId AND UserId = :UserId AND DeleteAt = 0", map[string]interface{}{"GroupId": groupID, "UserId": userID}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupDeleteMember", "store.sql_group.no_rows", nil, "group_id="+groupID+"user_id="+userID+","+err.Error(), http.StatusNotFound)
			return result
		}
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteMember", "store.sql_group.select_error", nil, "group_id="+groupID+"user_id="+userID+","+err.Error(), http.StatusInternalServerError)
		return result
	}

	retrievedMember.DeleteAt = model.GetMillis()

	if rowsChanged, err := s.GetMaster().Update(retrievedMember); err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteMember", "store.sql_group.update_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	} else if rowsChanged != 1 {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteMember", "store.sql_group.no_rows_affected", nil, "no record to update", http.StatusInternalServerError)
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
	case model.GSTeam:
		groupTeam := &GroupTeam{
			GroupSyncable: *groupSyncable,
			TeamId:        groupSyncable.SyncableId,
		}
		err = s.GetMaster().Insert(groupTeam)
	case model.GSChannel:
		groupChannel := &GroupChannel{
			GroupSyncable: *groupSyncable,
			ChannelId:     groupSyncable.SyncableId,
		}
		err = s.GetMaster().Insert(groupChannel)
	default:
		model.NewAppError("SqlGroupStore.GroupCreateGroupSyncable", "store.sql_group.invalid_syncable_type", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}
	if err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupCreateGroupSyncable", "store.sql_group.no_rows_affected", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId, http.StatusInternalServerError)
		}
		result.Err = model.NewAppError("SqlGroupStore.GroupCreateGroupSyncable", "store.sql_group.insert_error", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId+", "+err.Error(), http.StatusInternalServerError)
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
			result.Err = model.NewAppError("SqlGroupStore.GroupGetGroupSyncable", "store.sql_group.no_rows", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupGetGroupSyncable", "store.sql_group.select_error", nil, err.Error(), http.StatusInternalServerError)
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
	case model.GSTeam:
		result, err = s.GetMaster().Get(GroupTeam{}, groupID, syncableID)
	case model.GSChannel:
		result, err = s.GetMaster().Get(GroupChannel{}, groupID, syncableID)
	default:
	}
	if err != nil {
		return nil, err
	}

	if result == nil {
		return nil, sql.ErrNoRows
	}

	groupSyncable := model.GroupSyncable{}
	switch syncableType {
	case model.GSTeam:
		groupTeam := result.(*GroupTeam)
		groupSyncable.SyncableId = groupTeam.TeamId
		groupSyncable.GroupId = groupTeam.GroupId
		groupSyncable.CanLeave = groupTeam.CanLeave
		groupSyncable.AutoAdd = groupTeam.AutoAdd
		groupSyncable.CreateAt = groupTeam.CreateAt
		groupSyncable.DeleteAt = groupTeam.DeleteAt
		groupSyncable.UpdateAt = groupTeam.UpdateAt
		groupSyncable.Type = syncableType
	case model.GSChannel:
		groupChannel := result.(*GroupChannel)
		groupSyncable.SyncableId = groupChannel.ChannelId
		groupSyncable.GroupId = groupChannel.GroupId
		groupSyncable.CanLeave = groupChannel.CanLeave
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

func (s *SqlSupplier) GroupGetAllGroupSyncablesByGroupPage(ctx context.Context, groupID string, syncableType model.GroupSyncableType, offset int, limit int, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	sqlQuery := fmt.Sprintf("SELECT * from Group%[1]ss WHERE GroupId = :GroupId AND DeleteAt = 0 ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset", syncableType.String())

	args := map[string]interface{}{"GroupId": groupID, "Limit": limit, "Offset": offset}

	appErrF := func(msg string) *model.AppError {
		return model.NewAppError("SqlGroupStore.GroupGetAllGroupSyncablesByGroupPage", "store.sql_group.select_error", nil, msg, http.StatusInternalServerError)
	}

	groupSyncables := []*model.GroupSyncable{}

	switch syncableType {
	case model.GSTeam:
		results := []*GroupTeam{}
		_, err := s.GetMaster().Select(&results, sqlQuery, args)
		if err != nil {
			result.Err = appErrF(err.Error())
			return result
		}
		for _, result := range results {
			groupSyncable := &model.GroupSyncable{
				SyncableId: result.TeamId,
				GroupId:    result.GroupId,
				CanLeave:   result.CanLeave,
				AutoAdd:    result.AutoAdd,
				CreateAt:   result.CreateAt,
				DeleteAt:   result.DeleteAt,
				UpdateAt:   result.UpdateAt,
				Type:       syncableType,
			}
			groupSyncables = append(groupSyncables, groupSyncable)
		}
	case model.GSChannel:
		results := []*GroupChannel{}
		_, err := s.GetMaster().Select(&results, sqlQuery, args)
		if err != nil {
			result.Err = appErrF(err.Error())
			return result
		}
		for _, result := range results {
			groupSyncable := &model.GroupSyncable{
				SyncableId: result.ChannelId,
				GroupId:    result.GroupId,
				CanLeave:   result.CanLeave,
				AutoAdd:    result.AutoAdd,
				CreateAt:   result.CreateAt,
				DeleteAt:   result.DeleteAt,
				UpdateAt:   result.UpdateAt,
				Type:       syncableType,
			}
			groupSyncables = append(groupSyncables, groupSyncable)
		}
	default:
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
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "store.sql_group.select_error", nil, "GroupId="+groupSyncable.GroupId+", SyncableId="+groupSyncable.SyncableId+", SyncableType="+groupSyncable.Type.String()+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	if err := groupSyncable.IsValid(); err != nil {
		result.Err = err
		return result
	}

	// If updating DeleteAt it can only be to 0
	if groupSyncable.DeleteAt != retrievedGroupSyncable.DeleteAt && groupSyncable.DeleteAt != 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "store.sql_group.invalid_delete_at", nil, "", http.StatusInternalServerError)
		return result
	}

	// Check if no update is required
	if (retrievedGroupSyncable.AutoAdd == groupSyncable.AutoAdd) && (retrievedGroupSyncable.CanLeave == groupSyncable.CanLeave) && groupSyncable.DeleteAt != 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "store.sql_group.nothing_to_update", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId, http.StatusInternalServerError)
		return result
	}

	// Reset these properties, don't update them based on input
	groupSyncable.CreateAt = retrievedGroupSyncable.CreateAt
	groupSyncable.UpdateAt = model.GetMillis()

	var rowsAffected int64
	switch groupSyncable.Type {
	case model.GSTeam:
		rowsAffected, err = s.GetMaster().Update(&GroupTeam{
			*groupSyncable,
			groupSyncable.SyncableId,
		})
	case model.GSChannel:
		rowsAffected, err = s.GetMaster().Update(&GroupChannel{
			*groupSyncable,
			groupSyncable.SyncableId,
		})
	default:
		model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "store.sql_group.invalid_syncable_type", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "store.sql_group.update_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	if rowsAffected == 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupUpdateGroupSyncable", "store.sql_group.no_rows_affected", nil, "GroupId="+groupSyncable.GroupId+", SyncableId="+groupSyncable.SyncableId+", SyncableType="+groupSyncable.Type.String()+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = groupSyncable
	return result
}

func (s *SqlSupplier) GroupDeleteGroupSyncable(ctx context.Context, groupID string, syncableID string, syncableType model.GroupSyncableType, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if !model.IsValidId(groupID) {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.sql_group.invalid_group_id", nil, "group_id="+groupID, http.StatusBadRequest)
		return result
	}

	if !model.IsValidId(string(syncableID)) {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.sql_group.invalid_syncable_id", nil, "group_id="+groupID, http.StatusBadRequest)
		return result
	}

	groupSyncable, err := s.getGroupSyncable(groupID, syncableID, syncableType)
	if err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.sql_group.no_rows", nil, "Id="+groupID+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.sql_group.select_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return result
	}

	if groupSyncable.DeleteAt != 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.sql_group.already_deleted", nil, "group_id="+groupID+"syncable_id="+syncableID, http.StatusBadRequest)
		return result
	}

	time := model.GetMillis()
	groupSyncable.DeleteAt = time
	groupSyncable.UpdateAt = time

	var rowsAffected int64
	switch groupSyncable.Type {
	case model.GSTeam:
		groupTeam := &GroupTeam{
			GroupSyncable: *groupSyncable,
			TeamId:        groupSyncable.SyncableId,
		}
		rowsAffected, err = s.GetMaster().Update(groupTeam)
	case model.GSChannel:
		groupChannel := &GroupChannel{
			GroupSyncable: *groupSyncable,
			ChannelId:     groupSyncable.SyncableId,
		}
		rowsAffected, err = s.GetMaster().Update(groupChannel)
	default:
		model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.sql_group.invalid_syncable_type", nil, "group_id="+groupSyncable.GroupId+", syncable_id="+groupSyncable.SyncableId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.update_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	if rowsAffected == 0 {
		result.Err = model.NewAppError("SqlGroupStore.GroupDeleteGroupSyncable", "store.no_rows_affected", nil, "", http.StatusInternalServerError)
		return result
	}

	result.Data = groupSyncable

	return result
}

// PendingAutoAddTeamMembers returns a slice of [UserIds, TeamIds] tuples that need newly created
// memberships as configured by groups.
//
// Typically minGroupMembersCreateAt will be the last successful group sync time.
func (s *SqlSupplier) PendingAutoAddTeamMembers(ctx context.Context, minGroupMembersCreateAt int64, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	sql := `
		SELECT 
			GroupMembers.UserId, GroupTeams.TeamId
		FROM 
			GroupMembers
			JOIN GroupTeams 
			ON GroupTeams.GroupId = GroupMembers.GroupId
			JOIN Groups ON Groups.Id = GroupMembers.GroupId
			JOIN Teams ON Teams.Id = GroupTeams.TeamId
			FULL JOIN TeamMembers 
			ON 
				TeamMembers.TeamId = GroupTeams.TeamId 
				AND TeamMembers.UserId = GroupMembers.UserId
		WHERE 
			TeamMembers.UserId IS NULL
			AND Groups.DeleteAt = 0
			AND GroupTeams.DeleteAt = 0
			AND GroupTeams.AutoAdd = true
			AND GroupMembers.DeleteAt = 0
			AND Teams.DeleteAt = 0
			AND (GroupMembers.CreateAt >= :MinGroupMembersCreateAt
			OR GroupTeams.UpdateAt >= :MinGroupMembersCreateAt)`

	var userTeamIDs []*model.UserTeamIDPair

	_, err := s.GetMaster().Select(&userTeamIDs, sql, map[string]interface{}{"MinGroupMembersCreateAt": minGroupMembersCreateAt})
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.PendingAutoAddTeamMembers", "store.sql_group.select_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result.Data = userTeamIDs

	return result
}

// PendingAutoAddChannelMembers returns a slice [UserIds, ChannelIds] tuples that need newly created
// memberships as configured by groups.
//
// Typically minGroupMembersCreateAt will be the last successful group sync time.
func (s *SqlSupplier) PendingAutoAddChannelMembers(ctx context.Context, minGroupMembersCreateAt int64, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	sql := `
		SELECT 
			GroupMembers.UserId, GroupChannels.ChannelId
		FROM 
			GroupMembers
			JOIN GroupChannels ON GroupChannels.GroupId = GroupMembers.GroupId
			JOIN Groups ON Groups.Id = GroupMembers.GroupId
			JOIN Channels ON Channels.Id = GroupChannels.ChannelId
			FULL JOIN ChannelMemberHistory 
			ON 
				ChannelMemberHistory.ChannelId = GroupChannels.ChannelId 
				AND ChannelMemberHistory.UserId = GroupMembers.UserId
		WHERE 
			ChannelMemberHistory.UserId IS NULL
			AND ChannelMemberHistory.LeaveTime IS NULL
			AND Groups.DeleteAt = 0
			AND GroupChannels.DeleteAt = 0
			AND GroupChannels.AutoAdd = true
			AND GroupMembers.DeleteAt = 0
			AND Channels.DeleteAt = 0
			AND (GroupMembers.CreateAt >= :MinGroupMembersCreateAt
			OR GroupChannels.UpdateAt >= :MinGroupMembersCreateAt)`

	var userChannelIDs []*model.UserChannelIDPair

	_, err := s.GetMaster().Select(&userChannelIDs, sql, map[string]interface{}{"MinGroupMembersCreateAt": minGroupMembersCreateAt})
	if err != nil {
		result.Err = model.NewAppError("SqlGroupStore.PendingAutoAddChannelMembers", "store.sql_group.select_error", nil, "", http.StatusInternalServerError)
	}

	result.Data = userChannelIDs

	return result
}
