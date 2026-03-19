// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"slices"
	"strconv"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

type SqlChannelTabStore struct {
	*SqlStore
}

func newSqlChannelTabStore(sqlStore *SqlStore) store.ChannelTabStore {
	return &SqlChannelTabStore{sqlStore}
}

func tabWithFileInfoSliceColumns() []string {
	return []string{
		"cb.Id",
		"cb.OwnerId",
		"cb.ChannelId",
		"cb.FileInfoId",
		"cb.CreateAt",
		"cb.UpdateAt",
		"cb.DeleteAt",
		"cb.DisplayName",
		"cb.SortOrder",
		"cb.LinkUrl",
		"cb.ImageUrl",
		"cb.Emoji",
		"cb.Type",
		"COALESCE(cb.OriginalId, '') as OriginalId",
		"COALESCE(fi.Id, '') as FileId",
		"COALESCE(fi.Name, '') as FileName",
		"COALESCE(fi.Extension, '') as Extension",
		"COALESCE(fi.Size, 0) as Size",
		"COALESCE(fi.MimeType, '') as MimeType",
		"COALESCE(fi.Width, 0) as Width",
		"COALESCE(fi.Height, 0) as Height",
		"COALESCE(fi.HasPreviewImage, false) as HasPreviewImage",
		"COALESCE(fi.MiniPreview, '') as MiniPreview",
	}
}

func (s *SqlChannelTabStore) ErrorIfTabFileInfoAlreadyAttached(fileId string, channelId string) error {
	existingQuery := s.getSubQueryBuilder().
		Select("FileInfoId").
		From("ChannelBookmarks").
		Where(sq.And{
			sq.Eq{"FileInfoId": fileId},
			sq.Eq{"DeleteAt": 0},
		})

	alreadyAttachedQuery := s.getQueryBuilder().
		Select("COUNT(*)").
		From("FileInfo").
		Where(sq.Or{
			sq.Expr("Id IN (?)", existingQuery),
			sq.And{
				sq.Eq{"Id": fileId},
				sq.Or{
					sq.NotEq{"PostId": ""},
					sq.NotEq{"CreatorId": model.TabFileOwner},
					sq.NotEq{"ChannelId": channelId},
					sq.NotEq{"DeleteAt": 0},
				},
			},
		})

	var attached int64
	err := s.GetReplica().GetBuilder(&attached, alreadyAttachedQuery)
	if err != nil {
		return errors.Wrap(err, "unable_to_save_channel_bookmark")
	}

	if attached > 0 {
		return store.NewErrInvalidInput("ChannelBookmarks", "FileInfoId", fileId)
	}

	return nil
}

func (s *SqlChannelTabStore) Get(Id string, includeDeleted bool) (*model.ChannelTabWithFileInfo, error) {
	query := s.getQueryBuilder().
		Select(tabWithFileInfoSliceColumns()...).
		From("ChannelBookmarks cb").
		LeftJoin("FileInfo fi ON cb.FileInfoId = fi.Id").
		Where(sq.Eq{"cb.Id": Id})

	if !includeDeleted {
		query = query.Where(sq.Eq{"cb.DeleteAt": 0})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_bookmark_getforchanneltsince_tosql")
	}

	tab := model.ChannelTabAndFileInfo{}

	if err := s.GetReplica().Get(&tab, queryString, args...); err != nil {
		return nil, store.NewErrNotFound("ChannelBookmark", Id)
	}

	return tab.ToChannelTabWithFileInfo(), nil
}

func (s *SqlChannelTabStore) Save(tab *model.ChannelTab, increaseSortOrder bool) (b *model.ChannelTabWithFileInfo, err error) {
	tab.PreSave()
	if err := tab.IsValid(); err != nil {
		return nil, err
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(transaction, &err)

	var currentTabsCount int64
	query := s.getQueryBuilder().
		Select("COUNT(*) as count").
		From("ChannelBookmarks").
		Where(sq.Eq{"ChannelId": tab.ChannelId, "DeleteAt": 0})
	err = transaction.GetBuilder(&currentTabsCount, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed while getting the count of ChannelTabs")
	}

	if currentTabsCount >= model.MaxTabsPerChannel {
		return nil, store.NewErrLimitExceeded("tabs_per_channel", int(currentTabsCount), "channelId="+tab.ChannelId)
	}

	if tab.FileId != "" {
		err = s.ErrorIfTabFileInfoAlreadyAttached(tab.FileId, tab.ChannelId)
		if err != nil {
			return nil, errors.Wrap(err, "unable_to_save_channel_bookmark")
		}
	}

	if increaseSortOrder {
		var sortOrder int64
		query := s.getQueryBuilder().
			Select("COALESCE(MAX(SortOrder), -1) as SortOrder").
			From("ChannelBookmarks").
			Where(sq.Eq{"ChannelId": tab.ChannelId, "DeleteAt": 0})

		err = transaction.GetBuilder(&sortOrder, query)
		if err != nil {
			return nil, errors.Wrap(err, "failed while getting the sortOrder from ChannelTabs")
		}
		tab.SortOrder = sortOrder + 1
	}

	sql, args, sqlErr := s.getQueryBuilder().
		Insert("ChannelBookmarks").
		Columns("Id", "CreateAt", "UpdateAt", "DeleteAt", "ChannelId", "OwnerId", "FileInfoId", "DisplayName", "SortOrder", "LinkUrl", "ImageUrl", "Emoji", "Type").
		Values(tab.Id, tab.CreateAt, tab.UpdateAt, tab.DeleteAt, tab.ChannelId, tab.OwnerId, tab.FileId, tab.DisplayName, tab.SortOrder, tab.LinkUrl, tab.ImageUrl, tab.Emoji, tab.Type).
		ToSql()

	if sqlErr != nil {
		return nil, errors.Wrap(err, "insert_channel_bookmark_to_sql")
	}

	if _, insertErr := transaction.Exec(sql, args...); insertErr != nil {
		return nil, errors.Wrap(insertErr, "unable_to_save_channel_bookmark")
	}

	var fileInfo model.FileInfo
	if tab.FileId != "" {
		query, args, queryErr := s.getQueryBuilder().
			Select("Id, Name, Extension, Size, MimeType, Width, Height, HasPreviewImage, MiniPreview").
			From("FileInfo").
			Where(sq.Eq{"Id": tab.FileId}).
			ToSql()
		if queryErr != nil {
			return nil, errors.Wrap(queryErr, "channel_bookmark_get_file_info_to_sql")
		}
		if queryErr = transaction.Get(&fileInfo, query, args...); queryErr != nil {
			return nil, errors.Wrap(queryErr, "unable_to_get_channel_bookmark_file_info")
		}
	}

	err = transaction.Commit()
	return tab.ToTabWithFileInfo(&fileInfo), err
}

func (s *SqlChannelTabStore) Update(tab *model.ChannelTab) error {
	tab.PreUpdate()
	if err := tab.IsValid(); err != nil {
		return err
	}

	query, args, err := s.getQueryBuilder().
		Update("ChannelBookmarks").
		Set("DisplayName", tab.DisplayName).
		Set("SortOrder", tab.SortOrder).
		Set("LinkUrl", tab.LinkUrl).
		Set("ImageUrl", tab.ImageUrl).
		Set("Emoji", tab.Emoji).
		Set("FileInfoId", tab.FileId).
		Set("UpdateAt", tab.UpdateAt).
		Where(sq.Eq{
			"Id":       tab.Id,
			"DeleteAt": 0,
		}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_bookmark_update_tosql")
	}

	res, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to update channel tab with id=%s", tab.Id)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "failed to get affected rows after updating tab with id=%s", tab.Id)
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound("ChannelBookmark", tab.Id)
	}
	return nil
}

func (s *SqlChannelTabStore) UpdateSortOrder(tabId, channelId string, newIndex int64) ([]*model.ChannelTabWithFileInfo, error) {
	now := model.GetMillis()
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(transaction, &err)

	tabs, err := s.GetTabsForChannelSince(channelId, 0)
	if err != nil {
		return nil, err
	}

	if (int(newIndex) > len(tabs)-1) || newIndex < 0 {
		return nil, store.NewErrInvalidInput("ChannelTab", "SortOrder", newIndex)
	}

	currentIndex := -1
	var current *model.ChannelTabWithFileInfo
	for index, b := range tabs {
		if b.Id == tabId {
			currentIndex = index
			current = b
			break
		}
	}

	if currentIndex == -1 {
		return nil, store.NewErrNotFound("ChannelBookmark", tabId)
	}

	tabs = utils.RemoveElementFromSliceAtIndex(tabs, currentIndex)
	tabs = slices.Insert(tabs, int(newIndex), current)
	caseStmt := sq.Case()
	query := s.getQueryBuilder().
		Update("ChannelBookmarks")

	ids := []string{}
	for index, b := range tabs {
		b.SortOrder = int64(index)
		b.UpdateAt = now
		caseStmt = caseStmt.When(sq.Eq{"Id": b.Id}, strconv.FormatInt(int64(index), 10))
		ids = append(ids, b.Id)
	}
	query = query.Set("SortOrder", caseStmt)
	query = query.Set("UpdateAt", now)
	query = query.Where(sq.Eq{"Id": ids})
	queryStr, args, queryErr := query.ToSql()
	if queryErr != nil {
		return nil, queryErr
	}

	if _, updateSortOrderErr := transaction.Exec(queryStr, args...); updateSortOrderErr != nil {
		return nil, updateSortOrderErr
	}

	err = transaction.Commit()
	return tabs, err
}

func (s *SqlChannelTabStore) Delete(tabId string, deleteFile bool) error {
	now := model.GetMillis()
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return err
	}
	defer finalizeTransactionX(transaction, &err)
	query, args, err := s.getQueryBuilder().
		Update("ChannelBookmarks").
		Set("DeleteAt", now).
		Set("UpdateAt", now).
		Where(sq.Eq{"Id": tabId}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_bookmark_delete_tosql")
	}

	_, err = transaction.Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete channel tab with id=%s", tabId)
	}

	if deleteFile {
		fileIdQuery := s.getSubQueryBuilder().
			Select("FileInfoId").
			From("ChannelBookmarks").
			Where(sq.And{
				sq.Eq{"Id": tabId},
			})

		fileQuery, fileArgs, fileErr := s.getQueryBuilder().
			Update("FileInfo").
			Set("DeleteAt", now).
			Set("UpdateAt", now).
			Where(sq.Expr("Id IN (?)", fileIdQuery)).
			ToSql()

		if fileErr != nil {
			return errors.Wrap(err, "channel_bookmark_delete_tosql")
		}

		_, err = transaction.Exec(fileQuery, fileArgs...)
		if err != nil {
			return errors.Wrapf(err, "failed to delete channel tab with id=%s", tabId)
		}
	}

	return transaction.Commit()
}

func (s *SqlChannelTabStore) GetTabsForChannelSince(channelId string, since int64) ([]*model.ChannelTabWithFileInfo, error) {
	query := s.getQueryBuilder().
		Select(tabWithFileInfoSliceColumns()...).
		From("ChannelBookmarks cb").
		LeftJoin("FileInfo fi ON cb.FileInfoId = fi.Id").
		Where(sq.Eq{"cb.ChannelId": channelId})

	if since > 0 {
		query = query.Where(sq.Or{
			sq.GtOrEq{"cb.UpdateAt": since},
			sq.GtOrEq{"cb.DeleteAt": since},
		})
	} else {
		query = query.Where(sq.Eq{"cb.DeleteAt": 0})
	}

	query = query.
		OrderBy("cb.SortOrder ASC").
		OrderBy("cb.DeleteAt ASC").
		Limit(model.MaxTabsPerChannel * 2) // limit to the double of the cap as an edge case
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_bookmark_getforchanneltsince_tosql")
	}

	tabRows := []model.ChannelTabAndFileInfo{}
	tabs := []*model.ChannelTabWithFileInfo{}

	if err := s.GetReplica().Select(&tabRows, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find tabs")
	}

	for _, tab := range tabRows {
		tabs = append(tabs, tab.ToChannelTabWithFileInfo())
	}

	return tabs, nil
}
