// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (s SqlChannelStore) GetLinksForSource(rctx request.CTX, sourceID, sourceType string) ([]*model.ChannelLink, error) {
	query := s.getQueryBuilder().
		Select("sourceid", "sourcetype", "destinationid", "createat").
		From("ChannelMemberLinks").
		Where(sq.Eq{"sourceid": sourceID})

	if sourceType != "" {
		query = query.Where(sq.Eq{"sourcetype": sourceType})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build query")
	}

	var links []*model.ChannelLink
	err = s.GetReplica().Select(&links, queryString, args...)
	if err != nil {
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

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build query")
	}

	var links []*model.ChannelLink
	err = s.GetReplica().Select(&links, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get links for destination %s", destinationID)
	}

	return links, nil
}

func (s SqlChannelStore) CreateChannelLink(rctx request.CTX, link *model.ChannelLink) (*model.ChannelLink, error) {
	// Placeholder - will be implemented in Phase 3
	return nil, errors.New("not yet implemented")
}

func (s SqlChannelStore) DeleteChannelLink(rctx request.CTX, sourceID, destinationID string) error {
	// Placeholder - will be implemented in Phase 3
	return errors.New("not yet implemented")
}
