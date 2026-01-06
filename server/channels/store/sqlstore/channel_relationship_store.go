// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlChannelRelationshipStore struct {
	*SqlStore
}

func newSqlChannelRelationshipStore(sqlStore *SqlStore) store.ChannelRelationshipStore {
	return &SqlChannelRelationshipStore{sqlStore}
}

func (s *SqlChannelRelationshipStore) Save(relationship *model.ChannelRelationship) (*model.ChannelRelationship, error) {
	relationship.PreSave()
	if err := relationship.IsValid(); err != nil {
		return nil, err
	}

	query, args, err := s.getQueryBuilder().
		Insert("ChannelRelationships").
		Columns("Id", "SourceChannelId", "TargetChannelId", "RelationshipType", "CreatedAt", "Metadata").
		Values(relationship.Id, relationship.SourceChannelId, relationship.TargetChannelId, relationship.RelationshipType, relationship.CreatedAt, relationship.Metadata).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_relationship_save_tosql")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "unable_to_save_channel_relationship")
	}

	return relationship, nil
}

func (s *SqlChannelRelationshipStore) Delete(id string) error {
	query, args, err := s.getQueryBuilder().
		Delete("ChannelRelationships").
		Where(sq.Eq{"Id": id}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_relationship_delete_tosql")
	}

	result, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete channel relationship with id=%s", id)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "failed to get affected rows after deleting relationship with id=%s", id)
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound("ChannelRelationship", id)
	}

	return nil
}

func (s *SqlChannelRelationshipStore) GetBySourceChannel(channelId string) ([]*model.ChannelRelationship, error) {
	query := s.getQueryBuilder().
		Select("Id", "SourceChannelId", "TargetChannelId", "RelationshipType", "CreatedAt", "Metadata").
		From("ChannelRelationships").
		Where(sq.Eq{"SourceChannelId": channelId}).
		OrderBy("CreatedAt DESC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_relationship_get_by_source_tosql")
	}

	var relationships []*model.ChannelRelationship
	if err := s.GetReplica().Select(&relationships, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find relationships for source channel %s", channelId)
	}

	return relationships, nil
}

func (s *SqlChannelRelationshipStore) GetByTargetChannel(channelId string) ([]*model.ChannelRelationship, error) {
	query := s.getQueryBuilder().
		Select("Id", "SourceChannelId", "TargetChannelId", "RelationshipType", "CreatedAt", "Metadata").
		From("ChannelRelationships").
		Where(sq.Eq{"TargetChannelId": channelId}).
		OrderBy("CreatedAt DESC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_relationship_get_by_target_tosql")
	}

	var relationships []*model.ChannelRelationship
	if err := s.GetReplica().Select(&relationships, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find relationships for target channel %s", channelId)
	}

	return relationships, nil
}

func (s *SqlChannelRelationshipStore) GetRelatedChannels(channelId string) ([]*model.ChannelRelationship, error) {
	query := s.getQueryBuilder().
		Select("Id", "SourceChannelId", "TargetChannelId", "RelationshipType", "CreatedAt", "Metadata").
		From("ChannelRelationships").
		Where(sq.Or{
			sq.Eq{"SourceChannelId": channelId},
			sq.Eq{"TargetChannelId": channelId},
		}).
		OrderBy("CreatedAt DESC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_relationship_get_related_tosql")
	}

	var relationships []*model.ChannelRelationship
	if err := s.GetReplica().Select(&relationships, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find related channels for %s", channelId)
	}

	return relationships, nil
}

func (s *SqlChannelRelationshipStore) DeleteBySourceAndType(channelId string, relType model.ChannelRelationType) error {
	query, args, err := s.getQueryBuilder().
		Delete("ChannelRelationships").
		Where(sq.And{
			sq.Eq{"SourceChannelId": channelId},
			sq.Eq{"RelationshipType": relType},
		}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_relationship_delete_by_source_and_type_tosql")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrapf(err, "failed to delete relationships for channel %s and type %s", channelId, relType)
	}

	return nil
}
