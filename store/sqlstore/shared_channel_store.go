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

type SqlSharedChannelStore struct {
	*SqlStore
}

func newSqlSharedChannelStore(sqlStore *SqlStore) store.SharedChannelStore {
	s := &SqlSharedChannelStore{
		SqlStore: sqlStore,
	}

	for _, db := range sqlStore.GetAllConns() {
		tableSharedChannels := db.AddTableWithName(model.SharedChannel{}, "SharedChannels").SetKeys(false, "ChannelId")
		tableSharedChannels.ColMap("ChannelId").SetMaxSize(26)
		tableSharedChannels.ColMap("TeamId").SetMaxSize(26)
		tableSharedChannels.ColMap("CreatorId").SetMaxSize(26)
		tableSharedChannels.ColMap("ShareName").SetMaxSize(64)
		tableSharedChannels.SetUniqueTogether("ShareName", "TeamId")
		tableSharedChannels.ColMap("ShareDisplayName").SetMaxSize(64)
		tableSharedChannels.ColMap("SharePurpose").SetMaxSize(250)
		tableSharedChannels.ColMap("ShareHeader").SetMaxSize(1024)
		tableSharedChannels.ColMap("RemoteClusterId").SetMaxSize(26)

		tableSharedChannelRemotes := db.AddTableWithName(model.SharedChannelRemote{}, "SharedChannelRemotes").SetKeys(false, "Id", "ChannelId")
		tableSharedChannelRemotes.ColMap("Id").SetMaxSize(26)
		tableSharedChannelRemotes.ColMap("ChannelId").SetMaxSize(26)
		tableSharedChannelRemotes.ColMap("Description").SetMaxSize(64)
		tableSharedChannelRemotes.ColMap("CreatorId").SetMaxSize(26)
		tableSharedChannelRemotes.ColMap("RemoteClusterId").SetMaxSize(26)
		tableSharedChannelRemotes.SetUniqueTogether("ChannelId", "RemoteClusterId")
	}

	return s
}

func (s SqlSharedChannelStore) createIndexesIfNotExists() {
	// none for now
}

// Save inserts a new shared channel record.
func (s SqlSharedChannelStore) Save(sc *model.SharedChannel) (*model.SharedChannel, error) {
	sc.PreSave()
	if err := sc.IsValid(); err != nil {
		return nil, err
	}

	// make sure the shared channel is associated with a real channel.
	channel, err := s.stores.channel.Get(sc.ChannelId, true)
	if err != nil {
		return nil, fmt.Errorf("invalid channel: %w", err)
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransaction(transaction)

	if err := transaction.Insert(sc); err != nil {
		return nil, errors.Wrapf(err, "save_shared_channel: ChannelId=%s", sc.ChannelId)
	}

	// set `Shared` flag in Channels table if needed
	if channel.Shared == nil || *channel.Shared == false {
		if err := s.stores.channel.SetShared(channel.Id, true); err != nil {
			return nil, err
		}
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}
	return sc, nil
}

// Get fetches a shared channel by channel_id.
func (s SqlSharedChannelStore) Get(channelId string) (*model.SharedChannel, error) {
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

// GetAll fetches a paginated list of shared channels filtered by SharedChannelSearchOpts.
func (s SqlSharedChannelStore) GetAll(offset, limit int, opts store.SharedChannelFilterOpts) ([]*model.SharedChannel, error) {
	if opts.ExcludeHome && opts.ExcludeRemote {
		return nil, errors.New("cannot exclude home and remote shared channels")
	}

	safeConv := func(offset, limit int) (uint64, uint64, error) {
		if offset < 0 {
			return 0, 0, errors.New("offset must be positive integer")
		}
		if limit < 0 {
			return 0, 0, errors.New("limit must be positive integer")
		}
		return uint64(offset), uint64(limit), nil
	}

	safeOffset, safeLimit, err := safeConv(offset, limit)
	if err != nil {
		return nil, err
	}

	query := s.getSharedChannelsQuery(opts, false)
	query = query.OrderBy("sc.ShareDisplayName, sc.ShareName").Limit(safeLimit).Offset(safeOffset)

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

// GetAllCount returns the number of shared channels that would be fetched using SharedChannelSearchOpts.
func (s SqlSharedChannelStore) GetAllCount(opts store.SharedChannelFilterOpts) (int64, error) {
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

func (s SqlSharedChannelStore) getSharedChannelsQuery(opts store.SharedChannelFilterOpts, forCount bool) sq.SelectBuilder {
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

	if opts.CreatorId != "" {
		query = query.Where(sq.Eq{"sc.CreatorId": opts.CreatorId})
	}

	if opts.ExcludeHome {
		query = query.Where(sq.NotEq{"sc.Home": true})
	}

	if opts.ExcludeRemote {
		query = query.Where(sq.Eq{"sc.Home": true})
	}

	return query
}

// Update updates the shared channel.
func (s SqlSharedChannelStore) Update(sc *model.SharedChannel) (*model.SharedChannel, error) {
	if err := sc.IsValid(); err != nil {
		return nil, err
	}

	count, err := s.GetMaster().Update(sc)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update shared channel with channelId=%s", sc.ChannelId)
	}

	if count != 1 {
		return nil, fmt.Errorf("expected number of shared channels to be updated is 1 but was %d", count)
	}
	return sc, nil
}

// Delete deletes a single shared channel plus associated SharedChannelRemotes.
// Returns true if shared channel found and deleted, false if not found.
func (s SqlSharedChannelStore) Delete(channelId string) (bool, error) {
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

	count, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to determine rows affected")
	}

	if count > 0 {
		// unset the channel's Shared flag
		if err = s.Channel().SetShared(channelId, false); err != nil {
			return false, errors.Wrap(err, "error unsetting channel share flag")
		}
	}

	if err = transaction.Commit(); err != nil {
		return false, errors.Wrap(err, "commit_transaction")
	}

	return count > 0, nil
}

// SaveRemote inserts a new shared channel remote record.
func (s SqlSharedChannelStore) SaveRemote(remote *model.SharedChannelRemote) (*model.SharedChannelRemote, error) {
	remote.PreSave()
	if err := remote.IsValid(); err != nil {
		return nil, err
	}

	// make sure the shared channel remote is associated with a real channel.
	if _, err := s.stores.channel.Get(remote.ChannelId, true); err != nil {
		return nil, fmt.Errorf("invalid channel: %w", err)
	}

	if err := s.GetMaster().Insert(remote); err != nil {
		return nil, errors.Wrapf(err, "save_shared_channel_remote: channel_id=%s, id=%s", remote.ChannelId, remote.Id)
	}
	return remote, nil
}

// Update updates the shared channel remote.
func (s SqlSharedChannelStore) UpdateRemote(remote *model.SharedChannelRemote) (*model.SharedChannelRemote, error) {
	if err := remote.IsValid(); err != nil {
		return nil, err
	}

	count, err := s.GetMaster().Update(remote)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update shared channel remote with remoteId=%s", remote.Id)
	}

	if count != 1 {
		return nil, fmt.Errorf("expected number of shared channel remotes to be updated is 1 but was %d", count)
	}
	return remote, nil
}

// GetRemote fetches a shared channel remote by id.
func (s SqlSharedChannelStore) GetRemote(id string) (*model.SharedChannelRemote, error) {
	var remote model.SharedChannelRemote

	query := s.getQueryBuilder().
		Select("*").
		From("SharedChannelRemotes").
		Where(sq.Eq{"SharedChannelRemotes.Id": id})

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "get_shared_channel_remote_tosql")
	}

	if err := s.GetReplica().SelectOne(&remote, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelRemote", id)
		}
		return nil, errors.Wrapf(err, "failed to find shared channel remote with id=%s", id)
	}
	return &remote, nil
}

// GetRemoteByIds fetches a shared channel remote by channel id and remote cluster id.
func (s SqlSharedChannelStore) GetRemoteByIds(channelId string, remoteId string) (*model.SharedChannelRemote, error) {
	var remote model.SharedChannelRemote

	query := s.getQueryBuilder().
		Select("*").
		From("SharedChannelRemotes").
		Where(sq.Eq{"SharedChannelRemotes.ChannelId": channelId}).
		Where(sq.Eq{"SharedChannelRemotes.RemoteClusterId": remoteId})

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "get_shared_channel_remote_by_ids_tosql")
	}

	if err := s.GetReplica().SelectOne(&remote, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelRemote", fmt.Sprintf("channelId=%s, remoteId=%s", channelId, remoteId))
		}
		return nil, errors.Wrapf(err, "failed to find shared channel remote with channelId=%s, remoteId=%s", channelId, remoteId)
	}
	return &remote, nil
}

// GetRemotes fetches all shared channel remotes associated with channel_id.
func (s SqlSharedChannelStore) GetRemotes(channelId string) ([]*model.SharedChannelRemote, error) {
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
		return nil, errors.Wrapf(err, "failed to get shared channel remotes for channel_id=%s", channelId)
	}
	return remotes, nil
}

// UpdateRemoteLastSyncAt updates the LastSyncAt timestamp for the specified SharedChannelRemote.
func (s SqlSharedChannelStore) UpdateRemoteLastSyncAt(id string, syncTime int64) error {
	squery, args, err := s.getQueryBuilder().
		Update("SharedChannelRemotes").
		Set("LastSyncAt", syncTime).
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "update_shared_channel_remote_last_sync_at_tosql")
	}

	result, err := s.GetMaster().Exec(squery, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update LastSycnAt for SharedChannelRemote")
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

// DeleteRemote deletes a single shared channel remote.
// Returns true if remote found and deleted, false if not found.
func (s SqlSharedChannelStore) DeleteRemote(id string) (bool, error) {
	squery, args, err := s.getQueryBuilder().
		Delete("SharedChannelRemotes").
		Where(sq.Eq{"Id": id}).
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

// GetRemotesStatus returns the status for each remote invited to the
// specified shared channel.
func (s SqlSharedChannelStore) GetRemotesStatus(channelId string) ([]*model.SharedChannelRemoteStatus, error) {
	var status []*model.SharedChannelRemoteStatus

	query := s.getQueryBuilder().
		Select("scr.ChannelId, rc.DisplayName, rc.SiteURL, rc.LastPingAt, scr.LastSyncAt, scr.Description, sc.ReadOnly, scr.IsInviteAccepted").
		From("SharedChannelRemotes scr, RemoteClusters rc, SharedChannels sc").
		Where("scr.RemoteClusterId=rc.RemoteId").
		Where("scr.ChannelId = sc.ChannelId").
		Where(sq.Eq{"scr.ChannelId": channelId})

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "get_shared_channel_remotes_status_tosql")
	}

	if _, err := s.GetReplica().Select(&status, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelRemoteStatus", channelId)
		}
		return nil, errors.Wrapf(err, "failed to get shared channel remote status for channel_id=%s", channelId)
	}
	return status, nil
}

// UpsertPost saves a Post exactly as is. This should only be used when synchronizing Posts between databases since
// all PreSave and other functionality is bypassed.
func (s SqlSharedChannelStore) UpsertPost(post *model.Post) error {
	count, err := s.GetMaster().Update(post)
	if err != nil {
		return errors.Wrapf(err, "update_shared_channel_post: channel_id=%s, id=%s", post.ChannelId, post.Id)
	}

	if count > 0 {
		return nil
	}

	if err := s.GetMaster().Insert(post); err != nil {
		return errors.Wrapf(err, "insert_shared_channel_post: channel_id=%s, id=%s", post.ChannelId, post.Id)
	}
	return nil
}

// UpsertReaction saves a Reaction exactly as is. This should only be used when synchronizing Reactions between
// databases since all PreSave and other functionality is bypassed.
func (s SqlSharedChannelStore) UpsertReaction(reaction *model.Reaction) error {
	count, err := s.GetMaster().Update(reaction)
	if err != nil {
		return errors.Wrapf(err, "update_shared_channel_reaction: post_id=%s, user_id=%s", reaction.PostId, reaction.UserId)
	}

	if count > 0 {
		return nil
	}

	if err := s.GetMaster().Insert(reaction); err != nil {
		return errors.Wrapf(err, "insert_shared_channel_reaction: post_id=%s, user_id=%s", reaction.PostId, reaction.UserId)
	}
	return nil
}
