// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlFileInfoStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

func (fs SqlFileInfoStore) ClearCaches() {
}

func newSqlFileInfoStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.FileInfoStore {
	s := &SqlFileInfoStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.FileInfo{}, "FileInfo").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("CreatorId").SetMaxSize(26)
		table.ColMap("PostId").SetMaxSize(26)
		table.ColMap("Path").SetMaxSize(512)
		table.ColMap("ThumbnailPath").SetMaxSize(512)
		table.ColMap("PreviewPath").SetMaxSize(512)
		table.ColMap("Name").SetMaxSize(256)
		table.ColMap("Extension").SetMaxSize(64)
		table.ColMap("MimeType").SetMaxSize(256)
	}

	return s
}

func (fs SqlFileInfoStore) createIndexesIfNotExists() {
	fs.CreateIndexIfNotExists("idx_fileinfo_update_at", "FileInfo", "UpdateAt")
	fs.CreateIndexIfNotExists("idx_fileinfo_create_at", "FileInfo", "CreateAt")
	fs.CreateIndexIfNotExists("idx_fileinfo_delete_at", "FileInfo", "DeleteAt")
	fs.CreateIndexIfNotExists("idx_fileinfo_postid_at", "FileInfo", "PostId")
}

func (fs SqlFileInfoStore) Save(info *model.FileInfo) (*model.FileInfo, error) {
	info.PreSave()
	if err := info.IsValid(); err != nil {
		return nil, err
	}

	if err := fs.GetMaster().Insert(info); err != nil {
		return nil, errors.Wrap(err, "failed to save FileInfo")
	}
	return info, nil
}

func (fs SqlFileInfoStore) Get(id string) (*model.FileInfo, error) {
	info := &model.FileInfo{}

	if err := fs.GetReplica().SelectOne(info,
		`SELECT
			*
		FROM
			FileInfo
		WHERE
			Id = :Id
			AND DeleteAt = 0`, map[string]interface{}{"Id": id}); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("FileInfo", id)
		}
		return nil, errors.Wrapf(err, "failed to get FileInfo with id=%s", id)
	}
	return info, nil
}

func (fs SqlFileInfoStore) GetWithOptions(page, perPage int, opt *model.GetFileInfosOptions) ([]*model.FileInfo, error) {
	if perPage < 0 {
		return nil, store.NewErrLimitExceeded("perPage", perPage, "value used in pagination while getting FileInfos")
	} else if page < 0 {
		return nil, store.NewErrLimitExceeded("page", page, "value used in pagination while getting FileInfos")
	}
	if perPage == 0 {
		return nil, nil
	}

	if opt == nil {
		opt = &model.GetFileInfosOptions{}
	}

	query := fs.getQueryBuilder().
		Select("FileInfo.*").
		From("FileInfo")

	if len(opt.ChannelIds) > 0 {
		query = query.Join("Posts ON FileInfo.PostId = Posts.Id").
			Where(sq.Eq{"Posts.ChannelId": opt.ChannelIds})
	}

	if len(opt.UserIds) > 0 {
		query = query.Where(sq.Eq{"FileInfo.CreatorId": opt.UserIds})
	}

	if opt.Since > 0 {
		query = query.Where(sq.GtOrEq{"FileInfo.CreateAt": opt.Since})
	}

	if !opt.IncludeDeleted {
		query = query.Where("FileInfo.DeleteAt = 0")
	}

	if opt.SortBy == "" {
		opt.SortBy = model.FILEINFO_SORT_BY_CREATED
	}
	sortDirection := "ASC"
	if opt.SortDescending {
		sortDirection = "DESC"
	}

	switch opt.SortBy {
	case model.FILEINFO_SORT_BY_CREATED:
		query = query.OrderBy("FileInfo.CreateAt " + sortDirection)
	case model.FILEINFO_SORT_BY_SIZE:
		query = query.OrderBy("FileInfo.Size " + sortDirection)
	default:
		return nil, store.NewErrInvalidInput("FileInfo", "<sortOption>", opt.SortBy)
	}

	query = query.OrderBy("FileInfo.Id ASC") // secondary sort for sort stability

	query = query.Limit(uint64(perPage)).Offset(uint64(perPage * page))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "file_info_tosql")
	}
	var infos []*model.FileInfo
	if _, err := fs.GetReplica().Select(&infos, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find FileInfos")
	}
	return infos, nil
}

func (fs SqlFileInfoStore) GetByPath(path string) (*model.FileInfo, error) {
	info := &model.FileInfo{}

	if err := fs.GetReplica().SelectOne(info,
		`SELECT
				*
			FROM
				FileInfo
			WHERE
				Path = :Path
				AND DeleteAt = 0
			LIMIT 1`, map[string]interface{}{"Path": path}); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("FileInfo", fmt.Sprintf("path=%s", path))
		}

		return nil, errors.Wrapf(err, "failed to get FileInfo with path=%s", path)
	}
	return info, nil
}

func (fs SqlFileInfoStore) InvalidateFileInfosForPostCache(postId string, deleted bool) {
}

func (fs SqlFileInfoStore) GetForPost(postId string, readFromMaster, includeDeleted, allowFromCache bool) ([]*model.FileInfo, error) {
	var infos []*model.FileInfo

	dbmap := fs.GetReplica()

	if readFromMaster {
		dbmap = fs.GetMaster()
	}

	query := fs.getQueryBuilder().
		Select("*").
		From("FileInfo").
		Where(sq.Eq{"PostId": postId}).
		OrderBy("CreateAt")

	if !includeDeleted {
		query = query.Where("DeleteAt = 0")
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "file_info_tosql")
	}

	if _, err := dbmap.Select(&infos, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find FileInfos with postId=%s", postId)
	}
	return infos, nil
}

func (fs SqlFileInfoStore) GetForUser(userId string) ([]*model.FileInfo, error) {
	var infos []*model.FileInfo

	dbmap := fs.GetReplica()

	if _, err := dbmap.Select(&infos,
		`SELECT
				*
			FROM
				FileInfo
			WHERE
				CreatorId = :CreatorId
				AND DeleteAt = 0
			ORDER BY
				CreateAt`, map[string]interface{}{"CreatorId": userId}); err != nil {
		return nil, errors.Wrapf(err, "failed to find FileInfos with creatorId=%s", userId)
	}
	return infos, nil
}

func (fs SqlFileInfoStore) AttachToPost(fileId, postId, creatorId string) error {
	sqlResult, err := fs.GetMaster().Exec(`
		UPDATE
			FileInfo
		SET
			PostId = :PostId
		WHERE
			Id = :Id
			AND PostId = ''
			AND (CreatorId = :CreatorId OR CreatorId = 'nouser')
	`, map[string]interface{}{
		"PostId":    postId,
		"Id":        fileId,
		"CreatorId": creatorId,
	})
	if err != nil {
		return errors.Wrapf(err, "failed to update FileInfo with id=%s and postId=%s", fileId, postId)
	}

	count, err := sqlResult.RowsAffected()
	if err != nil {
		// RowsAffected should never fail with the MySQL or Postgres drivers
		return errors.Wrap(err, "unable to retrieve rows affected")
	} else if count == 0 {
		// Could not attach the file to the post
		return store.NewErrInvalidInput("FileInfo", "<id, postId, creatorId>", fmt.Sprintf("<%s, %s, %s>", fileId, postId, creatorId))
	}
	return nil
}

func (fs SqlFileInfoStore) DeleteForPost(postId string) (string, error) {
	if _, err := fs.GetMaster().Exec(
		`UPDATE
				FileInfo
			SET
				DeleteAt = :DeleteAt
			WHERE
				PostId = :PostId`, map[string]interface{}{"DeleteAt": model.GetMillis(), "PostId": postId}); err != nil {
		return "", errors.Wrapf(err, "failed to update FileInfo with postId=%s", postId)
	}
	return postId, nil
}

func (fs SqlFileInfoStore) PermanentDelete(fileId string) error {
	if _, err := fs.GetMaster().Exec(
		`DELETE FROM
				FileInfo
			WHERE
				Id = :FileId`, map[string]interface{}{"FileId": fileId}); err != nil {
		return errors.Wrapf(err, "failed to delete FileInfo with id=%s", fileId)
	}
	return nil
}

func (fs SqlFileInfoStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	var query string
	if fs.DriverName() == "postgres" {
		query = "DELETE from FileInfo WHERE Id = any (array (SELECT Id FROM FileInfo WHERE CreateAt < :EndTime LIMIT :Limit))"
	} else {
		query = "DELETE from FileInfo WHERE CreateAt < :EndTime LIMIT :Limit"
	}

	sqlResult, err := fs.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete FileInfos in batch")
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, errors.Wrapf(err, "unable to retrieve rows affected")
	}

	return rowsAffected, nil
}

func (fs SqlFileInfoStore) PermanentDeleteByUser(userId string) (int64, error) {
	query := "DELETE from FileInfo WHERE CreatorId = :CreatorId"

	sqlResult, err := fs.GetMaster().Exec(query, map[string]interface{}{"CreatorId": userId})
	if err != nil {
		return 0, errors.Wrapf(err, "failed to delete FileInfo with creatorId=%s", userId)
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, errors.Wrapf(err, "unable to retrieve rows affected")
	}

	return rowsAffected, nil
}
