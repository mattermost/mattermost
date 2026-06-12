// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/lib/pq"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlWikiLinkStore struct {
	*SqlStore
}

func newSqlWikiLinkStore(sqlStore *SqlStore) store.WikiLinkStore {
	return &SqlWikiLinkStore{SqlStore: sqlStore}
}

func (s *SqlWikiLinkStore) prepareSaveLink(link *model.WikiLink) (string, []any, error) {
	link.PreSave()
	if vErr := link.IsValid(); vErr != nil {
		return "", nil, store.NewErrInvalidInput("WikiLink", "link", vErr.Error())
	}

	query, args, err := s.getQueryBuilder().
		Insert("WikiLinks").
		Columns("SourceId", "DestinationId", "CreateAt", "CreatorId").
		Values(link.SourceId, link.DestinationId, link.CreateAt, link.CreatorId).
		ToSql()
	if err != nil {
		return "", nil, errors.Wrap(err, "build_insert_query")
	}
	return query, args, nil
}

func (s *SqlWikiLinkStore) handleSaveLinkError(err error, link *model.WikiLink) error {
	if IsUniqueConstraintError(err, []string{"wikilinks_pkey", "PRIMARY"}) {
		return store.NewErrConflict("WikiLink", err, "source_id="+link.SourceId+",destination_id="+link.DestinationId)
	}
	return errors.Wrap(err, "failed to save WikiLink")
}

func (s *SqlWikiLinkStore) Save(link *model.WikiLink) (*model.WikiLink, error) {
	query, args, err := s.prepareSaveLink(link)
	if err != nil {
		return nil, err
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return nil, s.handleSaveLinkError(err, link)
	}

	return link, nil
}

func (s *SqlWikiLinkStore) Get(sourceId, destinationId string) (*model.WikiLink, error) {
	if !model.IsValidId(sourceId) {
		return nil, store.NewErrInvalidInput("WikiLink", "sourceId", sourceId)
	}
	if !model.IsValidId(destinationId) {
		return nil, store.NewErrInvalidInput("WikiLink", "destinationId", destinationId)
	}

	var link model.WikiLink
	builder := s.getQueryBuilder().
		Select("SourceId", "DestinationId", "CreateAt", "CreatorId").
		From("WikiLinks").
		Where(sq.Eq{
			"SourceId":      sourceId,
			"DestinationId": destinationId,
		})

	if err := s.GetMaster().GetBuilder(&link, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("WikiLink", sourceId+"/"+destinationId)
		}
		return nil, errors.Wrap(err, "failed to get WikiLink")
	}

	return &link, nil
}

// selectWikiLinksBuilder returns the base SELECT for WikiLinks rows.
// Callers add Where + Limit and pick the executor (Replica vs Master).
func (s *SqlWikiLinkStore) selectWikiLinksBuilder() sq.SelectBuilder {
	return s.getQueryBuilder().
		Select("SourceId", "DestinationId", "CreateAt", "CreatorId").
		From("WikiLinks").
		OrderBy("CreateAt ASC")
}

func (s *SqlWikiLinkStore) getBySource(sourceId string, fromMaster bool) ([]*model.WikiLink, error) {
	if !model.IsValidId(sourceId) {
		return nil, store.NewErrInvalidInput("WikiLink", "sourceId", sourceId)
	}

	// Hard cap result set at the documented maximum. Enforcement of the cap
	// on writes happens in SaveAndPropagateMembers; this Limit is only a
	// defensive bound on runaway reads.
	links := make([]*model.WikiLink, 0)
	builder := s.selectWikiLinksBuilder().
		Where(sq.Eq{"SourceId": sourceId}).
		Limit(uint64(model.MaxLinkedWikisPerChannel))

	db := s.GetReplica()
	if fromMaster {
		db = s.GetMaster()
	}
	if err := db.SelectBuilder(&links, builder); err != nil {
		return nil, errors.Wrap(err, "failed to get WikiLinks by source")
	}

	return links, nil
}

func (s *SqlWikiLinkStore) GetBySource(sourceId string) ([]*model.WikiLink, error) {
	return s.getBySource(sourceId, false)
}

// GetBySourceMaster reads from the primary DB node. Use immediately after a
// write that may not yet be visible on replicas.
func (s *SqlWikiLinkStore) GetBySourceMaster(sourceId string) ([]*model.WikiLink, error) {
	return s.getBySource(sourceId, true)
}

func (s *SqlWikiLinkStore) GetBySources(sourceIds []string) ([]*model.WikiLink, error) {
	if len(sourceIds) == 0 {
		return []*model.WikiLink{}, nil
	}

	for _, id := range sourceIds {
		if !model.IsValidId(id) {
			return nil, store.NewErrInvalidInput("WikiLink", "sourceId", id)
		}
	}

	const batchSize = 100
	links := make([]*model.WikiLink, 0)

	for i := 0; i < len(sourceIds); i += batchSize {
		end := min(i+batchSize, len(sourceIds))
		batch := sourceIds[i:end]

		builder := s.selectWikiLinksBuilder().
			Where(sq.Eq{"SourceId": batch})

		var batchLinks []*model.WikiLink
		if err := s.GetReplica().SelectBuilder(&batchLinks, builder); err != nil {
			return nil, errors.Wrap(err, "failed to get WikiLinks by sources")
		}
		links = append(links, batchLinks...)
	}

	return links, nil
}

func (s *SqlWikiLinkStore) GetByDestination(destinationId string) ([]*model.WikiLink, error) {
	if !model.IsValidId(destinationId) {
		return nil, store.NewErrInvalidInput("WikiLink", "destinationId", destinationId)
	}

	links := make([]*model.WikiLink, 0)
	builder := s.selectWikiLinksBuilder().
		Where(sq.Eq{"DestinationId": destinationId}).
		Limit(uint64(model.MaxLinkedSourcesPerDestination))

	if err := s.GetReplica().SelectBuilder(&links, builder); err != nil {
		return nil, errors.Wrap(err, "failed to get WikiLinks by destination")
	}

	return links, nil
}

// GetByWiki returns the WikiLinks pointing at the wiki identified by wikiId.
// Resolves wikiId → backing-channel-id via the Wikis table so callers do not
// need to know the storage detail that DestinationId is the backing channel.
func (s *SqlWikiLinkStore) GetByWiki(wikiId string) ([]*model.WikiLink, error) {
	if !model.IsValidId(wikiId) {
		return nil, store.NewErrInvalidInput("WikiLink", "wikiId", wikiId)
	}

	links := make([]*model.WikiLink, 0)
	builder := s.getQueryBuilder().
		Select("wl.SourceId", "wl.DestinationId", "wl.CreateAt", "wl.CreatorId").
		From("WikiLinks wl").
		Join("Wikis w ON w.ChannelId = wl.DestinationId").
		Where(sq.Eq{"w.Id": wikiId}).
		OrderBy("wl.CreateAt ASC").
		Limit(uint64(model.MaxLinkedSourcesPerDestination))

	if err := s.GetReplica().SelectBuilder(&links, builder); err != nil {
		return nil, errors.Wrap(err, "failed to get WikiLinks by wiki")
	}

	return links, nil
}

func (s *SqlWikiLinkStore) Delete(sourceId, destinationId string) error {
	if !model.IsValidId(sourceId) {
		return store.NewErrInvalidInput("WikiLink", "sourceId", sourceId)
	}
	if !model.IsValidId(destinationId) {
		return store.NewErrInvalidInput("WikiLink", "destinationId", destinationId)
	}

	builder := s.getQueryBuilder().
		Delete("WikiLinks").
		Where(sq.Eq{
			"SourceId":      sourceId,
			"DestinationId": destinationId,
		})

	result, err := s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return errors.Wrap(err, "failed to delete WikiLink")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}

	if count == 0 {
		return store.NewErrNotFound("WikiLink", sourceId+"/"+destinationId)
	}

	return nil
}

// DeleteByDestination deletes all links for a destination and removes synthetic members
// whose SourceId points to the destination channel. Callers should use this instead of
// manually deleting links to avoid leaving orphaned ChannelMembers rows.
// Both deletes run in a single transaction so a partial failure cannot leave the DB with
// link rows whose synthetic members were already removed.
func (s *SqlWikiLinkStore) DeleteByDestination(destinationId string) (err error) {
	if !model.IsValidId(destinationId) {
		return store.NewErrInvalidInput("WikiLink", "destinationId", destinationId)
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	// Delete synthetic members that were created by linking to this destination
	memberBuilder := s.getQueryBuilder().
		Delete("ChannelMembers").
		Where(sq.And{
			sq.Eq{"ChannelId": destinationId},
			sq.NotEq{"SourceId": ""},
			sq.NotEq{"SourceId": nil},
		})
	if _, err = transaction.ExecBuilder(memberBuilder); err != nil {
		return errors.Wrap(err, "failed to delete synthetic ChannelMembers for destination")
	}

	linkBuilder := s.getQueryBuilder().
		Delete("WikiLinks").
		Where(sq.Eq{"DestinationId": destinationId})
	if _, err = transaction.ExecBuilder(linkBuilder); err != nil {
		return errors.Wrap(err, "failed to delete WikiLinks by destination")
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s *SqlWikiLinkStore) SaveAndPropagateMembers(rctx request.CTX, link *model.WikiLink, sourceChannelId string, propagateAdmin bool) (_ *model.WikiLink, err error) {
	if !model.IsValidId(sourceChannelId) {
		return nil, store.NewErrInvalidInput("WikiLink", "sourceChannelId", sourceChannelId)
	}

	insertQuery, args, prepErr := s.prepareSaveLink(link)
	if prepErr != nil {
		return nil, prepErr
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	// Acquire a single PostgreSQL advisory transaction lock combining both endpoints.
	// Using the two-argument form pg_advisory_xact_lock(int4, int4) provides a 2D key space
	// separate from single-argument locks, eliminating the deadlock window that existed
	// when acquiring two sequential 1D locks. Passing keys in canonical order (min, max)
	// ensures lock identity regardless of which caller holds source vs destination.
	// hashtext() returns int4 which matches the expected parameter type.
	// The lock is automatically released when the transaction commits or rolls back.
	first, second := link.SourceId, link.DestinationId
	if first > second {
		first, second = second, first
	}
	if _, err = transaction.Exec(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, first, second); err != nil {
		return nil, errors.Wrap(err, "failed to acquire advisory lock")
	}

	// Enforce both max-links caps within the transaction in a single round-trip.
	// Raw SQL: squirrel does not support this inside an already-bound sqlx
	// transaction without losing the advisory-lock scope.
	var counts struct {
		SourceCount int `db:"source_count"`
		DestCount   int `db:"dest_count"`
	}
	const countQuery = `SELECT
		COUNT(*) FILTER (WHERE SourceId = $1) AS source_count,
		COUNT(*) FILTER (WHERE DestinationId = $2) AS dest_count
	FROM WikiLinks WHERE SourceId = $1 OR DestinationId = $2`
	if err = transaction.Get(&counts, countQuery, link.SourceId, link.DestinationId); err != nil {
		return nil, errors.Wrap(err, "failed to count existing links")
	}
	if counts.SourceCount >= model.MaxLinkedWikisPerChannel {
		err = store.NewErrInvalidInput("WikiLink", "source_link_count", "max links per source reached")
		return nil, err
	}
	if counts.DestCount >= model.MaxLinkedSourcesPerDestination {
		err = store.NewErrInvalidInput("WikiLink", "dest_link_count", "max sources per destination reached")
		return nil, err
	}

	if _, execErr := transaction.Exec(insertQuery, args...); execErr != nil {
		err = s.handleSaveLinkError(execErr, link)
		return nil, err
	}

	// Step 2: Propagate memberships from source to destination.
	// Only direct members (SourceId IS NULL or empty) are propagated to avoid
	// transitive chains where wiki A's synthetic members get propagated to wiki B.
	// Raw SQL is required here because squirrel does not support INSERT...SELECT with
	// PostgreSQL type casts ($1::varchar) needed for proper parameter type binding.
	// ON CONFLICT DO NOTHING makes the propagation idempotent: concurrent link creation
	// to the same destination wiki channel will not fail with a PK violation, and
	// existing synthetic members from other sources keep their current SourceId.
	// propagateAdmin controls whether source channel admins become wiki channel admins.
	// Callers should pass false unless there is an explicit reason to propagate admin status,
	// as admin privileges on the source channel do NOT transitively grant admin on linked
	// wiki channels by default — that would be a privilege escalation path.
	now := model.GetMillis()
	propagateQuery := `
		INSERT INTO ChannelMembers (ChannelId, UserId, Roles, LastViewedAt, MsgCount, MentionCount,
			MentionCountRoot, MsgCountRoot, NotifyProps, LastUpdateAt, SchemeUser, SchemeAdmin, SchemeGuest,
			UrgentMentionCount, AutoTranslationDisabled, SourceId)
		SELECT $1::varchar, cm.UserId, 'channel_user', 0, 0, 0, 0, 0, cm.NotifyProps,
			$2::bigint, CASE WHEN cm.SchemeGuest THEN false ELSE true END, $4::bool AND cm.SchemeAdmin, cm.SchemeGuest, 0, cm.AutoTranslationDisabled, $3::varchar
		FROM ChannelMembers cm
		WHERE cm.ChannelId = $3::varchar
		AND (cm.SourceId IS NULL OR cm.SourceId = '')
		ON CONFLICT (ChannelId, UserId) DO NOTHING
	`

	if _, err = transaction.Exec(propagateQuery, link.DestinationId, now, sourceChannelId, propagateAdmin); err != nil {
		return nil, errors.Wrap(err, "failed to propagate synthetic members")
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return link, nil
}

func (s *SqlWikiLinkStore) DeleteAndCleanupMembers(rctx request.CTX, sourceId, destinationId string) (err error) {
	if !model.IsValidId(sourceId) {
		return store.NewErrInvalidInput("WikiLink", "sourceId", sourceId)
	}
	if !model.IsValidId(destinationId) {
		return store.NewErrInvalidInput("WikiLink", "destinationId", destinationId)
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	// Step 0: Lock all link records for this destination to serialize concurrent unlinks.
	// This prevents TOCTOU races where two concurrent unlinks pick each other as alternative
	// sources and leave orphaned synthetic ChannelMembers rows.
	// NOWAIT surfaces the lock contention immediately as an error instead of blocking
	// indefinitely — callers can retry rather than queue behind a long-running transaction.
	// Raw SQL: see comment in SaveAndPropagateMembers for justification.
	lockQuery := `SELECT SourceId FROM WikiLinks WHERE DestinationId = $1 FOR UPDATE NOWAIT`
	if _, err = transaction.Exec(lockQuery, destinationId); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "55P03" {
			return store.NewErrConflict("WikiLink", err, "lock not available")
		}
		return errors.Wrap(err, "failed to lock channel member links for destination")
	}

	// Step 1: Update synthetic members that have an alternative source.
	// COALESCE guards against the scalar subquery returning NULL if no alternative source
	// exists at UPDATE time (e.g. concurrent unlink removed it between the EXISTS check
	// and the subquery evaluation), preventing a NULL write to SourceId.
	// Raw SQL is required here because squirrel does not support correlated UPDATE with
	// a scalar subquery containing ORDER BY/LIMIT, which is needed to reassign SourceId
	// to an alternative source atomically.
	updateQuery := `
		UPDATE ChannelMembers SET SourceId = COALESCE((
			SELECT cml.SourceId FROM WikiLinks cml
			JOIN ChannelMembers cm2 ON cm2.ChannelId = cml.SourceId AND cm2.UserId = ChannelMembers.UserId
			WHERE cml.DestinationId = $1
			AND cml.SourceId != $2
			AND (cm2.SourceId IS NULL OR cm2.SourceId = '')
			ORDER BY cml.CreateAt ASC
			LIMIT 1
		), SourceId)
		WHERE ChannelId = $1 AND SourceId = $2
		AND EXISTS (
			SELECT 1 FROM WikiLinks cml
			JOIN ChannelMembers cm2 ON cm2.ChannelId = cml.SourceId AND cm2.UserId = ChannelMembers.UserId
			WHERE cml.DestinationId = $1 AND cml.SourceId != $2
			AND (cm2.SourceId IS NULL OR cm2.SourceId = '')
		)
	`
	if _, err = transaction.Exec(updateQuery, destinationId, sourceId); err != nil {
		return errors.Wrap(err, "failed to update synthetic members with alternative source")
	}

	// Step 2: Delete remaining synthetic members with no other source
	deleteMemQuery := `
		DELETE FROM ChannelMembers
		WHERE ChannelId = $1 AND SourceId = $2
	`
	if _, err = transaction.Exec(deleteMemQuery, destinationId, sourceId); err != nil {
		return errors.Wrap(err, "failed to delete synthetic members")
	}

	// Step 3: Delete the link record
	deleteLinkQuery, args, qErr := s.getQueryBuilder().
		Delete("WikiLinks").
		Where(sq.Eq{
			"SourceId":      sourceId,
			"DestinationId": destinationId,
		}).
		ToSql()
	if qErr != nil {
		return errors.Wrap(qErr, "build_delete_query")
	}

	result, err := transaction.Exec(deleteLinkQuery, args...)
	if err != nil {
		return errors.Wrap(err, "failed to delete WikiLink")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}
	if count == 0 {
		err = store.NewErrNotFound("WikiLink", sourceId+"/"+destinationId)
		return err
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}
