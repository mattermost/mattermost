// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	"github.com/mattermost/mattermost-server/server/v8/einterfaces"
)

type fileInfoWithChannelID struct {
	Id              string
	CreatorId       string
	PostId          string
	ChannelId       string
	CreateAt        int64
	UpdateAt        int64
	DeleteAt        int64
	Path            string
	ThumbnailPath   string
	PreviewPath     string
	Name            string
	Extension       string
	Size            int64
	MimeType        string
	Width           int
	Height          int
	HasPreviewImage bool
	MiniPreview     *[]byte
	Content         string
	RemoteId        *string
	Archived        bool
}

func (fi fileInfoWithChannelID) ToModel() *model.FileInfo {
	return &model.FileInfo{
		Id:              fi.Id,
		CreatorId:       fi.CreatorId,
		PostId:          fi.PostId,
		ChannelId:       fi.ChannelId,
		CreateAt:        fi.CreateAt,
		UpdateAt:        fi.UpdateAt,
		DeleteAt:        fi.DeleteAt,
		Path:            fi.Path,
		ThumbnailPath:   fi.ThumbnailPath,
		PreviewPath:     fi.PreviewPath,
		Name:            fi.Name,
		Extension:       fi.Extension,
		Size:            fi.Size,
		MimeType:        fi.MimeType,
		Width:           fi.Width,
		Height:          fi.Height,
		HasPreviewImage: fi.HasPreviewImage,
		MiniPreview:     fi.MiniPreview,
		Content:         fi.Content,
		RemoteId:        fi.RemoteId,
	}
}

type SqlFileInfoStore struct {
	*SqlStore
	metrics     einterfaces.MetricsInterface
	queryFields []string
}

func (fs SqlFileInfoStore) ClearCaches() {
}

func newSqlFileInfoStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.FileInfoStore {
	s := &SqlFileInfoStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	s.queryFields = []string{
		"FileInfo.Id",
		"FileInfo.CreatorId",
		"FileInfo.PostId",
		"COALESCE(FileInfo.ChannelId, '') AS ChannelId",
		"FileInfo.CreateAt",
		"FileInfo.UpdateAt",
		"FileInfo.DeleteAt",
		"FileInfo.Path",
		"FileInfo.ThumbnailPath",
		"FileInfo.PreviewPath",
		"FileInfo.Name",
		"FileInfo.Extension",
		"FileInfo.Size",
		"FileInfo.MimeType",
		"FileInfo.Width",
		"FileInfo.Height",
		"FileInfo.HasPreviewImage",
		"FileInfo.MiniPreview",
		"Coalesce(FileInfo.Content, '') AS Content",
		"Coalesce(FileInfo.RemoteId, '') AS RemoteId",
		"FileInfo.Archived",
	}

	return s
}

func (fs SqlFileInfoStore) Save(info *model.FileInfo) (*model.FileInfo, error) {
	info.PreSave()
	if err := info.IsValid(); err != nil {
		return nil, err
	}

	query := `
		INSERT INTO FileInfo
		(Id, CreatorId, PostId, ChannelId, CreateAt, UpdateAt, DeleteAt, Path, ThumbnailPath, PreviewPath,
			Name, Extension, Size, MimeType, Width, Height, HasPreviewImage, MiniPreview, Content, RemoteId)
		VALUES
		(:Id, :CreatorId, :PostId, :ChannelId, :CreateAt, :UpdateAt, :DeleteAt, :Path, :ThumbnailPath, :PreviewPath,
			:Name, :Extension, :Size, :MimeType, :Width, :Height, :HasPreviewImage, :MiniPreview, :Content, :RemoteId)
	`

	if _, err := fs.GetMasterX().NamedExec(query, info); err != nil {
		return nil, errors.Wrap(err, "failed to save FileInfo")
	}
	return info, nil
}

func (fs SqlFileInfoStore) GetByIds(ids []string) ([]*model.FileInfo, error) {
	query := fs.getQueryBuilder().
		Select(fs.queryFields...).
		From("FileInfo").
		Where(sq.Eq{"FileInfo.Id": ids}).
		Where(sq.Eq{"FileInfo.DeleteAt": 0}).
		OrderBy("FileInfo.CreateAt DESC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "file_info_tosql")
	}

	items := []fileInfoWithChannelID{}
	if err := fs.GetReplicaX().Select(&items, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find FileInfos")
	}
	if len(items) == 0 {
		return nil, nil
	}

	infos := make([]*model.FileInfo, 0, len(items))
	for _, item := range items {
		infos = append(infos, item.ToModel())
	}
	return infos, nil
}

func (fs SqlFileInfoStore) Upsert(info *model.FileInfo) (*model.FileInfo, error) {
	info.PreSave()
	if err := info.IsValid(); err != nil {
		return nil, err
	}

	// PostID and ChannelID are deliberately ignored
	// from the list of fields to keep those two immutable.
	queryString, args, err := fs.getQueryBuilder().
		Update("FileInfo").
		SetMap(map[string]any{
			"UpdateAt":        info.UpdateAt,
			"DeleteAt":        info.DeleteAt,
			"Path":            info.Path,
			"ThumbnailPath":   info.ThumbnailPath,
			"PreviewPath":     info.PreviewPath,
			"Name":            info.Name,
			"Extension":       info.Extension,
			"Size":            info.Size,
			"MimeType":        info.MimeType,
			"Width":           info.Width,
			"Height":          info.Height,
			"HasPreviewImage": info.HasPreviewImage,
			"MiniPreview":     info.MiniPreview,
			"Content":         info.Content,
			"RemoteId":        info.RemoteId,
		}).
		Where(sq.Eq{"Id": info.Id}).
		ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "file_info_tosql")
	}

	sqlResult, err := fs.GetMasterX().Exec(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update FileInfo")
	}
	count, err := sqlResult.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "unable to retrieve rows affected")
	}
	if count == 0 {
		return fs.Save(info)
	}
	return info, nil
}

func (fs SqlFileInfoStore) get(id string, fromMaster bool) (*model.FileInfo, error) {
	info := &model.FileInfo{}

	query := fs.getQueryBuilder().
		Select(fs.queryFields...).
		From("FileInfo").
		Where(sq.Eq{"Id": id}).
		Where(sq.Eq{"DeleteAt": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "file_info_tosql")
	}

	db := fs.GetReplicaX()
	if fromMaster {
		db = fs.GetMasterX()
	}

	if err := db.Get(info, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("FileInfo", id)
		}
		return nil, errors.Wrapf(err, "failed to get FileInfo with id=%s", id)
	}
	return info, nil
}

func (fs SqlFileInfoStore) Get(id string) (*model.FileInfo, error) {
	return fs.get(id, false)
}

func (fs SqlFileInfoStore) GetFromMaster(id string) (*model.FileInfo, error) {
	return fs.get(id, true)
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
		Select(fs.queryFields...).
		From("FileInfo")

	if len(opt.ChannelIds) > 0 {
		query = query.Where(sq.Eq{"FileInfo.ChannelId": opt.ChannelIds})
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
		opt.SortBy = model.FileinfoSortByCreated
	}
	sortDirection := "ASC"
	if opt.SortDescending {
		sortDirection = "DESC"
	}

	switch opt.SortBy {
	case model.FileinfoSortByCreated:
		query = query.OrderBy("FileInfo.CreateAt " + sortDirection)
	case model.FileinfoSortBySize:
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
	infos := []*model.FileInfo{}
	if err := fs.GetReplicaX().Select(&infos, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find FileInfos")
	}
	return infos, nil
}

func (fs SqlFileInfoStore) GetByPath(path string) (*model.FileInfo, error) {
	info := &model.FileInfo{}

	query := fs.getQueryBuilder().
		Select(fs.queryFields...).
		From("FileInfo").
		Where(sq.Eq{"Path": path}).
		Where(sq.Eq{"DeleteAt": 0}).
		Limit(1)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "file_info_tosql")
	}

	if err := fs.GetReplicaX().Get(info, queryString, args...); err != nil {
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
	infos := []*model.FileInfo{}

	dbmap := fs.GetReplicaX()

	if readFromMaster {
		dbmap = fs.GetMasterX()
	}

	query := fs.getQueryBuilder().
		Select(fs.queryFields...).
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

	if err := dbmap.Select(&infos, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find FileInfos with postId=%s", postId)
	}
	return infos, nil
}

func (fs SqlFileInfoStore) GetForUser(userId string) ([]*model.FileInfo, error) {
	infos := []*model.FileInfo{}

	query := fs.getQueryBuilder().
		Select(fs.queryFields...).
		From("FileInfo").
		Where(sq.Eq{"CreatorId": userId}).
		Where(sq.Eq{"DeleteAt": 0}).
		OrderBy("CreateAt")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "file_info_tosql")
	}

	if err := fs.GetReplicaX().Select(&infos, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find FileInfos with creatorId=%s", userId)
	}
	return infos, nil
}

func (fs SqlFileInfoStore) AttachToPost(fileId, postId, channelId, creatorId string) error {
	query := fs.getQueryBuilder().
		Update("FileInfo").
		Set("PostId", postId).
		Set("ChannelId", channelId).
		Where(sq.And{
			sq.Eq{"Id": fileId},
			sq.Eq{"PostId": ""},
			sq.Or{
				sq.Eq{"CreatorId": creatorId},
				sq.Eq{"CreatorId": "nouser"},
			},
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "file_info_tosql")
	}
	sqlResult, err := fs.GetMasterX().Exec(queryString, args...)
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

func (fs SqlFileInfoStore) SetContent(fileId, content string) error {
	query := fs.getQueryBuilder().
		Update("FileInfo").
		Set("Content", content).
		Where(sq.Eq{"Id": fileId})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "file_info_tosql")
	}

	_, err = fs.GetMasterX().Exec(queryString, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to update FileInfo content with id=%s", fileId)
	}

	return nil
}

func (fs SqlFileInfoStore) DeleteForPost(postId string) (string, error) {
	if _, err := fs.GetMasterX().Exec(
		`UPDATE
				FileInfo
			SET
				DeleteAt = ?
			WHERE
				PostId = ?`, model.GetMillis(), postId); err != nil {
		return "", errors.Wrapf(err, "failed to update FileInfo with postId=%s", postId)
	}
	return postId, nil
}

func (fs SqlFileInfoStore) PermanentDelete(fileId string) error {
	if _, err := fs.GetMasterX().Exec(`DELETE FROM FileInfo WHERE Id = ?`, fileId); err != nil {
		return errors.Wrapf(err, "failed to delete FileInfo with id=%s", fileId)
	}
	return nil
}

func (fs SqlFileInfoStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	var query string
	if fs.DriverName() == "postgres" {
		query = "DELETE from FileInfo WHERE Id = any (array (SELECT Id FROM FileInfo WHERE CreateAt < ? LIMIT ?))"
	} else {
		query = "DELETE from FileInfo WHERE CreateAt < ? LIMIT ?"
	}

	sqlResult, err := fs.GetMasterX().Exec(query, endTime, limit)
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
	query := "DELETE from FileInfo WHERE CreatorId = ?"

	sqlResult, err := fs.GetMasterX().Exec(query, userId)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to delete FileInfo with creatorId=%s", userId)
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, errors.Wrapf(err, "unable to retrieve rows affected")
	}

	return rowsAffected, nil
}

func (fs SqlFileInfoStore) Search(paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.FileInfoList, error) {
	// Since we don't support paging for DB search, we just return nothing for later pages
	if page > 0 {
		return model.NewFileInfoList(), nil
	}
	if err := model.IsSearchParamsListValid(paramsList); err != nil {
		return nil, err
	}
	query := fs.getQueryBuilder().
		Select(fs.queryFields...).
		From("FileInfo").
		LeftJoin("Channels as C ON C.Id=FileInfo.ChannelId").
		LeftJoin("ChannelMembers as CM ON C.Id=CM.ChannelId").
		Where(sq.Eq{"FileInfo.DeleteAt": 0}).
		OrderBy("FileInfo.CreateAt DESC").
		Limit(100)

	if teamId != "" {
		query = query.Where(sq.Or{
			sq.Eq{"C.TeamId": teamId},
			sq.Eq{"C.TeamId": ""},
		})
	}

	now := model.GetMillis()
	for _, params := range paramsList {
		if params.Modifier == model.ModifierFiles {
			// Deliberately keeping non-alphanumeric characters to
			// prevent surprises in UI.
			buf, err := json.Marshal(params)
			if err != nil {
				return nil, err
			}

			err = fs.stores.post.LogRecentSearch(userId, buf, now)
			if err != nil {
				return nil, err
			}
		}

		params.Terms = removeNonAlphaNumericUnquotedTerms(params.Terms, " ")

		if !params.IncludeDeletedChannels {
			query = query.Where(sq.Eq{"C.DeleteAt": 0})
		}

		if !params.SearchWithoutUserId {
			query = query.Where(sq.Eq{"CM.UserId": userId})
		}

		if len(params.InChannels) != 0 {
			query = query.Where(sq.Eq{"C.Id": params.InChannels})
		}

		if len(params.Extensions) != 0 {
			query = query.Where(sq.Eq{"FileInfo.Extension": params.Extensions})
		}

		if len(params.ExcludedExtensions) != 0 {
			query = query.Where(sq.NotEq{"FileInfo.Extension": params.ExcludedExtensions})
		}

		if len(params.ExcludedChannels) != 0 {
			query = query.Where(sq.NotEq{"C.Id": params.ExcludedChannels})
		}

		if len(params.FromUsers) != 0 {
			query = query.Where(sq.Eq{"FileInfo.CreatorId": params.FromUsers})
		}

		if len(params.ExcludedUsers) != 0 {
			query = query.Where(sq.NotEq{"FileInfo.CreatorId": params.ExcludedUsers})
		}

		// handle after: before: on: filters
		if params.OnDate != "" {
			onDateStart, onDateEnd := params.GetOnDateMillis()
			query = query.Where(sq.Expr("FileInfo.CreateAt BETWEEN ? AND ?", strconv.FormatInt(onDateStart, 10), strconv.FormatInt(onDateEnd, 10)))
		} else {
			if params.ExcludedDate != "" {
				excludedDateStart, excludedDateEnd := params.GetExcludedDateMillis()
				query = query.Where(sq.Expr("FileInfo.CreateAt NOT BETWEEN ? AND ?", strconv.FormatInt(excludedDateStart, 10), strconv.FormatInt(excludedDateEnd, 10)))
			}

			if params.AfterDate != "" {
				afterDate := params.GetAfterDateMillis()
				query = query.Where(sq.GtOrEq{"FileInfo.CreateAt": strconv.FormatInt(afterDate, 10)})
			}

			if params.BeforeDate != "" {
				beforeDate := params.GetBeforeDateMillis()
				query = query.Where(sq.LtOrEq{"FileInfo.CreateAt": strconv.FormatInt(beforeDate, 10)})
			}

			if params.ExcludedAfterDate != "" {
				afterDate := params.GetExcludedAfterDateMillis()
				query = query.Where(sq.Lt{"FileInfo.CreateAt": strconv.FormatInt(afterDate, 10)})
			}

			if params.ExcludedBeforeDate != "" {
				beforeDate := params.GetExcludedBeforeDateMillis()
				query = query.Where(sq.Gt{"FileInfo.CreateAt": strconv.FormatInt(beforeDate, 10)})
			}
		}

		terms := params.Terms
		excludedTerms := params.ExcludedTerms

		for _, c := range fs.specialSearchChars() {
			terms = strings.Replace(terms, c, " ", -1)
			excludedTerms = strings.Replace(excludedTerms, c, " ", -1)
		}

		if terms == "" && excludedTerms == "" {
			// we've already confirmed that we have a channel or user to search for
		} else if fs.DriverName() == model.DatabaseDriverPostgres {
			// Parse text for wildcards
			if wildcard, err := regexp.Compile(`\*($| )`); err == nil {
				excludedTerms = wildcard.ReplaceAllLiteralString(excludedTerms, ":* ")
			}

			excludeClause := ""
			if excludedTerms != "" {
				excludeClause = " & !(" + strings.Join(strings.Fields(excludedTerms), " | ") + ")"
			}

			wildcardAddedTerms := strings.Fields(terms)
			wildcardRegExp, regExpErr := regexp.Compile(`\*?$`)

			if regExpErr == nil {
				for index, term := range wildcardAddedTerms {
					wildcardAddedTerms[index] = wildcardRegExp.ReplaceAllLiteralString(term, ":*")
				}
			}

			queryTerms := ""
			if params.OrTerms {
				queryTerms = "(" + strings.Join(wildcardAddedTerms, " | ") + ")" + excludeClause
			} else {
				queryTerms = "(" + strings.Join(wildcardAddedTerms, " & ") + ")" + excludeClause
			}

			query = query.Where(sq.Or{
				sq.Expr(fmt.Sprintf("to_tsvector('%[1]s', FileInfo.Name) @@  to_tsquery('%[1]s', ?)", fs.pgDefaultTextSearchConfig), queryTerms),
				sq.Expr(fmt.Sprintf("to_tsvector('%[1]s', Translate(FileInfo.Name, '.,-', '   ')) @@  to_tsquery('%[1]s', ?)", fs.pgDefaultTextSearchConfig), queryTerms),
				sq.Expr(fmt.Sprintf("to_tsvector('%[1]s', FileInfo.Content) @@  to_tsquery('%[1]s', ?)", fs.pgDefaultTextSearchConfig), queryTerms),
			})
		} else if fs.DriverName() == model.DatabaseDriverMysql {
			var err error
			terms, err = removeMysqlStopWordsFromTerms(terms)
			if err != nil {
				return nil, errors.Wrap(err, "failed to remove Mysql stop-words from terms")
			}

			if terms == "" {
				return model.NewFileInfoList(), nil
			}

			wildcardAddedTerms := strings.Fields(terms)
			wildcardRegExp, regExpErr := regexp.Compile(`\*?$`)

			if regExpErr == nil {
				for index, term := range wildcardAddedTerms {
					wildcardAddedTerms[index] = wildcardRegExp.ReplaceAllLiteralString(term, "*")
				}
			}

			excludeClause := ""
			if excludedTerms != "" {
				excludeClause = " -(" + excludedTerms + ")"
			}

			queryTerms := ""
			if params.OrTerms {
				queryTerms = strings.Join(wildcardAddedTerms, " ") + excludeClause
			} else {
				splitTerms := []string{}
				for _, t := range wildcardAddedTerms {
					splitTerms = append(splitTerms, "+"+t)
				}
				queryTerms = strings.Join(splitTerms, " ") + excludeClause
			}
			query = query.Where(sq.Or{
				sq.Expr("MATCH (FileInfo.Name) AGAINST (? IN BOOLEAN MODE)", queryTerms),
				sq.Expr("MATCH (FileInfo.Content) AGAINST (? IN BOOLEAN MODE)", queryTerms),
			})
		}
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "file_info_tosql")
	}

	list := model.NewFileInfoList()

	items := []fileInfoWithChannelID{}
	err = fs.GetSearchReplicaX().Select(&items, queryString, args...)
	if err != nil {
		mlog.Warn("Query error searching files.", mlog.String("error", trimInput(err.Error())))
		// Don't return the error to the caller as it is of no use to the user. Instead return an empty set of search results.
	} else {
		for _, item := range items {
			info := item.ToModel()
			list.AddFileInfo(info)
			list.AddOrder(info.Id)
		}
	}
	list.MakeNonNil()
	return list, nil
}

func (fs SqlFileInfoStore) CountAll() (int64, error) {
	query := fs.getQueryBuilder().
		Select("COUNT(*)").
		From("FileInfo").
		Where("DeleteAt = 0")

	queryString, args, err := query.ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "count_tosql")
	}

	var count int64
	err = fs.GetReplicaX().Get(&count, queryString, args...)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to count Files")
	}
	return count, nil
}

func (fs SqlFileInfoStore) GetFilesBatchForIndexing(startTime int64, startFileID string, limit int) ([]*model.FileForIndexing, error) {
	files := []*model.FileForIndexing{}
	sql, args, _ := fs.getQueryBuilder().
		Select(fs.queryFields...).
		From("FileInfo").
		Where(sq.Or{
			sq.Gt{"FileInfo.CreateAt": startTime},
			sq.And{
				sq.Eq{"FileInfo.CreateAt": startTime},
				sq.Gt{"FileInfo.Id": startFileID},
			},
		}).
		OrderBy("FileInfo.CreateAt ASC, FileInfo.Id ASC").
		Limit(uint64(limit)).
		ToSql()

	err := fs.GetSearchReplicaX().Select(&files, sql, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Files")
	}

	return files, nil
}

func (fs SqlFileInfoStore) GetStorageUsage(allowFromCache, includeDeleted bool) (int64, error) {
	query := fs.getQueryBuilder().
		Select("COALESCE(SUM(Size), 0)").
		From("FileInfo")

	if !includeDeleted {
		query = query.Where("DeleteAt = 0")
	}

	var size int64
	err := fs.GetReplicaX().GetBuilder(&size, query)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to get storage usage")
	}
	return size, nil
}

// GetUptoNSizeFileTime returns the CreateAt time of the last accessible file with a running-total size upto n bytes.
func (fs *SqlFileInfoStore) GetUptoNSizeFileTime(n int64) (int64, error) {
	if n <= 0 {
		return 0, errors.New("n can't be less than 1")
	}

	var sizeSubQuery sq.SelectBuilder
	// Separate query for MySql, as current min-version 5.x doesn't support window-functions
	if fs.DriverName() == model.DatabaseDriverMysql {
		sizeSubQuery = sq.
			Select("(@runningSum := @runningSum + fi.Size) RunningTotal", "fi.CreateAt").
			From("FileInfo fi").
			Join("(SELECT @runningSum := 0) as tmp").
			Where(sq.Eq{"fi.DeleteAt": 0}).
			OrderBy("fi.CreateAt DESC, fi.Id")
	} else {
		sizeSubQuery = sq.
			Select("SUM(fi.Size) OVER(ORDER BY CreateAt DESC, fi.Id) RunningTotal", "fi.CreateAt").
			From("FileInfo fi").
			Where(sq.Eq{"fi.DeleteAt": 0})
	}

	builder := fs.getQueryBuilder().
		Select("fi2.CreateAt").
		FromSelect(sizeSubQuery, "fi2").
		Where(sq.LtOrEq{"fi2.RunningTotal": n}).
		OrderBy("fi2.CreateAt").
		Limit(1)

	query, queryArgs, err := builder.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "GetUptoNSizeFileTime_tosql")
	}

	var createAt int64
	if err := fs.GetReplicaX().Get(&createAt, query, queryArgs...); err != nil {
		if err == sql.ErrNoRows {
			return 0, store.NewErrNotFound("File", "none")
		}

		return 0, errors.Wrapf(err, "failed to get the File for size upto=%d", n)
	}

	return createAt, nil
}
