// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"
)

// SaveSharedChannel inserts a new shared channel record.
func (s SqlChannelStore) SaveSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	sc.PreSave()
	if err := sc.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(sc); err != nil {
		return nil, errors.Wrapf(err, "save_shared_channel: id=%s", sc.ChannelId)
	}
	return sc, nil
}

// GetSharedChannel fetches a shared channel by channel_id.
func (s SqlChannelStore) GetSharedChannel(channelId string) (*model.SharedChannel, error) {
	var sc model.SharedChannel

	query := s.getQueryBuilder().
		Select("*").
		From("SharedChannels").
		Where(sq.Eq{"SharedChannels.ChannelId": channelId})

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "getsharedchannel_tosql")
	}

	if err := s.GetReplica().SelectOne(&sc, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannel", channelId)
		}
		return nil, errors.Wrapf(err, "failed to find channel with ChannelId=%s", channelId)
	}
	return &sc, nil
}

// GetSharedChannels fetches a paginated list of shared channels filtered by SharedChannelSearchOpts.
func (s SqlChannelStore) GetSharedChannels(offset, limit int, opts store.SharedChannelFilterOpts) ([]*model.SharedChannel, error) {
	if opts.ExcludeHome && opts.ExcludeRemote {
		return nil, errors.New("cannot exclude home and remote shared channels")
	}

	query := s.getSharedChannelsQuery(opts, false)
	query = query.OrderBy("sc.ShareDisplayName, sc.ShareName").Limit(uint64(limit)).Offset(uint64(offset))

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to create query")
	}

	var channels []*model.SharedChannel
	_, err = s.GetReplica().Select(&channels, squery, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get channels")
	}
	return channels, nil
}

// GetSharedChannelsCount returns the number of shared channels that would be fetched using SharedChannelSearchOpts.
func (s SqlChannelStore) GetSharedChannelsCount(opts store.SharedChannelFilterOpts) (int64, error) {
	if opts.ExcludeHome && opts.ExcludeRemote {
		return 0, errors.New("cannot exclude home and remote shared channels")
	}

	query := s.getSharedChannelsQuery(opts, true)
	squery, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "failed to create query")
	}

	count, err := s.GetReplica().SelectInt(squery, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count channels")
	}
	return count, nil
}

func (s SqlChannelStore) getSharedChannelsQuery(opts store.SharedChannelFilterOpts, forCount bool) sq.SelectBuilder {
	var selectStr string
	if forCount {
		selectStr = "count(sc.ChannelId)"
	} else {
		selectStr = "sc.*"
	}

	query := s.getQueryBuilder().
		Select(selectStr).
		From("SharedChannels AS sc")

	if opts.TeamId != "" {
		query = query.Where(sq.Eq{"sc.TeamId": opts.TeamId})
	}

	if opts.Token != "" {
		query = query.Where(sq.Eq{"sc.Token": opts.Token})
	}

	if !opts.ExcludeHome && !opts.ExcludeRemote {
		return query
	}

	if opts.ExcludeHome {
		query = query.Where(sq.NotEq{"sc.Home": true})
	}

	if opts.ExcludeRemote {
		query = query.Where(sq.Eq{"sc.Home": true})
	}

	return query
}

// UpdateSharedChannel updates the shared channel.
func (s SqlChannelStore) UpdateSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	if err := sc.IsValid(); err != nil {
		return nil, err
	}

	count, err := s.GetMaster().Update(sc)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update shared channel with id=%s", sc.ChannelId)
	}

	if count != 1 {
		return nil, fmt.Errorf("expected number of shared channels to be updated is 1 but was %d", count)
	}
	return sc, nil
}

// DeleteSharedChannel deletes a single shared channel plus associated SharedChannelRemotes.
// Returns true if shared channel found and deleted, false if not found.
func (s SqlChannelStore) DeleteSharedChannel(channelId string) (bool, error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return false, errors.Wrap(err, "DeleteSharedChannel: begin_transaction")
	}
	defer finalizeTransaction(transaction)

	squery, args, err := s.getQueryBuilder().
		Delete("SharedChannels").
		Where(sq.Eq{"SharedChannels.ChannelId": channelId}).
		ToSql()
	if err != nil {
		return false, errors.Wrap(err, "delete_shared_channel_tosql")
	}

	result, err := transaction.Exec(squery, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to delete SharedChannel")
	}

	// Also remove remotes from SharedChannelRemotes (if any).
	squery, args, err = s.getQueryBuilder().
		Delete("SharedChannelRemotes").
		Where(sq.Eq{"ChannelId": channelId}).
		ToSql()
	if err != nil {
		return false, errors.Wrap(err, "delete_shared_channel_remotes_tosql")
	}

	_, err = transaction.Exec(squery, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to delete SharedChannelRemotes")
	}

	if err = transaction.Commit(); err != nil {
		return false, errors.Wrap(err, "commit_transaction")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to determine rows affected")
	}

	return count > 0, nil
}

// SaveSharedChannelRemote inserts a new shared channel remote record.
func (s SqlChannelStore) SaveSharedChannelRemote(remote *model.SharedChannelRemote) (*model.SharedChannelRemote, error) {
	remote.PreSave()
	if err := remote.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(remote); err != nil {
		return nil, errors.Wrapf(err, "save_shared_channel_remote: channel_id=%s, id=%s", remote.ChannelId, remote.Id)
	}
	return remote, nil
}

// GetSharedChannelRemote fetches a shared channel by shared_channel_remote_id.
func (s SqlChannelStore) GetSharedChannelRemote(remoteId string) (*model.SharedChannelRemote, error) {
	var remote model.SharedChannelRemote

	query := s.getQueryBuilder().
		Select("*").
		From("SharedChannelRemotes").
		Where(sq.Eq{"SharedChannelRemotes.Id": remoteId})

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "get_shared_channel_remote_tosql")
	}

	if err := s.GetReplica().SelectOne(&remote, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelRemote", remoteId)
		}
		return nil, errors.Wrapf(err, "failed to find remote with id=%s", remoteId)
	}
	return &remote, nil
}

// GetSharedChannelRemotes fetches all shared channel remotes associated with channel_id.
func (s SqlChannelStore) GetSharedChannelRemotes(channelId string) ([]*model.SharedChannelRemote, error) {
	var remotes []*model.SharedChannelRemote

	query := s.getQueryBuilder().
		Select("*").
		From("SharedChannelRemotes").
		Where(sq.Eq{"SharedChannelRemotes.ChannelId": channelId})

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "get_shared_channel_remotes_tosql")
	}

	if _, err := s.GetReplica().Select(&remotes, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelRemote", channelId)
		}
		return nil, errors.Wrapf(err, "failed to get remotes for channel_id=%s", channelId)
	}
	return remotes, nil
}

// DeleteSharedChannelRemote deletes a single shared channel remote.
// Returns true if remote found and deleted, false if not found.
func (s SqlChannelStore) DeleteSharedChannelRemote(remoteId string) (bool, error) {
	squery, args, err := s.getQueryBuilder().
		Delete("SharedChannelRemotes").
		Where(sq.Eq{"Id": remoteId}).
		ToSql()
	if err != nil {
		return false, errors.Wrap(err, "delete_shared_channel_remote_tosql")
	}

	result, err := s.GetMaster().Exec(squery, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to delete SharedChannelRemote")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to determine rows affected")
	}

	return count > 0, nil
}
