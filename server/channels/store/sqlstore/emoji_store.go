// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v8/channels/einterfaces"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	"github.com/mattermost/mattermost-server/server/v8/model"
)

type SqlEmojiStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface
}

func newSqlEmojiStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.EmojiStore {
	return &SqlEmojiStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}
}

func (es SqlEmojiStore) Save(emoji *model.Emoji) (*model.Emoji, error) {
	emoji.PreSave()
	if err := emoji.IsValid(); err != nil {
		return nil, err
	}

	if _, err := es.GetMasterX().NamedExec(`INSERT INTO Emoji
		(Id, CreateAt, UpdateAt, DeleteAt, CreatorId, Name)
		VALUES
		(:Id, :CreateAt, :UpdateAt, :DeleteAt, :CreatorId, :Name)`, emoji); err != nil {
		return nil, errors.Wrap(err, "error saving emoji")
	}

	return emoji, nil
}

func (es SqlEmojiStore) Get(ctx context.Context, id string, allowFromCache bool) (*model.Emoji, error) {
	return es.getBy(ctx, "Id", id)
}

func (es SqlEmojiStore) GetByName(ctx context.Context, name string, allowFromCache bool) (*model.Emoji, error) {
	return es.getBy(ctx, "Name", name)
}

func (es SqlEmojiStore) GetMultipleByName(names []string) ([]*model.Emoji, error) {
	// Creating (?, ?, ?) len(names) number of times.
	keys := strings.Join(strings.Fields(strings.Repeat("? ", len(names))), ",")
	args := makeStringArgs(names)

	emojis := []*model.Emoji{}
	if err := es.GetReplicaX().Select(&emojis,
		`SELECT
			*
		FROM
			Emoji
		WHERE
			Name IN (`+keys+`)
			AND DeleteAt = 0`, args...); err != nil {
		return nil, errors.Wrapf(err, "error getting emoji by names %v", names)
	}
	return emojis, nil
}

func (es SqlEmojiStore) GetList(offset, limit int, sort string) ([]*model.Emoji, error) {
	emojis := []*model.Emoji{}

	query := "SELECT * FROM Emoji WHERE DeleteAt = 0"

	if sort == model.EmojiSortByName {
		query += " ORDER BY Name"
	}

	query += " LIMIT ? OFFSET ?"

	if err := es.GetReplicaX().Select(&emojis, query, limit, offset); err != nil {
		return nil, errors.Wrap(err, "could not get list of emojis")
	}
	return emojis, nil
}

func (es SqlEmojiStore) Delete(emoji *model.Emoji, time int64) error {
	if sqlResult, err := es.GetMasterX().Exec(
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

	if err := es.GetReplicaX().Select(&emojis,
		`SELECT
			*
		FROM
			Emoji
		WHERE
			Name LIKE ?
			AND DeleteAt = 0
			ORDER BY Name
			LIMIT ?`, term, limit); err != nil {
		return nil, errors.Wrapf(err, "could not search emojis by name %s", name)
	}
	return emojis, nil
}

// getBy returns one active (not deleted) emoji, found by any one column (what/key).
func (es SqlEmojiStore) getBy(ctx context.Context, what, key string) (*model.Emoji, error) {
	var emoji model.Emoji

	err := es.DBXFromContext(ctx).Get(&emoji,
		`SELECT
			*
		FROM
			Emoji
		WHERE
			`+what+` = ?
			AND DeleteAt = 0`, key)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Emoji", fmt.Sprintf("%s=%s", what, key))
		}

		return nil, errors.Wrapf(err, "could not get emoji by %s with value %s", what, key)
	}

	return &emoji, nil
}
