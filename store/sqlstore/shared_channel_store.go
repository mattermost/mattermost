// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

const (
	DefaultGetUsersForSyncLimit = 100
)

type SqlSharedChannelStore struct {
	*SqlStore
}

func newSqlSharedChannelStore(sqlStore *SqlStore) store.SharedChannelStore {
	return &SqlSharedChannelStore{
		SqlStore: sqlStore,
	}
}

// Save inserts a new shared channel record.
func (s SqlSharedChannelStore) Save(sc *model.SharedChannel) (sh *model.SharedChannel, err error) {
	sc.PreSave()
	if err := sc.IsValid(); err != nil {
		return nil, err
	}

	// make sure the shared channel is associated with a real channel.
	channel, err := s.stores.channel.Get(sc.ChannelId, true)
	if err != nil {
		return nil, fmt.Errorf("invalid channel: %w", err)
	}

	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	query, args, err := s.getQueryBuilder().Insert("SharedChannels").
		Columns("ChannelId", "TeamId", "Home", "ReadOnly", "ShareName", "ShareDisplayName", "SharePurpose", "ShareHeader", "CreatorId", "CreateAt", "UpdateAt", "RemoteId").
		Values(sc.ChannelId, sc.TeamId, sc.Home, sc.ReadOnly, sc.ShareName, sc.ShareDisplayName, sc.SharePurpose, sc.ShareHeader, sc.CreatorId, sc.CreateAt, sc.UpdateAt, sc.RemoteId).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "savesharedchannel_tosql")
	}
	if _, err := transaction.Exec(query, args...); err != nil {
		return nil, errors.Wrapf(err, "save_shared_channel: ChannelId=%s", sc.ChannelId)
	}

	// set `Shared` flag in Channels table if needed
	if channel.Shared == nil || !*channel.Shared {
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

	if err := s.GetReplicaX().Get(&sc, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannel", channelId)
		}
		return nil, errors.Wrapf(err, "failed to find shared channel with ChannelId=%s", channelId)
	}
	return &sc, nil
}

// HasChannel returns whether a given channelID is a shared channel or not.
func (s SqlSharedChannelStore) HasChannel(channelID string) (bool, error) {
	builder := s.getQueryBuilder().
		Select("1").
		Prefix("SELECT EXISTS (").
		From("SharedChannels").
		Where(sq.Eq{"SharedChannels.ChannelId": channelID}).
		Suffix(")")

	query, args, err := builder.ToSql()
	if err != nil {
		return false, errors.Wrapf(err, "get_shared_channel_exists_tosql")
	}

	var exists bool
	if err := s.GetReplicaX().Get(&exists, query, args...); err != nil {
		return exists, errors.Wrapf(err, "failed to get shared channel for channel_id=%s", channelID)
	}
	return exists, nil
}

// GetAll fetches a paginated list of shared channels filtered by SharedChannelSearchOpts.
func (s SqlSharedChannelStore) GetAll(offset, limit int, opts model.SharedChannelFilterOpts) ([]*model.SharedChannel, error) {
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

	channels := []*model.SharedChannel{}
	err = s.GetReplicaX().Select(&channels, squery, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get shared channels")
	}
	return channels, nil
}

// GetAllCount returns the number of shared channels that would be fetched using SharedChannelSearchOpts.
func (s SqlSharedChannelStore) GetAllCount(opts model.SharedChannelFilterOpts) (int64, error) {
	if opts.ExcludeHome && opts.ExcludeRemote {
		return 0, errors.New("cannot exclude home and remote shared channels")
	}

	query := s.getSharedChannelsQuery(opts, true)
	squery, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "failed to create query")
	}

	var count int64
	err = s.GetReplicaX().Get(&count, squery, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count channels")
	}
	return count, nil
}

func (s SqlSharedChannelStore) getSharedChannelsQuery(opts model.SharedChannelFilterOpts, forCount bool) sq.SelectBuilder {
	var selectStr string
	if forCount {
		selectStr = "count(sc.ChannelId)"
	} else {
		selectStr = "sc.*"
	}

	query := s.getQueryBuilder().
		Select(selectStr).
		From("SharedChannels AS sc")

	if opts.MemberId != "" {
		query = query.Join("ChannelMembers AS cm ON cm.ChannelId = sc.ChannelId").
			Where(sq.Eq{"cm.UserId": opts.MemberId})
	}

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

	query, args, err := s.getQueryBuilder().Update("SharedChannels").Set("ChannelId", sc.ChannelId).
		Set("TeamId", sc.TeamId).
		Set("Home", sc.Home).
		Set("ReadOnly", sc.ReadOnly).
		Set("ShareName", sc.ShareName).
		Set("ShareDisplayName", sc.ShareDisplayName).
		Set("SharePurpose", sc.SharePurpose).
		Set("ShareHeader", sc.ShareHeader).
		Set("CreatorId", sc.CreatorId).
		Set("CreateAt", sc.CreateAt).
		Set("UpdateAt", sc.UpdateAt).
		Set("RemoteId", sc.RemoteId).
		Where(sq.Eq{"ChannelId": sc.ChannelId}).ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "updatesharedchannel_tosql")
	}
	res, err := s.GetMasterX().Exec(query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update shared channel with channelId=%s", sc.ChannelId)
	}
	count, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rows_affected")
	}
	if count != 1 {
		return nil, fmt.Errorf("expected number of shared channels to be updated is 1 but was %d", count)
	}
	return sc, nil
}

// Delete deletes a single shared channel plus associated SharedChannelRemotes.
// Returns true if shared channel found and deleted, false if not found.
func (s SqlSharedChannelStore) Delete(channelId string) (ok bool, err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return false, errors.Wrap(err, "DeleteSharedChannel: begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

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

	query, args, err := s.getQueryBuilder().Insert("SharedChannelRemotes").
		Columns("Id", "ChannelId", "CreatorId", "CreateAt", "UpdateAt", "IsInviteAccepted", "IsInviteConfirmed", "RemoteId", "LastPostUpdateAt", "LastPostId").
		Values(remote.Id, remote.ChannelId, remote.CreatorId, remote.CreateAt, remote.UpdateAt, remote.IsInviteAccepted, remote.IsInviteConfirmed, remote.RemoteId, remote.LastPostUpdateAt, remote.LastPostId).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "savesharedchannelremote_tosql")
	}

	if _, err := s.GetMasterX().Exec(query, args...); err != nil {
		return nil, errors.Wrapf(err, "save_shared_channel_remote: channel_id=%s, id=%s", remote.ChannelId, remote.Id)
	}
	return remote, nil
}

// Update updates the shared channel remote.
func (s SqlSharedChannelStore) UpdateRemote(remote *model.SharedChannelRemote) (*model.SharedChannelRemote, error) {
	if err := remote.IsValid(); err != nil {
		return nil, err
	}

	query, args, err := s.getQueryBuilder().Update("SharedChannelRemotes").
		Set("CreatorId", remote.CreatorId).
		Set("CreateAt", remote.CreateAt).
		Set("UpdateAt", remote.UpdateAt).
		Set("IsInviteAccepted", remote.IsInviteAccepted).
		Set("IsInviteConfirmed", remote.IsInviteConfirmed).
		Set("RemoteId", remote.RemoteId).
		Set("LastPostUpdateAt", remote.LastPostUpdateAt).
		Set("LastPostId", remote.LastPostId).
		Where(sq.And{
			sq.Eq{"Id": remote.Id},
			sq.Eq{"ChannelId": remote.ChannelId},
		}).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "updatesharedchannelremote_tosql")
	}

	res, err := s.GetMasterX().Exec(query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update shared channel remote with remoteId=%s", remote.Id)
	}

	count, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rows_affected")
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

	if err := s.GetReplicaX().Get(&remote, squery, args...); err != nil {
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
		Where(sq.Eq{"SharedChannelRemotes.RemoteId": remoteId})

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "get_shared_channel_remote_by_ids_tosql")
	}

	if err := s.GetReplicaX().Get(&remote, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelRemote", fmt.Sprintf("channelId=%s, remoteId=%s", channelId, remoteId))
		}
		return nil, errors.Wrapf(err, "failed to find shared channel remote with channelId=%s, remoteId=%s", channelId, remoteId)
	}
	return &remote, nil
}

// GetRemotes fetches all shared channel remotes associated with channel_id.
func (s SqlSharedChannelStore) GetRemotes(opts model.SharedChannelRemoteFilterOpts) ([]*model.SharedChannelRemote, error) {
	remotes := []*model.SharedChannelRemote{}

	query := s.getQueryBuilder().
		Select("*").
		From("SharedChannelRemotes")

	if opts.ChannelId != "" {
		query = query.Where(sq.Eq{"ChannelId": opts.ChannelId})
	}

	if opts.RemoteId != "" {
		query = query.Where(sq.Eq{"RemoteId": opts.RemoteId})
	}

	if !opts.InclUnconfirmed {
		query = query.Where(sq.Eq{"IsInviteConfirmed": true})
	}

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "get_shared_channel_remotes_tosql")
	}

	if err := s.GetReplicaX().Select(&remotes, squery, args...); err != nil {
		if err != sql.ErrNoRows {
			return nil, errors.Wrapf(err, "failed to get shared channel remotes for channel_id=%s; remote_id=%s",
				opts.ChannelId, opts.RemoteId)
		}
	}
	return remotes, nil
}

// HasRemote returns whether a given remoteId and channelId are present in the shared channel remotes or not.
func (s SqlSharedChannelStore) HasRemote(channelID string, remoteId string) (bool, error) {
	builder := s.getQueryBuilder().
		Select("1").
		Prefix("SELECT EXISTS (").
		From("SharedChannelRemotes").
		Where(sq.Eq{"RemoteId": remoteId}).
		Where(sq.Eq{"ChannelId": channelID}).
		Suffix(")")

	query, args, err := builder.ToSql()
	if err != nil {
		return false, errors.Wrapf(err, "get_shared_channel_hasremote_tosql")
	}

	var hasRemote bool
	if err := s.GetReplicaX().Get(&hasRemote, query, args...); err != nil {
		return hasRemote, errors.Wrapf(err, "failed to get channel remotes for channel_id=%s", channelID)
	}
	return hasRemote, nil
}

// GetRemoteForUser returns a remote cluster for the given userId only if the user belongs to at least one channel
// shared with the remote.
func (s SqlSharedChannelStore) GetRemoteForUser(remoteId string, userId string) (*model.RemoteCluster, error) {
	builder := s.getQueryBuilder().
		Select("rc.*").
		From("RemoteClusters AS rc").
		Join("SharedChannelRemotes AS scr ON rc.RemoteId = scr.RemoteId").
		Join("ChannelMembers AS cm ON scr.ChannelId = cm.ChannelId").
		Where(sq.Eq{"rc.RemoteId": remoteId}).
		Where(sq.Eq{"cm.UserId": userId})

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "get_remote_for_user_tosql")
	}

	var rc model.RemoteCluster
	if err := s.GetReplicaX().Get(&rc, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("RemoteCluster", remoteId)
		}
		return nil, errors.Wrapf(err, "failed to get remote for user_id=%s", userId)
	}
	return &rc, nil
}

// UpdateRemoteCursor updates the LastPostUpdateAt timestamp and LastPostId for the specified SharedChannelRemote.
func (s SqlSharedChannelStore) UpdateRemoteCursor(id string, cursor model.GetPostsSinceForSyncCursor) error {
	squery, args, err := s.getQueryBuilder().
		Update("SharedChannelRemotes").
		Set("LastPostUpdateAt", cursor.LastPostUpdateAt).
		Set("LastPostId", cursor.LastPostId).
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "update_shared_channel_remote_cursor_tosql")
	}

	result, err := s.GetMasterX().Exec(squery, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update cursor for SharedChannelRemote")
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

	result, err := s.GetMasterX().Exec(squery, args...)
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
	status := []*model.SharedChannelRemoteStatus{}

	query := s.getQueryBuilder().
		Select("scr.ChannelId, rc.DisplayName, rc.SiteURL, rc.LastPingAt, sc.ReadOnly, scr.IsInviteAccepted").
		From("SharedChannelRemotes scr, RemoteClusters rc, SharedChannels sc").
		Where("scr.RemoteId = rc.RemoteId").
		Where("scr.ChannelId = sc.ChannelId").
		Where(sq.Eq{"scr.ChannelId": channelId})

	squery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "get_shared_channel_remotes_status_tosql")
	}

	if err := s.GetReplicaX().Select(&status, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelRemoteStatus", channelId)
		}
		return nil, errors.Wrapf(err, "failed to get shared channel remote status for channel_id=%s", channelId)
	}
	return status, nil
}

// SaveUser inserts a new shared channel user record to the SharedChannelUsers table.
func (s SqlSharedChannelStore) SaveUser(scUser *model.SharedChannelUser) (*model.SharedChannelUser, error) {
	scUser.PreSave()
	if err := scUser.IsValid(); err != nil {
		return nil, err
	}

	query, args, err := s.getQueryBuilder().Insert("SharedChannelUsers").
		Columns("Id", "UserId", "ChannelId", "RemoteId", "CreateAt", "LastSyncAt").
		Values(scUser.Id, scUser.UserId, scUser.ChannelId, scUser.RemoteId, scUser.CreateAt, scUser.LastSyncAt).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "savesharedchanneluser_tosql")
	}
	if _, err := s.GetMasterX().Exec(query, args...); err != nil {
		return nil, errors.Wrapf(err, "save_shared_channel_user: user_id=%s, remote_id=%s", scUser.UserId, scUser.RemoteId)
	}
	return scUser, nil
}

// GetSingleUser fetches a shared channel user based on userID, channelID and remoteID.
func (s SqlSharedChannelStore) GetSingleUser(userID string, channelID string, remoteID string) (*model.SharedChannelUser, error) {
	var scu model.SharedChannelUser

	squery, args, err := s.getQueryBuilder().
		Select("*").
		From("SharedChannelUsers").
		Where(sq.Eq{"SharedChannelUsers.UserId": userID}).
		Where(sq.Eq{"SharedChannelUsers.RemoteId": remoteID}).
		Where(sq.Eq{"SharedChannelUsers.ChannelId": channelID}).
		ToSql()

	if err != nil {
		return nil, errors.Wrapf(err, "getsharedchannelsingleuser_tosql")
	}

	if err := s.GetReplicaX().Get(&scu, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelUser", userID)
		}
		return nil, errors.Wrapf(err, "failed to find shared channel user with UserId=%s, ChannelId=%s, RemoteId=%s", userID, channelID, remoteID)
	}
	return &scu, nil
}

// GetUsersForUser fetches all shared channel user records based on userID.
func (s SqlSharedChannelStore) GetUsersForUser(userID string) ([]*model.SharedChannelUser, error) {
	squery, args, err := s.getQueryBuilder().
		Select("*").
		From("SharedChannelUsers").
		Where(sq.Eq{"SharedChannelUsers.UserId": userID}).
		ToSql()

	if err != nil {
		return nil, errors.Wrapf(err, "getsharedchanneluser_tosql")
	}

	users := []*model.SharedChannelUser{}
	if err := s.GetReplicaX().Select(&users, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return make([]*model.SharedChannelUser, 0), nil
		}
		return nil, errors.Wrapf(err, "failed to find shared channel user with UserId=%s", userID)
	}
	return users, nil
}

// GetUsersForSync fetches all shared channel users that need to be synchronized, meaning their
// `SharedChannelUsers.LastSyncAt` is less than or equal to `User.UpdateAt`.
func (s SqlSharedChannelStore) GetUsersForSync(filter model.GetUsersForSyncFilter) ([]*model.User, error) {
	if filter.Limit <= 0 {
		filter.Limit = DefaultGetUsersForSyncLimit
	}

	query := s.getQueryBuilder().
		Select("u.*").
		Distinct().
		From("Users AS u").
		Join("SharedChannelUsers AS scu ON u.Id = scu.UserId").
		OrderBy("u.Id").
		Limit(filter.Limit)

	if filter.CheckProfileImage {
		query = query.Where("scu.LastSyncAt < u.LastPictureUpdate")
	} else {
		query = query.Where("scu.LastSyncAt < u.UpdateAt")
	}

	if filter.ChannelID != "" {
		query = query.Where(sq.Eq{"scu.ChannelId": filter.ChannelID})
	}

	sqlQuery, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "getsharedchannelusersforsync_tosql")
	}

	users := []*model.User{}
	if err := s.GetReplicaX().Select(&users, sqlQuery, args...); err != nil {
		if err == sql.ErrNoRows {
			return make([]*model.User, 0), nil
		}
		return nil, errors.Wrapf(err, "failed to fetch shared channel users with ChannelId=%s",
			filter.ChannelID)
	}
	return users, nil
}

// UpdateUserLastSyncAt updates the LastSyncAt timestamp for the specified SharedChannelUser.
func (s SqlSharedChannelStore) UpdateUserLastSyncAt(userID string, channelID string, remoteID string) error {
	var query string
	if s.DriverName() == model.DatabaseDriverPostgres {
		query = `
		UPDATE
			SharedChannelUsers AS scu
		SET
			LastSyncAt = GREATEST(Users.UpdateAt, Users.LastPictureUpdate)
		FROM
			Users
		WHERE
			Users.Id = scu.UserId AND scu.UserId = ? AND scu.ChannelId = ? AND scu.RemoteId = ?
		`
	} else if s.DriverName() == model.DatabaseDriverMysql {
		query = `
		UPDATE
			SharedChannelUsers AS scu
		INNER JOIN
			Users ON scu.UserId = Users.Id
		SET
			LastSyncAt = GREATEST(Users.UpdateAt, Users.LastPictureUpdate)
		WHERE
			scu.UserId = ? AND scu.ChannelId = ? AND scu.RemoteId = ?
		`
	} else {
		return errors.New("unsupported DB driver " + s.DriverName())
	}

	result, err := s.GetMasterX().Exec(query, userID, channelID, remoteID)
	if err != nil {
		return fmt.Errorf("failed to update LastSyncAt for SharedChannelUser with userId=%s, channelId=%s, remoteId=%s: %w",
			userID, channelID, remoteID, err)
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to determine rows affected")
	}
	if count == 0 {
		return fmt.Errorf("SharedChannelUser not found: userId=%s, channelId=%s, remoteId=%s", userID, channelID, remoteID)
	}
	return nil
}

// SaveAttachment inserts a new shared channel file attachment record to the SharedChannelFiles table.
func (s SqlSharedChannelStore) SaveAttachment(attachment *model.SharedChannelAttachment) (*model.SharedChannelAttachment, error) {
	attachment.PreSave()
	if err := attachment.IsValid(); err != nil {
		return nil, err
	}

	query, args, err := s.getQueryBuilder().Insert("SharedChannelAttachments").
		Columns("Id", "FileId", "RemoteId", "CreateAt", "LastSyncAt").
		Values(attachment.Id, attachment.FileId, attachment.RemoteId, attachment.CreateAt, attachment.LastSyncAt).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "savesahredchannelattachment_tosql")
	}

	if _, err := s.GetMasterX().Exec(query, args...); err != nil {
		return nil, errors.Wrapf(err, "save_shared_channel_attachment: file_id=%s, remote_id=%s", attachment.FileId, attachment.RemoteId)
	}
	return attachment, nil
}

// UpsertAttachment inserts a new shared channel file attachment record to the SharedChannelFiles table or updates its
// LastSyncAt.
func (s SqlSharedChannelStore) UpsertAttachment(attachment *model.SharedChannelAttachment) (string, error) {
	attachment.PreSave()
	if err := attachment.IsValid(); err != nil {
		return "", err
	}
	query := s.getQueryBuilder().
		Insert("SharedChannelAttachments").
		Columns("Id", "FileId", "RemoteId", "CreateAt", "LastSyncAt").
		Values(attachment.Id, attachment.FileId, attachment.RemoteId, attachment.CreateAt, attachment.LastSyncAt)

	if s.DriverName() == model.DatabaseDriverMysql {
		query = query.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE LastSyncAt = ?", attachment.LastSyncAt))
	} else if s.DriverName() == model.DatabaseDriverPostgres {
		query = query.SuffixExpr(sq.Expr("ON CONFLICT (id) DO UPDATE SET LastSyncAt = ?", attachment.LastSyncAt))
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "upsertsharedchannelattachment_tosql")
	}
	if _, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		return "", errors.Wrap(err, "failed to upsert SharedChannelAttachments")
	}
	return attachment.Id, nil
}

// GetAttachment fetches a shared channel file attachment record based on file_id and remoteId.
func (s SqlSharedChannelStore) GetAttachment(fileId string, remoteId string) (*model.SharedChannelAttachment, error) {
	var attachment model.SharedChannelAttachment

	squery, args, err := s.getQueryBuilder().
		Select("*").
		From("SharedChannelAttachments").
		Where(sq.Eq{"SharedChannelAttachments.FileId": fileId}).
		Where(sq.Eq{"SharedChannelAttachments.RemoteId": remoteId}).
		ToSql()

	if err != nil {
		return nil, errors.Wrapf(err, "getsharedchannelattachment_tosql")
	}

	if err := s.GetReplicaX().Get(&attachment, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelAttachment", fileId)
		}
		return nil, errors.Wrapf(err, "failed to find shared channel attachment with FileId=%s, RemoteId=%s", fileId, remoteId)
	}
	return &attachment, nil
}

// UpdateAttachmentLastSyncAt updates the LastSyncAt timestamp for the specified SharedChannelAttachment.
func (s SqlSharedChannelStore) UpdateAttachmentLastSyncAt(id string, syncTime int64) error {
	squery, args, err := s.getQueryBuilder().
		Update("SharedChannelAttachments").
		Set("LastSyncAt", syncTime).
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "update_shared_channel_attachment_last_sync_at_tosql")
	}

	result, err := s.GetMasterX().Exec(squery, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update LastSyncAt for SharedChannelAttachment")
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
