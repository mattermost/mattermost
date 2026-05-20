// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	sq "github.com/mattermost/squirrel"
)

type SqlEmojiStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface

	emojiSelectQuery sq.SelectBuilder
}

func newSqlEmojiStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.EmojiStore {
	emojiSelectQuery := sqlStore.getQueryBuilder().
		Select("Id", "CreateAt", "UpdateAt", "DeleteAt", "CreatorId", "Name").
		From("Emoji").
		Where(sq.Eq{"DeleteAt": 0})

	return &SqlEmojiStore{
		SqlStore:         sqlStore,
		metrics:          metrics,
		emojiSelectQuery: emojiSelectQuery,
	}
}

func (es SqlEmojiStore) Save(emoji *model.Emoji) (*model.Emoji, error) {
	emoji.PreSave()
	if err := emoji.IsValid(); err != nil {
		return nil, err
	}

	if _, err := es.GetMaster().NamedExec(`INSERT INTO Emoji
		(Id, CreateAt, UpdateAt, DeleteAt, CreatorId, Name)
		VALUES
		(:Id, :CreateAt, :UpdateAt, :DeleteAt, :CreatorId, :Name)`, emoji); err != nil {
		return nil, errors.Wrap(err, "error saving emoji")
	}

	return emoji, nil
}

func (es SqlEmojiStore) Get(rctx request.CTX, id string, allowFromCache bool) (*model.Emoji, error) {
	return es.getBy(rctx, "Id", id)
}

func (es SqlEmojiStore) GetByName(rctx request.CTX, name string, allowFromCache bool) (*model.Emoji, error) {
	return es.getBy(rctx, "Name", name)
}

func (es SqlEmojiStore) GetMultipleByName(rctx request.CTX, names []string) ([]*model.Emoji, error) {
	query := es.emojiSelectQuery.Where(sq.Eq{"Name": names})

	emojis := []*model.Emoji{}
	if err := es.DBXFromContext(rctx.Context()).SelectBuilder(&emojis, query); err != nil {
		return nil, errors.Wrapf(err, "error getting emojis by names %v", names)
	}

	return emojis, nil
}

func (es SqlEmojiStore) GetList(offset, limit int, sort string) ([]*model.Emoji, error) {
	emojis := []*model.Emoji{}

	query := es.emojiSelectQuery
	if sort == model.EmojiSortByName {
		query = query.OrderBy("Name")
	}

	query = query.Limit(uint64(limit)).Offset(uint64(offset))

	if err := es.GetReplica().SelectBuilder(&emojis, query); err != nil {
		return nil, errors.Wrap(err, "could not get list of emojis")
	}
	return emojis, nil
}

func (es SqlEmojiStore) Delete(emoji *model.Emoji, time int64) error {
	if sqlResult, err := es.GetMaster().Exec(
		`UPDATE
			Emoji
		SET
			DeleteAt = ?,
			UpdateAt = ?
		WHERE
			Id = ?
			AND DeleteAt = 0`, time, time, emoji.Id); err != nil {
		return errors.Wrap(err, "could not delete emoji")
	} else if rows, err := sqlResult.RowsAffected(); rows == 0 {
		return store.NewErrNotFound("Emoji", emoji.Id).Wrap(err)
	}

	return nil
}

func (es SqlEmojiStore) Search(name string, prefixOnly bool, limit int) ([]*model.Emoji, error) {
	emojis := []*model.Emoji{}

	name = sanitizeSearchTerm(name, "\\")

	term := ""
	if !prefixOnly {
		term = "%"
	}
	term += name + "%"

	query := es.emojiSelectQuery.
		Where(sq.Like{"Name": term}).
		OrderBy("Name").
		Limit(uint64(limit))

	if err := es.GetReplica().SelectBuilder(&emojis, query); err != nil {
		return nil, errors.Wrapf(err, "could not search emojis by name %s", name)
	}
	return emojis, nil
}

// getBy returns one active (not deleted) emoji, found by any one column (what/key).
func (es SqlEmojiStore) getBy(rctx request.CTX, what, key string) (*model.Emoji, error) {
	var emoji model.Emoji

	query := es.emojiSelectQuery.Where(sq.Eq{what: key})

	err := es.DBXFromContext(rctx.Context()).GetBuilder(&emoji, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Emoji", fmt.Sprintf("%s=%s", what, key))
		}
		return nil, errors.Wrapf(err, "could not get emoji by %s with value %s", what, key)
	}

	return &emoji, nil
}
