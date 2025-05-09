// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

// GetMembersAfterTimestamp returns channel members created after a given timestamp,
// used for cursor-based pagination during membership sync.
func (s SqlChannelStore) GetMembersAfterTimestamp(channelID string, timestamp int64, limit int) (model.ChannelMembers, error) {
	members := model.ChannelMembers{}

	query := s.getQueryBuilder().
		Select("ChannelMembers.*").
		From("ChannelMembers").
		Where(sq.Eq{"ChannelId": channelID}).
		Where(sq.Gt{"CreateAt": timestamp}).
		OrderBy("CreateAt").
		Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_get_members_after_timestamp_tosql")
	}

	if err := s.GetReplica().Select(&members, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return model.ChannelMembers{}, nil
		}
		return nil, errors.Wrapf(err, "failed to get channel members after timestamp for channelId=%s", channelID)
	}

	return members, nil
}