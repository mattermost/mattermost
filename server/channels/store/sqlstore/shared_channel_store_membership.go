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

// UpdateRemoteMembershipCursor updates the LastMembersSyncAt timestamp for the specified SharedChannelRemote,
// but only if the new timestamp is greater than the current value.
func (s SqlSharedChannelStore) UpdateRemoteMembershipCursor(id string, syncTime int64) error {
	query := s.getQueryBuilder().
		Update("SharedChannelRemotes")

	query = query.Set("LastMembersSyncAt", sq.Expr("GREATEST(LastMembersSyncAt, ?)", syncTime))

	query = query.Where(sq.Eq{"Id": id})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrap(err, "failed to update membership cursor for SharedChannelRemote")
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
