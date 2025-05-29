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

type SqlChannelBookmarkStore struct {
	*SqlStore
}

func newSqlChannelBookmarkStore(sqlStore *SqlStore) store.ChannelBookmarkStore {
	return &SqlChannelBookmarkStore{sqlStore}
}

func bookmarkWithFileInfoSliceColumns() []string {
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

func (s *SqlChannelBookmarkStore) ErrorIfBookmarkFileInfoAlreadyAttached(fileId string, channelId string) error {
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
					sq.NotEq{"CreatorId": model.BookmarkFileOwner},
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

func (s *SqlChannelBookmarkStore) Get(Id string, includeDeleted bool) (*model.ChannelBookmarkWithFileInfo, error) {
	query := s.getQueryBuilder().
		Select(bookmarkWithFileInfoSliceColumns()...).
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

	bookmark := model.ChannelBookmarkAndFileInfo{}

	if err := s.GetReplica().Get(&bookmark, queryString, args...); err != nil {
		return nil, store.NewErrNotFound("ChannelBookmark", Id)
	}

	return bookmark.ToChannelBookmarkWithFileInfo(), nil
}

func (s *SqlChannelBookmarkStore) Save(bookmark *model.ChannelBookmark, increaseSortOrder bool) (b *model.ChannelBookmarkWithFileInfo, err error) {
	bookmark.PreSave()
	if err := bookmark.IsValid(); err != nil {
		return nil, err
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(transaction, &err)

	var currentBookmarksCount int64
	query := s.getQueryBuilder().
		Select("COUNT(*) as count").
		From("ChannelBookmarks").
		Where(sq.Eq{"ChannelId": bookmark.ChannelId, "DeleteAt": 0})
	err = transaction.GetBuilder(&currentBookmarksCount, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed while getting the count of ChannelBookmarks")
	}

	if currentBookmarksCount >= model.MaxBookmarksPerChannel {
		return nil, store.NewErrLimitExceeded("bookmarks_per_channel", int(currentBookmarksCount), "channelId="+bookmark.ChannelId)
	}

	if bookmark.FileId != "" {
		err = s.ErrorIfBookmarkFileInfoAlreadyAttached(bookmark.FileId, bookmark.ChannelId)
		if err != nil {
			return nil, errors.Wrap(err, "unable_to_save_channel_bookmark")
		}
	}

	if increaseSortOrder {
		var sortOrder int64
		query := s.getQueryBuilder().
			Select("COALESCE(MAX(SortOrder), -1) as SortOrder").
			From("ChannelBookmarks").
			Where(sq.Eq{"ChannelId": bookmark.ChannelId, "DeleteAt": 0})

		err = transaction.GetBuilder(&sortOrder, query)
		if err != nil {
			return nil, errors.Wrap(err, "failed while getting the sortOrder from ChannelBookmarks")
		}
		bookmark.SortOrder = sortOrder + 1
	}

	sql, args, sqlErr := s.getQueryBuilder().
		Insert("ChannelBookmarks").
		Columns("Id", "CreateAt", "UpdateAt", "DeleteAt", "ChannelId", "OwnerId", "FileInfoId", "DisplayName", "SortOrder", "LinkUrl", "ImageUrl", "Emoji", "Type").
		Values(bookmark.Id, bookmark.CreateAt, bookmark.UpdateAt, bookmark.DeleteAt, bookmark.ChannelId, bookmark.OwnerId, bookmark.FileId, bookmark.DisplayName, bookmark.SortOrder, bookmark.LinkUrl, bookmark.ImageUrl, bookmark.Emoji, bookmark.Type).
		ToSql()

	if sqlErr != nil {
		return nil, errors.Wrap(err, "insert_channel_bookmark_to_sql")
	}

	if _, insertErr := transaction.Exec(sql, args...); insertErr != nil {
		return nil, errors.Wrap(insertErr, "unable_to_save_channel_bookmark")
	}

	var fileInfo model.FileInfo
	if bookmark.FileId != "" {
		query, args, queryErr := s.getQueryBuilder().
			Select("Id, Name, Extension, Size, MimeType, Width, Height, HasPreviewImage, MiniPreview").
			From("FileInfo").
			Where(sq.Eq{"Id": bookmark.FileId}).
			ToSql()
		if queryErr != nil {
			return nil, errors.Wrap(queryErr, "channel_bookmark_get_file_info_to_sql")
		}
		if queryErr = transaction.Get(&fileInfo, query, args...); queryErr != nil {
			return nil, errors.Wrap(queryErr, "unable_to_get_channel_bookmark_file_info")
		}
	}

	err = transaction.Commit()
	return bookmark.ToBookmarkWithFileInfo(&fileInfo), err
}

func (s *SqlChannelBookmarkStore) Update(bookmark *model.ChannelBookmark) error {
	bookmark.PreUpdate()
	if err := bookmark.IsValid(); err != nil {
		return err
	}

	query, args, err := s.getQueryBuilder().
		Update("ChannelBookmarks").
		Set("DisplayName", bookmark.DisplayName).
		Set("SortOrder", bookmark.SortOrder).
		Set("LinkUrl", bookmark.LinkUrl).
		Set("ImageUrl", bookmark.ImageUrl).
		Set("Emoji", bookmark.Emoji).
		Set("FileInfoId", bookmark.FileId).
		Set("UpdateAt", bookmark.UpdateAt).
		Where(sq.Eq{
			"Id":       bookmark.Id,
			"DeleteAt": 0,
		}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_bookmark_update_tosql")
	}

	res, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to update channel bookmark with id=%s", bookmark.Id)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "failed to get affected rows after updating bookmark with id=%s", bookmark.Id)
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound("ChannelBookmark", bookmark.Id)
	}
	return nil
}

func (s *SqlChannelBookmarkStore) UpdateSortOrder(bookmarkId, channelId string, newIndex int64) ([]*model.ChannelBookmarkWithFileInfo, error) {
	now := model.GetMillis()
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(transaction, &err)

	bookmarks, err := s.GetBookmarksForChannelSince(channelId, 0)
	if err != nil {
		return nil, err
	}

	if (int(newIndex) > len(bookmarks)-1) || newIndex < 0 {
		return nil, store.NewErrInvalidInput("ChannelBookmark", "SortOrder", newIndex)
	}

	currentIndex := -1
	var current *model.ChannelBookmarkWithFileInfo
	for index, b := range bookmarks {
		if b.Id == bookmarkId {
			currentIndex = index
			current = b
			break
		}
	}

	if currentIndex == -1 {
		return nil, store.NewErrNotFound("ChannelBookmark", bookmarkId)
	}

	bookmarks = utils.RemoveElementFromSliceAtIndex(bookmarks, currentIndex)
	bookmarks = slices.Insert(bookmarks, int(newIndex), current)
	caseStmt := sq.Case()
	query := s.getQueryBuilder().
		Update("ChannelBookmarks")

	ids := []string{}
	for index, b := range bookmarks {
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
	return bookmarks, err
}

func (s *SqlChannelBookmarkStore) Delete(bookmarkId string, deleteFile bool) error {
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
		Where(sq.Eq{"Id": bookmarkId}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_bookmark_delete_tosql")
	}

	_, err = transaction.Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete channel bookmark with id=%s", bookmarkId)
	}

	if deleteFile {
		fileIdQuery := s.getSubQueryBuilder().
			Select("FileInfoId").
			From("ChannelBookmarks").
			Where(sq.And{
				sq.Eq{"Id": bookmarkId},
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
			return errors.Wrapf(err, "failed to delete channel bookmark with id=%s", bookmarkId)
		}
	}

	return transaction.Commit()
}

func (s *SqlChannelBookmarkStore) GetBookmarksForChannelSince(channelId string, since int64) ([]*model.ChannelBookmarkWithFileInfo, error) {
	query := s.getQueryBuilder().
		Select(bookmarkWithFileInfoSliceColumns()...).
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
		Limit(model.MaxBookmarksPerChannel * 2) // limit to the double of the cap as an edge case
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_bookmark_getforchanneltsince_tosql")
	}

	bookmarkRows := []model.ChannelBookmarkAndFileInfo{}
	bookmarks := []*model.ChannelBookmarkWithFileInfo{}

	if err := s.GetReplica().Select(&bookmarkRows, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find bookmarks")
	}

	for _, bookmark := range bookmarkRows {
		bookmarks = append(bookmarks, bookmark.ToChannelBookmarkWithFileInfo())
	}

	return bookmarks, nil
}
