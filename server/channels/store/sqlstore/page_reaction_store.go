// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPageReactionStore struct {
	*SqlStore
}

func newSqlPageReactionStore(sqlStore *SqlStore) store.PageReactionStore {
	return &SqlPageReactionStore{SqlStore: sqlStore}
}

// Save upserts a PageReaction. Duplicate (PageId, UserId, EmojiName) tuples are
// idempotent: the existing row is updated with the supplied values and returned.
func (s *SqlPageReactionStore) Save(reaction *model.PageReaction) (*model.PageReaction, error) {
	reaction.PreSave()
	if err := reaction.IsValid(); err != nil {
		return nil, store.NewErrInvalidInput("PageReaction", "reaction", err.Error())
	}

	query, args, err := s.getQueryBuilder().
		Insert("PageReactions").
		Columns("PageId", "UserId", "EmojiName", "CreateAt", "ChannelId", "RemoteId").
		Values(reaction.PageId, reaction.UserId, reaction.EmojiName, reaction.CreateAt, reaction.ChannelId, reaction.RemoteId).
		Suffix("ON CONFLICT (PageId, UserId, EmojiName) DO UPDATE SET CreateAt = EXCLUDED.CreateAt, ChannelId = EXCLUDED.ChannelId, RemoteId = EXCLUDED.RemoteId").
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "build_upsert_query")
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to save PageReaction")
	}

	return reaction, nil
}

// Delete removes the PageReaction identified by (PageId, UserId, EmojiName).
func (s *SqlPageReactionStore) Delete(reaction *model.PageReaction) error {
	builder := s.getQueryBuilder().
		Delete("PageReactions").
		Where(sq.Eq{
			"PageId":    reaction.PageId,
			"UserId":    reaction.UserId,
			"EmojiName": reaction.EmojiName,
		})

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "failed to delete PageReaction")
	}

	return nil
}

// GetForPage returns all reactions for the given page.
func (s *SqlPageReactionStore) GetForPage(pageId string) ([]*model.PageReaction, error) {
	if !model.IsValidId(pageId) {
		return nil, store.NewErrInvalidInput("PageReaction", "pageId", pageId)
	}

	reactions := make([]*model.PageReaction, 0)
	builder := s.getQueryBuilder().
		Select("PageId", "UserId", "EmojiName", "CreateAt", "ChannelId", "RemoteId").
		From("PageReactions").
		Where(sq.Eq{"PageId": pageId})

	if err := s.GetReplica().SelectBuilder(&reactions, builder); err != nil {
		return nil, errors.Wrap(err, "failed to get PageReactions for page")
	}

	return reactions, nil
}

// PermanentDeleteByUser deletes all PageReactions for the given user.
func (s *SqlPageReactionStore) PermanentDeleteByUser(userId string) error {
	builder := s.getQueryBuilder().
		Delete("PageReactions").
		Where(sq.Eq{"UserId": userId})

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "failed to permanently delete PageReactions by user")
	}

	return nil
}

// DeleteByPageIds deletes all PageReactions for the given page IDs. No-op on empty slice.
func (s *SqlPageReactionStore) DeleteByPageIds(pageIds []string) error {
	if len(pageIds) == 0 {
		return nil
	}

	builder := s.getQueryBuilder().
		Delete("PageReactions").
		Where(sq.Eq{"PageId": pageIds})

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrap(err, "failed to delete PageReactions by page ids")
	}

	return nil
}
