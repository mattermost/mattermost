// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (s SqlChannelStore) GetLinksForSource(rctx request.CTX, sourceID string) ([]*model.ChannelLink, error) {
	query := s.getQueryBuilder().
		Select("sourceid", "sourcetype", "destinationid", "createat").
		From("ChannelMemberLinks").
		Where(sq.Eq{"sourceid": sourceID})

	var links []*model.ChannelLink
	if err := s.GetReplica().SelectBuilder(&links, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get links for source %s", sourceID)
	}

	return links, nil
}

func (s SqlChannelStore) GetLinksForDestination(rctx request.CTX, destinationID, sourceType string) ([]*model.ChannelLink, error) {
	query := s.getQueryBuilder().
		Select("sourceid", "sourcetype", "destinationid", "createat").
		From("ChannelMemberLinks").
		Where(sq.Eq{"destinationid": destinationID})

	if sourceType != "" {
		query = query.Where(sq.Eq{"sourcetype": sourceType})
	}

	var links []*model.ChannelLink
	if err := s.GetReplica().SelectBuilder(&links, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get links for destination %s", destinationID)
	}

	return links, nil
}

func (s SqlChannelStore) CreateChannelLink(rctx request.CTX, link *model.ChannelLink) (_ *model.ChannelLink, err error) {
	// Set defaults
	link.PreSave()

	// Validate link
	if err := link.IsValid(); err != nil {
		return nil, err
	}

	// Begin tx
	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(tx, &err)

	// Validate no cycles: sourceID cannot be a destination in another link
	countQuery := s.getQueryBuilder().
		Select("COUNT(*)").
		From("ChannelMemberLinks").
		Where(sq.Eq{"destinationid": link.SourceID})

	var count int64
	if err = tx.GetBuilder(&count, countQuery); err != nil {
		return nil, errors.Wrap(err, "failed to check if source is destination")
	}
	if count > 0 {
		return nil, store.NewErrInvalidInput("ChannelLink", "SourceID",
			"source channel is already a destination of another link")
	}

	// Validate no cycles: destinationID cannot be a source in another link
	countQuery = s.getQueryBuilder().
		Select("COUNT(*)").
		From("ChannelMemberLinks").
		Where(sq.Eq{"sourceid": link.DestinationID})

	if err = tx.GetBuilder(&count, countQuery); err != nil {
		return nil, errors.Wrap(err, "failed to check if destination is source")
	}
	if count > 0 {
		return nil, store.NewErrInvalidInput("ChannelLink", "DestinationID",
			"destination channel is already a source of another link")
	}

	// Insert link record
	insert := s.getQueryBuilder().
		Insert("ChannelMemberLinks").
		Columns("sourceid", "sourcetype", "destinationid", "createat").
		Values(link.SourceID, link.SourceType, link.DestinationID, link.CreateAt)

	if _, err = tx.ExecBuilder(insert); err != nil {
		return nil, errors.Wrap(err, "failed to insert channel link")
	}

	// Propagate members: batch insert synthetic members for all direct members of source
	propagateQuery := `
		INSERT INTO ChannelMembers (
			ChannelId, UserId, SourceID,
			Roles, SchemeUser, SchemeAdmin, SchemeGuest,
			LastViewedAt, MsgCount, MentionCount, MentionCountRoot,
			MsgCountRoot, NotifyProps, LastUpdateAt, UrgentMentionCount
		)
		SELECT
			$1::varchar as ChannelId,
			cm.UserId,
			$2::varchar as SourceID,
			'' as Roles,
			true as SchemeUser,
			false as SchemeAdmin,
			false as SchemeGuest,
			0, 0, 0, 0, 0, '{}'::jsonb, $3::bigint, 0
		FROM ChannelMembers cm
		WHERE cm.ChannelId = $4::varchar
			AND cm.SourceID = ''
			AND NOT EXISTS (
				SELECT 1 FROM ChannelMembers existing
				WHERE existing.ChannelId = $1::varchar AND existing.UserId = cm.UserId
			)`

	joinTime := model.GetMillis()
	_, err = tx.Exec(propagateQuery,
		link.DestinationID, link.SourceID, joinTime, link.SourceID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to propagate members")
	}

	// Log join events for all synthetic members that were just created
	getSyntheticMembersQuery := s.getQueryBuilder().
		Select("UserId").
		From("ChannelMembers").
		Where(sq.Eq{"ChannelId": link.DestinationID, "SourceID": link.SourceID})

	var userIds []string
	if err = tx.SelectBuilder(&userIds, getSyntheticMembersQuery); err != nil {
		return nil, errors.Wrap(err, "failed to get synthetic members for join events")
	}

	// Log join event for each synthetic member
	historyStore := s.SqlStore.ChannelMemberHistory().(*SqlChannelMemberHistoryStore)
	for _, userId := range userIds {
		if err = historyStore.logJoinEventT(tx, userId, link.DestinationID, joinTime); err != nil {
			return nil, errors.Wrapf(err, "failed to log join event for user %s", userId)
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return link, nil
}

// propagateMemberToLinkedChannelsT propagates a direct membership to all linked destination channels
func (s SqlChannelStore) propagateMemberToLinkedChannelsT(tx *sqlxTxWrapper, member *model.ChannelMember) error {
	// Only propagate direct memberships
	if member.IsSynthetic() {
		return nil
	}

	// Get all links where this channel is the source
	query := s.getQueryBuilder().
		Select("sourceid", "sourcetype", "destinationid", "createat").
		From("ChannelMemberLinks").
		Where(sq.Eq{"sourceid": member.ChannelId})

	var links []*model.ChannelLink
	if err := tx.SelectBuilder(&links, query); err != nil {
		return errors.Wrap(err, "failed to get links for source")
	}

	// No links, nothing to propagate
	if len(links) == 0 {
		return nil
	}

	// For each destination, create synthetic membership
	joinTime := model.GetMillis()

	for _, link := range links {
		// Check if user already has membership in destination (direct > synthetic)
		countQuery := s.getQueryBuilder().
			Select("COUNT(*)").
			From("ChannelMembers").
			Where(sq.Eq{"ChannelId": link.DestinationID, "UserId": member.UserId})

		var count int64
		if err := tx.GetBuilder(&count, countQuery); err != nil {
			return errors.Wrapf(err, "failed to check existing membership in %s", link.DestinationID)
		}

		if count > 0 {
			continue // Skip, existing membership wins
		}

		// Create synthetic member
		syntheticInsert := s.getQueryBuilder().
			Insert("ChannelMembers").
			Columns("ChannelId", "UserId", "SourceID",
				"Roles", "SchemeUser", "SchemeAdmin", "SchemeGuest",
				"LastViewedAt", "MsgCount", "MentionCount", "MentionCountRoot",
				"MsgCountRoot", "NotifyProps", "LastUpdateAt", "UrgentMentionCount").
			Values(link.DestinationID, member.UserId, member.ChannelId,
				"", true, false, false,
				0, 0, 0, 0, 0, "{}", joinTime, 0)

		if _, err := tx.ExecBuilder(syntheticInsert); err != nil {
			return errors.Wrapf(err, "failed to create synthetic membership in %s", link.DestinationID)
		}

		// Log join event for the synthetic member
		historyStore := s.SqlStore.ChannelMemberHistory().(*SqlChannelMemberHistoryStore)
		if err := historyStore.logJoinEventT(tx, member.UserId, link.DestinationID, joinTime); err != nil {
			return errors.Wrapf(err, "failed to log join event for user %s in channel %s", member.UserId, link.DestinationID)
		}
	}

	return nil
}

func (s SqlChannelStore) DeleteChannelLink(rctx request.CTX, sourceID, destinationID string) (err error) {
	// Begin transaction
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	// Get all synthetic members that will be deleted (for leave event logging)
	getSyntheticQuery := s.getQueryBuilder().
		Select("UserId").
		From("ChannelMembers").
		Where(sq.Eq{"ChannelId": destinationID, "SourceID": sourceID})

	var userIds []string
	if err = transaction.SelectBuilder(&userIds, getSyntheticQuery); err != nil {
		return errors.Wrap(err, "failed to get synthetic members for leave events")
	}

	// Log leave events before deletion
	leaveTime := model.GetMillis()
	historyStore := s.SqlStore.ChannelMemberHistory().(*SqlChannelMemberHistoryStore)
	for _, userId := range userIds {
		if err = historyStore.logLeaveEventT(transaction, userId, destinationID, leaveTime); err != nil {
			return errors.Wrapf(err, "failed to log leave event for user %s in channel %s", userId, destinationID)
		}
	}

	// Delete thread memberships for all synthetic members
	threadStore := s.SqlStore.Thread().(*SqlThreadStore)
	for _, userId := range userIds {
		if err = threadStore.deleteMembershipsForChannelT(transaction, userId, destinationID); err != nil {
			return errors.Wrapf(err, "failed to delete thread memberships for user %s in channel %s", userId, destinationID)
		}
	}

	// Delete synthetic memberships created by this link
	deleteMembersQuery := s.getQueryBuilder().
		Delete("ChannelMembers").
		Where(sq.Eq{"ChannelId": destinationID, "SourceID": sourceID})

	if _, err = transaction.ExecBuilder(deleteMembersQuery); err != nil {
		return errors.Wrap(err, "failed to delete synthetic memberships")
	}

	// Delete the link record
	deleteLinkQuery := s.getQueryBuilder().
		Delete("ChannelMemberLinks").
		Where(sq.Eq{"sourceid": sourceID, "destinationid": destinationID})

	if _, err = transaction.ExecBuilder(deleteLinkQuery); err != nil {
		return errors.Wrap(err, "failed to delete channel link")
	}

	// Commit transaction
	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}
