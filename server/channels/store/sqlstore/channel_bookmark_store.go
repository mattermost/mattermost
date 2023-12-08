// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"

	"github.com/pkg/errors"
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
		"COALESCE(fi.Id, '') as Id",
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

	row := s.GetReplicaX().DB.QueryRow(queryString, args...)
	if row == nil {
		return nil, errors.Wrapf(row.Err(), "failed to find bookmark")
	}

	if err = row.Err(); err != nil {
		return nil, errors.Wrapf(row.Err(), "failed to find bookmark")
	}

	var bwf model.ChannelBookmarkWithFileInfo
	var b model.ChannelBookmark
	var f model.FileInfo

	if err = row.Scan(&b.Id, &b.OwnerId, &b.ChannelId, &b.FileId, &b.CreateAt, &b.UpdateAt, &b.DeleteAt, &b.DisplayName, &b.SortOrder, &b.LinkUrl, &b.ImageUrl, &b.Emoji, &b.Type, &b.OriginalId,
		&f.Id, &f.Name, &f.Extension, &f.Size, &f.MimeType, &f.Width, &f.Height, &f.HasPreviewImage, &f.MiniPreview); err != nil {
		return nil, errors.Wrap(err, "failed to find bookmark")
	}

	bwf.ChannelBookmark = &b
	if b.FileId != "" && f.Id != "" {
		bwf.FileInfo = &f
	}

	return &bwf, nil
}

func (s *SqlChannelBookmarkStore) Save(bookmark *model.ChannelBookmark, increaseSortOrder bool) (b *model.ChannelBookmarkWithFileInfo, err error) {
	bookmark.PreSave()
	if err := bookmark.IsValid(); err != nil {
		return nil, err
	}

	if increaseSortOrder {
		var sortOrder int64
		query := s.getQueryBuilder().
			Select("COALESCE(MAX(SortOrder), -1) as SortOrder").
			From("ChannelBookmarks").
			Where(sq.Eq{"ChannelId": bookmark.ChannelId, "DeleteAt": 0})

		err = s.GetReplicaX().GetBuilder(&sortOrder, query)
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

	if _, insertErr := s.GetMasterX().Exec(sql, args...); insertErr != nil {
		return nil, errors.Wrap(insertErr, "unable_to_save_channel_bookmark")
	}

	var fileInfo model.FileInfo
	if bookmark.FileId != "" {
		query, args, err := s.getQueryBuilder().
			Select("Id, Name, Extension, Size, MimeType, Width, Height, HasPreviewImage, MiniPreview").
			From("FileInfo").
			Where(sq.Eq{"Id": bookmark.FileId}).
			ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "channel_bookmark_get_file_info_to_sql")
		}
		if err = s.GetReplicaX().Get(&fileInfo, query, args...); err != nil {
			return nil, errors.Wrap(err, "unable_to_get_channel_bookmark_file_info")
		}
	}

	return bookmark.ToBookmarkWithFileInfo(&fileInfo), nil
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
		Set("UpdateAt", bookmark.UpdateAt).
		Where(sq.Eq{
			"Id":       bookmark.Id,
			"DeleteAt": 0,
		}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_bookmark_update_tosql")
	}

	res, err := s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to update channel bookmark with id=%s", bookmark.Id)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "failed to get affected rows after updating bookmark with id=%s", bookmark.Id)
	}
	if rowsAffected == 0 {
		return errors.Wrapf(sql.ErrNoRows, "cannot find bookmark with id=%s for update", bookmark.Id)
	}
	return nil
}

func (s *SqlChannelBookmarkStore) UpdateSortOrder(bookmarkId, channelId string, newIndex int64) ([]*model.ChannelBookmarkWithFileInfo, error) {
	now := model.GetMillis()
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(transaction, &err)

	bookmarks, err := s.GetBookmarksForChannelSince(channelId, 0)
	if err != nil {
		return nil, err
	}

	if (int(newIndex) > len(bookmarks)-1) || newIndex < 0 {
		return nil, errors.New("new sort order out of bounds")
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
		return nil, errors.New("bookmark to sort not found")
	}

	bookmarks = utils.RemoveElementFromSliceAtIndex(bookmarks, currentIndex)
	bookmarks = utils.InsertElementToSliceAtIndex(bookmarks, current, int(newIndex))
	for index, b := range bookmarks {
		b.SortOrder = int64(index)
		updateSort := "UPDATE ChannelBookmarks SET SortOrder = ?, UpdateAt = ? WHERE Id = ?"
		if _, updateSortOrderErr := transaction.Exec(updateSort, index, now, b.Id); updateSortOrderErr != nil {
			return nil, updateSortOrderErr
		}
	}

	err = transaction.Commit()
	return bookmarks, err
}

func (s *SqlChannelBookmarkStore) Delete(bookmarkId string) error {
	now := model.GetMillis()
	query, args, err := s.getQueryBuilder().
		Update("ChannelBookmarks").
		Set("DeleteAt", now).
		Set("UpdateAt", now).
		Where(sq.Eq{"Id": bookmarkId}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_bookmark_delete_tosql")
	}

	_, err = s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete channel bookmark with id=%s", bookmarkId)
	}
	return nil
}

func (s *SqlChannelBookmarkStore) GetBookmarksForChannelSince(channelId string, since int64) ([]*model.ChannelBookmarkWithFileInfo, error) {
	bookmarks, err := s.GetBookmarksForAllChannelByIdSince([]string{channelId}, since)
	if err != nil {
		return nil, err
	}

	return bookmarks[channelId], nil
}

func (s *SqlChannelBookmarkStore) GetBookmarksForAllChannelByIdSince(channelsId []string, since int64) (map[string][]*model.ChannelBookmarkWithFileInfo, error) {
	query := s.getQueryBuilder().
		Select(bookmarkWithFileInfoSliceColumns()...).
		From("ChannelBookmarks cb").
		LeftJoin("FileInfo fi ON cb.FileInfoId = fi.Id").
		Where(fmt.Sprintf("cb.ChannelId IN ('%s')", strings.Join(channelsId, "', '")))

	if since > 0 {
		query = query.Where(sq.Or{
			sq.GtOrEq{"cb.UpdateAt": since},
			sq.GtOrEq{"cb.DeleteAt": since},
		})
	} else {
		query = query.Where(sq.Eq{"cb.DeleteAt": 0})
	}

	query = query.OrderBy("cb.SortOrder ASC").OrderBy("cb.DeleteAt ASC")
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_bookmark_getforchanneltsince_tosql")
	}

	rows, queryErr := s.GetReplicaX().DB.Query(queryString, args...)
	if queryErr != nil {
		return nil, errors.Wrapf(queryErr, "failed to find bookmarks")
	}

	retrievedRecords := make(map[string][]*model.ChannelBookmarkWithFileInfo)
	defer rows.Close()
	for rows.Next() {
		var b model.ChannelBookmarkWithFileInfo
		f := model.FileInfo{}

		if err = rows.Scan(&b.Id, &b.OwnerId, &b.ChannelId, &b.FileId, &b.CreateAt, &b.UpdateAt, &b.DeleteAt, &b.DisplayName, &b.SortOrder, &b.LinkUrl, &b.ImageUrl, &b.Emoji, &b.Type, &b.OriginalId,
			&f.Id, &f.Name, &f.Extension, &f.Size, &f.MimeType, &f.Width, &f.Height, &f.HasPreviewImage, &f.MiniPreview); err != nil {
			return nil, errors.Wrap(err, "channel bookmarks unable to scan from rows")
		}

		if b.FileId != "" && f.Id != "" {
			b.FileInfo = &f
			if len(*f.MiniPreview) == 0 {
				b.FileInfo.MiniPreview = nil
			}
		}

		bookmarks := retrievedRecords[b.ChannelId]
		retrievedRecords[b.ChannelId] = append(bookmarks, &b)
	}
	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "channel bookmarks failed while iterating over rows")
	}

	return retrievedRecords, nil
}
