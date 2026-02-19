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

type SqlViewStore struct {
	*SqlStore
}

func newSqlViewStore(sqlStore *SqlStore) store.ViewStore {
	return &SqlViewStore{sqlStore}
}

// dbView is an intermediate struct used to scan rows from the Views table.
// Props is stored as raw JSON bytes and converted to/from *model.ViewBoardProps.
type dbView struct {
	Id          string
	ChannelId   string
	Type        string
	CreatorId   string
	Title       string
	Description string
	Icon        string
	SortOrder   int
	Props       []byte
	CreateAt    int64
	UpdateAt    int64
	DeleteAt    int64
}

func (d *dbView) toModel() (*model.View, error) {
	v := &model.View{
		Id:          d.Id,
		ChannelId:   d.ChannelId,
		Type:        model.ViewType(d.Type),
		CreatorId:   d.CreatorId,
		Title:       d.Title,
		Description: d.Description,
		Icon:        d.Icon,
		SortOrder:   d.SortOrder,
		CreateAt:    d.CreateAt,
		UpdateAt:    d.UpdateAt,
		DeleteAt:    d.DeleteAt,
	}

	if len(d.Props) > 0 {
		var props model.ViewBoardProps
		if err := json.Unmarshal(d.Props, &props); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal view props")
		}
		v.Props = &props
	}

	return v, nil
}

func marshalViewProps(props *model.ViewBoardProps, binaryParams bool) (any, error) {
	if props == nil {
		return nil, nil
	}
	b, err := json.Marshal(props)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal view props")
	}
	if binaryParams {
		b = AppendBinaryFlag(b)
	}
	return b, nil
}

func viewColumns() []string {
	return []string{
		"Id", "ChannelId", "Type", "CreatorId", "Title",
		"Description", "Icon", "SortOrder", "Props",
		"CreateAt", "UpdateAt", "DeleteAt",
	}
}

func (s *SqlViewStore) Save(view *model.View) (*model.View, error) {
	view.PreSave()
	if err := view.IsValid(); err != nil {
		return nil, err
	}

	propsVal, err := marshalViewProps(view.Props, s.IsBinaryParamEnabled())
	if err != nil {
		return nil, err
	}

	query, args, err := s.getQueryBuilder().
		Insert("Views").
		Columns(viewColumns()...).
		Values(
			view.Id, view.ChannelId, view.Type, view.CreatorId, view.Title,
			view.Description, view.Icon, view.SortOrder, propsVal,
			view.CreateAt, view.UpdateAt, view.DeleteAt,
		).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "view_save_tosql")
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to save view")
	}

	return view, nil
}

func (s *SqlViewStore) Get(id string) (*model.View, error) {
	query, args, err := s.getQueryBuilder().
		Select(viewColumns()...).
		From("Views").
		Where(sq.Eq{"Id": id, "DeleteAt": 0}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "view_get_tosql")
	}

	var row dbView
	if err = s.GetReplica().Get(&row, query, args...); err != nil {
		return nil, store.NewErrNotFound("View", id)
	}

	return row.toModel()
}

func (s *SqlViewStore) GetForChannel(channelID string) ([]*model.View, error) {
	query, args, err := s.getQueryBuilder().
		Select(viewColumns()...).
		From("Views").
		Where(sq.Eq{"ChannelId": channelID, "DeleteAt": 0}).
		OrderBy("SortOrder ASC", "CreateAt ASC").
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "view_get_for_channel_tosql")
	}

	var rows []dbView
	if err = s.GetReplica().Select(&rows, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get views for channel %s", channelID)
	}

	views := make([]*model.View, 0, len(rows))
	for _, row := range rows {
		v, err := row.toModel()
		if err != nil {
			return nil, err
		}
		views = append(views, v)
	}

	return views, nil
}

func (s *SqlViewStore) Update(view *model.View) (*model.View, error) {
	view.PreUpdate()
	if err := view.IsValid(); err != nil {
		return nil, err
	}

	propsVal, err := marshalViewProps(view.Props, s.IsBinaryParamEnabled())
	if err != nil {
		return nil, err
	}

	query, args, err := s.getQueryBuilder().
		Update("Views").
		Set("Title", view.Title).
		Set("Description", view.Description).
		Set("Icon", view.Icon).
		Set("SortOrder", view.SortOrder).
		Set("Props", propsVal).
		Set("UpdateAt", view.UpdateAt).
		Where(sq.Eq{"Id": view.Id, "DeleteAt": 0}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "view_update_tosql")
	}

	res, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update view with id=%s", view.Id)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get affected rows after updating view with id=%s", view.Id)
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("View", view.Id)
	}

	return view, nil
}

func (s *SqlViewStore) Delete(viewID string, deleteAt int64) error {
	query, args, err := s.getQueryBuilder().
		Update("Views").
		Set("DeleteAt", deleteAt).
		Set("UpdateAt", deleteAt).
		Where(sq.Eq{"Id": viewID, "DeleteAt": 0}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "view_delete_tosql")
	}

	res, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete view with id=%s", viewID)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "failed to get affected rows after deleting view with id=%s", viewID)
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound("View", viewID)
	}

	return nil
}
