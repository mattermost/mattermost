// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

// UpdateRemoteLastSyncAt updates the LastMembersSyncAt timestamp for the specified SharedChannelRemote.
func (s SqlSharedChannelStore) UpdateRemoteLastSyncAt(id string, syncTime int64) error {
	squery, args, err := s.getQueryBuilder().
		Update("SharedChannelRemotes").
		Set("LastMembersSyncAt", syncTime).
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "update_shared_channel_remote_last_members_sync_at_tosql")
	}

	result, err := s.GetMaster().Exec(squery, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update LastMembersSyncAt for SharedChannelRemote")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to determine rows affected")
	}
	if count == 0 {
		return fmt.Errorf("id not found: %s", id)
	}
	return nil
}

// GetUserChanges gets all SharedChannelUser changes for a given user, channel after a specific time.
// This is used to detect if there are conflicting membership changes.
func (s SqlSharedChannelStore) GetUserChanges(userID string, channelID string, afterTime int64) ([]*model.SharedChannelUser, error) {
	squery, args, err := s.getQueryBuilder().
		Select(sharedChannelUserFields("")...).
		From("SharedChannelUsers").
		Where(sq.Eq{"SharedChannelUsers.UserId": userID}).
		Where(sq.Eq{"SharedChannelUsers.ChannelId": channelID}).
		Where(sq.Gt{"SharedChannelUsers.LastSyncAt": afterTime}).
		ToSql()

	if err != nil {
		return nil, errors.Wrapf(err, "getsharedchanneluserchanges_tosql")
	}

	users := []*model.SharedChannelUser{}
	if err := s.GetReplica().Select(&users, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return make([]*model.SharedChannelUser, 0), nil
		}
		return nil, errors.Wrapf(err, "failed to find shared channel user changes with UserId=%s, ChannelId=%s, afterTime=%d",
			userID, channelID, afterTime)
	}
	return users, nil
}

// UserHasRemote checks if a user is associated with a particular remote in any shared channel.
func (s SqlSharedChannelStore) UserHasRemote(userID string, remoteID string) (bool, error) {
	builder := s.getQueryBuilder().
		Select("1").
		Prefix("SELECT EXISTS (").
		From("SharedChannelUsers").
		Where(sq.Eq{"UserId": userID}).
		Where(sq.Eq{"RemoteId": remoteID}).
		Suffix(")")

	query, args, err := builder.ToSql()
	if err != nil {
		return false, errors.Wrapf(err, "get_shared_channel_user_has_remote_tosql")
	}

	var exists bool
	if err := s.GetReplica().Get(&exists, query, args...); err != nil {
		return false, errors.Wrapf(err, "failed to check if user has remote for user_id=%s, remote_id=%s", userID, remoteID)
	}
	return exists, nil
}
