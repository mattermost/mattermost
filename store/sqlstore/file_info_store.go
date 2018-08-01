// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

type SqlFileInfoStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

const (
	FILE_INFO_CACHE_SIZE = 25000
	FILE_INFO_CACHE_SEC  = 1800 // 30 minutes
)

var fileInfoCache *utils.Cache = utils.NewLru(FILE_INFO_CACHE_SIZE)

func (fs SqlFileInfoStore) ClearCaches() {
	fileInfoCache.Purge()
	if fs.metrics != nil {
		fs.metrics.IncrementMemCacheInvalidationCounter("File Info Cache - Purge")
	}
}

func NewSqlFileInfoStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.FileInfoStore {
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

func (fs SqlFileInfoStore) CreateIndexesIfNotExists() {
	fs.CreateIndexIfNotExists("idx_fileinfo_update_at", "FileInfo", "UpdateAt")
	fs.CreateIndexIfNotExists("idx_fileinfo_create_at", "FileInfo", "CreateAt")
	fs.CreateIndexIfNotExists("idx_fileinfo_delete_at", "FileInfo", "DeleteAt")
	fs.CreateIndexIfNotExists("idx_fileinfo_postid_at", "FileInfo", "PostId")
}

func (fs SqlFileInfoStore) Save(info *model.FileInfo) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		info.PreSave()
		if result.Err = info.IsValid(); result.Err != nil {
			return
		}

		if err := fs.GetMaster().Insert(info); err != nil {
			result.Err = model.NewAppError("SqlFileInfoStore.Save", "store.sql_file_info.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = info
		}
	})
}

func (fs SqlFileInfoStore) Get(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
				result.Err = model.NewAppError("SqlFileInfoStore.Get", "store.sql_file_info.get.app_error", nil, "id="+id+", "+err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlFileInfoStore.Get", "store.sql_file_info.get.app_error", nil, "id="+id+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			result.Data = info
		}
	})
}

func (fs SqlFileInfoStore) GetByPath(path string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlFileInfoStore.GetByPath", "store.sql_file_info.get_by_path.app_error", nil, "path="+path+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = info
		}
	})
}

func (fs SqlFileInfoStore) InvalidateFileInfosForPostCache(postId string) {
	fileInfoCache.Remove(postId)
	if fs.metrics != nil {
		fs.metrics.IncrementMemCacheInvalidationCounter("File Info Cache - Remove by PostId")
	}
}

func (fs SqlFileInfoStore) GetForPost(postId string, readFromMaster bool, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if cacheItem, ok := fileInfoCache.Get(postId); ok {
				if fs.metrics != nil {
					fs.metrics.IncrementMemCacheHitCounter("File Info Cache")
				}

				result.Data = cacheItem.([]*model.FileInfo)
				return
			} else {
				if fs.metrics != nil {
					fs.metrics.IncrementMemCacheMissCounter("File Info Cache")
				}
			}
		} else {
			if fs.metrics != nil {
				fs.metrics.IncrementMemCacheMissCounter("File Info Cache")
			}
		}

		var infos []*model.FileInfo

		dbmap := fs.GetReplica()

		if readFromMaster {
			dbmap = fs.GetMaster()
		}

		if _, err := dbmap.Select(&infos,
			`SELECT
				*
			FROM
				FileInfo
			WHERE
				PostId = :PostId
				AND DeleteAt = 0
			ORDER BY
				CreateAt`, map[string]interface{}{"PostId": postId}); err != nil {
			result.Err = model.NewAppError("SqlFileInfoStore.GetForPost",
				"store.sql_file_info.get_for_post.app_error", nil, "post_id="+postId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			if len(infos) > 0 {
				fileInfoCache.AddWithExpiresInSecs(postId, infos, FILE_INFO_CACHE_SEC)
			}

			result.Data = infos
		}
	})
}

func (fs SqlFileInfoStore) GetForUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlFileInfoStore.GetForPost",
				"store.sql_file_info.get_for_user_id.app_error", nil, "creator_id="+userId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = infos
		}
	})
}

func (fs SqlFileInfoStore) AttachToPost(fileId, postId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := fs.GetMaster().Exec(
			`UPDATE
					FileInfo
				SET
					PostId = :PostId
				WHERE
					Id = :Id
					AND PostId = ''`, map[string]interface{}{"PostId": postId, "Id": fileId}); err != nil {
			result.Err = model.NewAppError("SqlFileInfoStore.AttachToPost",
				"store.sql_file_info.attach_to_post.app_error", nil, "post_id="+postId+", file_id="+fileId+", err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (fs SqlFileInfoStore) DeleteForPost(postId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := fs.GetMaster().Exec(
			`UPDATE
				FileInfo
			SET
				DeleteAt = :DeleteAt
			WHERE
				PostId = :PostId`, map[string]interface{}{"DeleteAt": model.GetMillis(), "PostId": postId}); err != nil {
			result.Err = model.NewAppError("SqlFileInfoStore.DeleteForPost",
				"store.sql_file_info.delete_for_post.app_error", nil, "post_id="+postId+", err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = postId
		}
	})
}

func (fs SqlFileInfoStore) PermanentDelete(fileId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := fs.GetMaster().Exec(
			`DELETE FROM
				FileInfo
			WHERE
				Id = :FileId`, map[string]interface{}{"FileId": fileId}); err != nil {
			result.Err = model.NewAppError("SqlFileInfoStore.PermanentDelete",
				"store.sql_file_info.permanent_delete.app_error", nil, "file_id="+fileId+", err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlFileInfoStore) PermanentDeleteBatch(endTime int64, limit int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var query string
		if s.DriverName() == "postgres" {
			query = "DELETE from FileInfo WHERE Id = any (array (SELECT Id FROM FileInfo WHERE CreateAt < :EndTime LIMIT :Limit))"
		} else {
			query = "DELETE from FileInfo WHERE CreateAt < :EndTime LIMIT :Limit"
		}

		sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
		if err != nil {
			result.Err = model.NewAppError("SqlFileInfoStore.PermanentDeleteBatch", "store.sql_file_info.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
		} else {
			rowsAffected, err1 := sqlResult.RowsAffected()
			if err1 != nil {
				result.Err = model.NewAppError("SqlFileInfoStore.PermanentDeleteBatch", "store.sql_file_info.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
				result.Data = int64(0)
			} else {
				result.Data = rowsAffected
			}
		}
	})
}

func (s SqlFileInfoStore) PermanentDeleteByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := "DELETE from FileInfo WHERE CreatorId = :CreatorId"

		sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"CreatorId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlFileInfoStore.PermanentDeleteByUser", "store.sql_file_info.PermanentDeleteByUser.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
		} else {
			rowsAffected, err1 := sqlResult.RowsAffected()
			if err1 != nil {
				result.Err = model.NewAppError("SqlFileInfoStore.PermanentDeleteByUser", "store.sql_file_info.PermanentDeleteByUser.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
				result.Data = int64(0)
			} else {
				result.Data = rowsAffected
			}
		}
	})
}
