// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlCustomChannelIconStore struct {
	*SqlStore
}

func newSqlCustomChannelIconStore(sqlStore *SqlStore) store.CustomChannelIconStore {
	return &SqlCustomChannelIconStore{
		SqlStore: sqlStore,
	}
}

// Save stores a new custom channel icon.
func (s *SqlCustomChannelIconStore) Save(icon *model.CustomChannelIcon) (*model.CustomChannelIcon, error) {
	icon.PreSave()

	if err := icon.IsValid(); err != nil {
		return nil, err
	}

	query := `
		INSERT INTO customchannelicons (id, name, svg, normalizecolor, createat, updateat, deleteat, createdby)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	if _, err := s.GetMaster().Exec(query, icon.Id, icon.Name, icon.Svg, icon.NormalizeColor, icon.CreateAt, icon.UpdateAt, icon.DeleteAt, icon.CreatedBy); err != nil {
		return nil, errors.Wrap(err, "failed to save CustomChannelIcon")
	}

	return icon, nil
}

// Update updates an existing custom channel icon.
func (s *SqlCustomChannelIconStore) Update(icon *model.CustomChannelIcon) (*model.CustomChannelIcon, error) {
	icon.PreUpdate()

	if err := icon.IsValid(); err != nil {
		return nil, err
	}

	query, args, err := s.getQueryBuilder().
		Update("customchannelicons").
		Set("name", icon.Name).
		Set("svg", icon.Svg).
		Set("normalizecolor", icon.NormalizeColor).
		Set("updateat", icon.UpdateAt).
		Where(sq.Eq{"id": icon.Id}).
		Where(sq.Eq{"deleteat": 0}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "custom_channel_icon_update_tosql")
	}

	result, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update CustomChannelIcon")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get rows affected")
	}
	if count == 0 {
		return nil, store.NewErrNotFound("CustomChannelIcon", icon.Id)
	}

	return icon, nil
}

// Get returns a custom channel icon by ID.
func (s *SqlCustomChannelIconStore) Get(id string) (*model.CustomChannelIcon, error) {
	var icon model.CustomChannelIcon

	query, args, err := s.getQueryBuilder().
		Select("id", "name", "svg", "normalizecolor", "createat", "updateat", "deleteat", "createdby").
		From("customchannelicons").
		Where(sq.Eq{"id": id}).
		Where(sq.Eq{"deleteat": 0}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "custom_channel_icon_get_tosql")
	}

	if err := s.GetReplica().Get(&icon, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("CustomChannelIcon", id)
		}
		return nil, errors.Wrapf(err, "failed to get CustomChannelIcon with id=%s", id)
	}

	return &icon, nil
}

// GetByName returns a custom channel icon by name.
func (s *SqlCustomChannelIconStore) GetByName(name string) (*model.CustomChannelIcon, error) {
	var icon model.CustomChannelIcon

	query, args, err := s.getQueryBuilder().
		Select("id", "name", "svg", "normalizecolor", "createat", "updateat", "deleteat", "createdby").
		From("customchannelicons").
		Where(sq.Eq{"name": name}).
		Where(sq.Eq{"deleteat": 0}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "custom_channel_icon_get_by_name_tosql")
	}

	if err := s.GetReplica().Get(&icon, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("CustomChannelIcon", fmt.Sprintf("name=%s", name))
		}
		return nil, errors.Wrapf(err, "failed to get CustomChannelIcon with name=%s", name)
	}

	return &icon, nil
}

// GetAll returns all custom channel icons (excluding deleted).
func (s *SqlCustomChannelIconStore) GetAll() ([]*model.CustomChannelIcon, error) {
	var icons []*model.CustomChannelIcon

	query, args, err := s.getQueryBuilder().
		Select("id", "name", "svg", "normalizecolor", "createat", "updateat", "deleteat", "createdby").
		From("customchannelicons").
		Where(sq.Eq{"deleteat": 0}).
		OrderBy("name ASC").
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "custom_channel_icon_get_all_tosql")
	}

	if err := s.GetReplica().Select(&icons, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to get all CustomChannelIcons")
	}

	return icons, nil
}

// Delete soft-deletes a custom channel icon.
func (s *SqlCustomChannelIconStore) Delete(id string, deleteAt int64) error {
	query, args, err := s.getQueryBuilder().
		Update("customchannelicons").
		Set("deleteat", deleteAt).
		Set("updateat", deleteAt).
		Where(sq.Eq{"id": id}).
		Where(sq.Eq{"deleteat": 0}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "custom_channel_icon_delete_tosql")
	}

	result, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete CustomChannelIcon with id=%s", id)
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}
	if count == 0 {
		return store.NewErrNotFound("CustomChannelIcon", id)
	}

	return nil
}

// Search searches for custom channel icons by name.
func (s *SqlCustomChannelIconStore) Search(term string, limit int) ([]*model.CustomChannelIcon, error) {
	var icons []*model.CustomChannelIcon

	searchTerm := "%" + term + "%"

	query, args, err := s.getQueryBuilder().
		Select("id", "name", "svg", "normalizecolor", "createat", "updateat", "deleteat", "createdby").
		From("customchannelicons").
		Where(sq.Eq{"deleteat": 0}).
		Where(sq.ILike{"name": searchTerm}).
		OrderBy("name ASC").
		Limit(uint64(limit)).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "custom_channel_icon_search_tosql")
	}

	if err := s.GetReplica().Select(&icons, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to search CustomChannelIcons with term=%s", term)
	}

	return icons, nil
}
