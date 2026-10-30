// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPostEntityStore struct {
	*SqlStore
}

type postEntityDB struct {
	PostId            string `db:"postid"`
	ChannelId         string `db:"channelid"`
	MessageHash       string `db:"messagehash"`
	PatternGeneration string `db:"patterngeneration"`
	ProtectedRanges   []byte `db:"protectedranges"`
	Entities          []byte `db:"entities"`
	Skipped           bool   `db:"skipped"`
	UpdateAt          int64  `db:"updateat"`
}

func newSqlPostEntityStore(sqlStore *SqlStore) store.PostEntityStore {
	return &SqlPostEntityStore{SqlStore: sqlStore}
}

func (s *SqlPostEntityStore) Save(row *model.PostEntityRow) error {
	ranges, err := json.Marshal(row.ProtectedRanges)
	if err != nil {
		return errors.Wrap(err, "failed to serialize post entity ranges")
	}
	if row.ProtectedRanges == nil {
		ranges = []byte("[]")
	}
	entities := row.Entities
	if entities == nil {
		entities = []*model.PostEntity{}
	}
	encoded, err := json.Marshal(entities)
	if err != nil {
		return errors.Wrap(err, "failed to serialize post entities")
	}
	if s.IsBinaryParamEnabled() {
		ranges = AppendBinaryFlag(ranges)
		encoded = AppendBinaryFlag(encoded)
	}

	query := s.getQueryBuilder().
		Insert("postentities").
		Columns("postid", "channelid", "messagehash", "patterngeneration", "protectedranges", "entities", "skipped", "updateat").
		Values(row.PostId, row.ChannelId, row.MessageHash, row.PatternGeneration, ranges, encoded, row.Skipped, row.UpdateAt).
		Suffix(`ON CONFLICT (postid) DO UPDATE SET
			channelid = EXCLUDED.channelid,
			messagehash = EXCLUDED.messagehash,
			patterngeneration = EXCLUDED.patterngeneration,
			protectedranges = EXCLUDED.protectedranges,
			entities = EXCLUDED.entities,
			skipped = EXCLUDED.skipped,
			updateat = EXCLUDED.updateat`)

	if _, err = s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to save post entities")
	}
	return nil
}

func (s *SqlPostEntityStore) Get(postID string) (*model.PostEntityRow, error) {
	rows, err := s.GetMany([]string{postID})
	if err != nil {
		return nil, err
	}
	return rows[postID], nil
}

func (s *SqlPostEntityStore) GetMany(postIDs []string) (map[string]*model.PostEntityRow, error) {
	out := make(map[string]*model.PostEntityRow, len(postIDs))
	if len(postIDs) == 0 {
		return out, nil
	}
	const chunk = 500
	for start := 0; start < len(postIDs); start += chunk {
		end := start + chunk
		if end > len(postIDs) {
			end = len(postIDs)
		}
		query := s.getQueryBuilder().
			Select("postid", "channelid", "messagehash", "patterngeneration", "protectedranges", "entities", "skipped", "updateat").
			From("postentities").
			Where(sq.Eq{"postid": postIDs[start:end]})

		var rows []postEntityDB
		if err := s.GetReplica().SelectBuilder(&rows, query); err != nil {
			return nil, errors.Wrap(err, "failed to get post entities")
		}
		for i := range rows {
			decoded, err := decodePostEntityRow(&rows[i])
			if err != nil {
				return nil, err
			}
			out[decoded.PostId] = decoded
		}
	}
	return out, nil
}

func decodePostEntityRow(row *postEntityDB) (*model.PostEntityRow, error) {
	out := &model.PostEntityRow{
		PostId:            row.PostId,
		ChannelId:         row.ChannelId,
		MessageHash:       row.MessageHash,
		PatternGeneration: row.PatternGeneration,
		Skipped:           row.Skipped,
		UpdateAt:          row.UpdateAt,
	}
	if len(row.ProtectedRanges) > 0 {
		if err := json.Unmarshal(row.ProtectedRanges, &out.ProtectedRanges); err != nil {
			return nil, errors.Wrap(err, "failed to decode post entity ranges")
		}
	}
	if len(row.Entities) > 0 {
		if err := json.Unmarshal(row.Entities, &out.Entities); err != nil {
			return nil, errors.Wrap(err, "failed to decode post entities")
		}
	}
	return out, nil
}
