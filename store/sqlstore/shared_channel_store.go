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
		tableSharedChannels.ColMap("RemoteId").SetMaxSize(26)

		tableSharedChannelRemotes := db.AddTableWithName(model.SharedChannelRemote{}, "SharedChannelRemotes").SetKeys(false, "Id", "ChannelId")
		tableSharedChannelRemotes.ColMap("Id").SetMaxSize(26)
		tableSharedChannelRemotes.ColMap("ChannelId").SetMaxSize(26)
		tableSharedChannelRemotes.ColMap("Description").SetMaxSize(64)
		tableSharedChannelRemotes.ColMap("CreatorId").SetMaxSize(26)
		tableSharedChannelRemotes.ColMap("RemoteId").SetMaxSize(26)
		tableSharedChannelRemotes.SetUniqueTogether("ChannelId", "RemoteId")

		tableSharedChannelUsers := db.AddTableWithName(model.SharedChannelUser{}, "SharedChannelUsers").SetKeys(false, "Id")
		tableSharedChannelUsers.ColMap("Id").SetMaxSize(26)
		tableSharedChannelUsers.ColMap("UserId").SetMaxSize(26)
		tableSharedChannelUsers.ColMap("RemoteId").SetMaxSize(26)
		tableSharedChannelUsers.ColMap("ChannelId").SetMaxSize(26)
		tableSharedChannelUsers.SetUniqueTogether("UserId", "ChannelId", "RemoteId")

		tableSharedChannelFiles := db.AddTableWithName(model.SharedChannelAttachment{}, "SharedChannelAttachments").SetKeys(false, "Id")
		tableSharedChannelFiles.ColMap("Id").SetMaxSize(26)
		tableSharedChannelFiles.ColMap("FileId").SetMaxSize(26)
		tableSharedChannelFiles.ColMap("RemoteId").SetMaxSize(26)
		tableSharedChannelFiles.SetUniqueTogether("FileId", "RemoteId")
	}

	return s
}

func (s SqlSharedChannelStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_sharedchannelusers_user_id", "SharedChannelUsers", "UserId")
	s.CreateIndexIfNotExists("idx_sharedchannelusers_remote_id", "SharedChannelUsers", "RemoteId")
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

	if err := s.GetReplica().SelectOne(&sc, squery, args...); err != nil {
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
	if err := s.GetReplica().SelectOne(&exists, query, args...); err != nil {
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

	var channels []*model.SharedChannel
	_, err = s.GetReplica().Select(&channels, squery, args...)
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

	count, err := s.GetReplica().SelectInt(squery, args...)
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
		Where(sq.Eq{"SharedChannelRemotes.RemoteId": remoteId})

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
func (s SqlSharedChannelStore) GetRemotes(opts model.SharedChannelRemoteFilterOpts) ([]*model.SharedChannelRemote, error) {
	var remotes []*model.SharedChannelRemote

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

	if _, err := s.GetReplica().Select(&remotes, squery, args...); err != nil {
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
	if err := s.GetReplica().SelectOne(&hasRemote, query, args...); err != nil {
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
	if err := s.GetReplica().SelectOne(&rc, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("RemoteCluster", remoteId)
		}
		return nil, errors.Wrapf(err, "failed to get remote for user_id=%s", userId)
	}
	return &rc, nil
}

// UpdateRemoteNextSyncAt updates the NextSyncAt timestamp for the specified SharedChannelRemote.
func (s SqlSharedChannelStore) UpdateRemoteNextSyncAt(id string, syncTime int64) error {
	squery, args, err := s.getQueryBuilder().
		Update("SharedChannelRemotes").
		Set("NextSyncAt", syncTime).
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "update_shared_channel_remote_next_sync_at_tosql")
	}

	result, err := s.GetMaster().Exec(squery, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update NextSyncAt for SharedChannelRemote")
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
		Select("scr.ChannelId, rc.DisplayName, rc.SiteURL, rc.LastPingAt, scr.NextSyncAt, scr.Description, sc.ReadOnly, scr.IsInviteAccepted").
		From("SharedChannelRemotes scr, RemoteClusters rc, SharedChannels sc").
		Where("scr.RemoteId = rc.RemoteId").
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

// SaveUser inserts a new shared channel user record to the SharedChannelUsers table.
func (s SqlSharedChannelStore) SaveUser(scUser *model.SharedChannelUser) (*model.SharedChannelUser, error) {
	scUser.PreSave()
	if err := scUser.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(scUser); err != nil {
		return nil, errors.Wrapf(err, "save_shared_channel_user: user_id=%s, remote_id=%s", scUser.UserId, scUser.RemoteId)
	}
	return scUser, nil
}

// GetUser fetches a shared channel user based on user_id and remoteId.
func (s SqlSharedChannelStore) GetUser(userID string, channelID string, remoteID string) (*model.SharedChannelUser, error) {
	var scu model.SharedChannelUser

	squery, args, err := s.getQueryBuilder().
		Select("*").
		From("SharedChannelUsers").
		Where(sq.Eq{"SharedChannelUsers.UserId": userID}).
		Where(sq.Eq{"SharedChannelUsers.RemoteId": remoteID}).
		Where(sq.Eq{"SharedChannelUsers.ChannelId": channelID}).
		ToSql()

	if err != nil {
		return nil, errors.Wrapf(err, "getsharedchanneluser_tosql")
	}

	if err := s.GetReplica().SelectOne(&scu, squery, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("SharedChannelUser", userID)
		}
		return nil, errors.Wrapf(err, "failed to find shared channel user with UserId=%s, ChannelId=%s, RemoteId=%s", userID, channelID, remoteID)
	}
	return &scu, nil
}

// UpdateUserLastSyncAt updates the LastSyncAt timestamp for the specified SharedChannelUser.
func (s SqlSharedChannelStore) UpdateUserLastSyncAt(id string, syncTime int64) error {
	squery, args, err := s.getQueryBuilder().
		Update("SharedChannelUsers").
		Set("LastSyncAt", syncTime).
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "update_shared_channel_user_last_sync_at_tosql")
	}

	result, err := s.GetMaster().Exec(squery, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update LastSycnAt for SharedChannelUser")
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

// SaveAttachment inserts a new shared channel file attachment record to the SharedChannelFiles table.
func (s SqlSharedChannelStore) SaveAttachment(attachment *model.SharedChannelAttachment) (*model.SharedChannelAttachment, error) {
	attachment.PreSave()
	if err := attachment.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(attachment); err != nil {
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

	params := map[string]interface{}{
		"Id":         attachment.Id,
		"FileId":     attachment.FileId,
		"RemoteId":   attachment.RemoteId,
		"CreateAt":   attachment.CreateAt,
		"LastSyncAt": attachment.LastSyncAt,
	}

	if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		if _, err := s.GetMaster().Exec(
			`INSERT INTO
				SharedChannelAttachments
				(Id, FileId, RemoteId, CreateAt, LastSyncAt)
			VALUES
				(:Id, :FileId, :RemoteId, :CreateAt, :LastSyncAt)
			ON DUPLICATE KEY UPDATE
				LastSyncAt = :LastSyncAt`, params); err != nil {
			return "", err
		}
	} else if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		if _, err := s.GetMaster().Exec(
			`INSERT INTO
				SharedChannelAttachments
				(Id, FileId, RemoteId, CreateAt, LastSyncAt)
			VALUES
				(:Id, :FileId, :RemoteId, :CreateAt, :LastSyncAt)
			ON CONFLICT (Id) 
				DO UPDATE SET LastSyncAt = :LastSyncAt`, params); err != nil {
			return "", err
		}
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

	if err := s.GetReplica().SelectOne(&attachment, squery, args...); err != nil {
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

	result, err := s.GetMaster().Exec(squery, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update LastSycnAt for SharedChannelAttachment")
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
