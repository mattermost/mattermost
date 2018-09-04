// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"bytes"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

type SqlPostStore struct {
	SqlStore
	metrics           einterfaces.MetricsInterface
	lastPostTimeCache *utils.Cache
	lastPostsCache    *utils.Cache
	maxPostSizeOnce   sync.Once
	maxPostSizeCached int
}

const (
	LAST_POST_TIME_CACHE_SIZE = 25000
	LAST_POST_TIME_CACHE_SEC  = 900 // 15 minutes

	LAST_POSTS_CACHE_SIZE = 1000
	LAST_POSTS_CACHE_SEC  = 900 // 15 minutes
)

func (s *SqlPostStore) ClearCaches() {
	s.lastPostTimeCache.Purge()
	s.lastPostsCache.Purge()

	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Last Post Time - Purge")
		s.metrics.IncrementMemCacheInvalidationCounter("Last Posts Cache - Purge")
	}
}

func NewSqlPostStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.PostStore {
	s := &SqlPostStore{
		SqlStore:          sqlStore,
		metrics:           metrics,
		lastPostTimeCache: utils.NewLru(LAST_POST_TIME_CACHE_SIZE),
		lastPostsCache:    utils.NewLru(LAST_POSTS_CACHE_SIZE),
		maxPostSizeCached: model.POST_MESSAGE_MAX_RUNES_V1,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Post{}, "Posts").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("ChannelId").SetMaxSize(26)
		table.ColMap("RootId").SetMaxSize(26)
		table.ColMap("ParentId").SetMaxSize(26)
		table.ColMap("OriginalId").SetMaxSize(26)
		table.ColMap("Message").SetMaxSize(model.POST_MESSAGE_MAX_BYTES_V2)
		table.ColMap("Type").SetMaxSize(26)
		table.ColMap("Hashtags").SetMaxSize(1000)
		table.ColMap("Props").SetMaxSize(8000)
		table.ColMap("Filenames").SetMaxSize(model.POST_FILENAMES_MAX_RUNES)
		table.ColMap("FileIds").SetMaxSize(150)
	}

	return s
}

func (s *SqlPostStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_posts_update_at", "Posts", "UpdateAt")
	s.CreateIndexIfNotExists("idx_posts_create_at", "Posts", "CreateAt")
	s.CreateIndexIfNotExists("idx_posts_delete_at", "Posts", "DeleteAt")
	s.CreateIndexIfNotExists("idx_posts_channel_id", "Posts", "ChannelId")
	s.CreateIndexIfNotExists("idx_posts_root_id", "Posts", "RootId")
	s.CreateIndexIfNotExists("idx_posts_user_id", "Posts", "UserId")
	s.CreateIndexIfNotExists("idx_posts_is_pinned", "Posts", "IsPinned")

	s.CreateCompositeIndexIfNotExists("idx_posts_channel_id_update_at", "Posts", []string{"ChannelId", "UpdateAt"})
	s.CreateCompositeIndexIfNotExists("idx_posts_channel_id_delete_at_create_at", "Posts", []string{"ChannelId", "DeleteAt", "CreateAt"})

	s.CreateFullTextIndexIfNotExists("idx_posts_message_txt", "Posts", "Message")
	s.CreateFullTextIndexIfNotExists("idx_posts_hashtags_txt", "Posts", "Hashtags")
}

func (s *SqlPostStore) Save(post *model.Post) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(post.Id) > 0 {
			result.Err = model.NewAppError("SqlPostStore.Save", "store.sql_post.save.existing.app_error", nil, "id="+post.Id, http.StatusBadRequest)
			return
		}

		var maxPostSize int
		if result := <-s.GetMaxPostSize(); result.Err != nil {
			result.Err = model.NewAppError("SqlPostStore.Save", "store.sql_post.save.app_error", nil, "id="+post.Id+", "+result.Err.Error(), http.StatusInternalServerError)
			return
		} else {
			maxPostSize = result.Data.(int)
		}

		post.PreSave()
		if result.Err = post.IsValid(maxPostSize); result.Err != nil {
			return
		}

		if err := s.GetMaster().Insert(post); err != nil {
			result.Err = model.NewAppError("SqlPostStore.Save", "store.sql_post.save.app_error", nil, "id="+post.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			time := post.UpdateAt

			if post.Type != model.POST_JOIN_LEAVE && post.Type != model.POST_ADD_REMOVE &&
				post.Type != model.POST_JOIN_CHANNEL && post.Type != model.POST_LEAVE_CHANNEL &&
				post.Type != model.POST_JOIN_TEAM && post.Type != model.POST_LEAVE_TEAM &&
				post.Type != model.POST_ADD_TO_CHANNEL && post.Type != model.POST_REMOVE_FROM_CHANNEL {
				s.GetMaster().Exec("UPDATE Channels SET LastPostAt = :LastPostAt, TotalMsgCount = TotalMsgCount + 1 WHERE Id = :ChannelId", map[string]interface{}{"LastPostAt": time, "ChannelId": post.ChannelId})
			} else {
				// don't update TotalMsgCount for unimportant messages so that the channel isn't marked as unread
				s.GetMaster().Exec("UPDATE Channels SET LastPostAt = :LastPostAt WHERE Id = :ChannelId", map[string]interface{}{"LastPostAt": time, "ChannelId": post.ChannelId})
			}

			if len(post.RootId) > 0 {
				s.GetMaster().Exec("UPDATE Posts SET UpdateAt = :UpdateAt WHERE Id = :RootId", map[string]interface{}{"UpdateAt": time, "RootId": post.RootId})
			}

			result.Data = post
		}
	})
}

func (s *SqlPostStore) Update(newPost *model.Post, oldPost *model.Post) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		newPost.UpdateAt = model.GetMillis()
		newPost.PreCommit()

		oldPost.DeleteAt = newPost.UpdateAt
		oldPost.UpdateAt = newPost.UpdateAt
		oldPost.OriginalId = oldPost.Id
		oldPost.Id = model.NewId()
		oldPost.PreCommit()

		var maxPostSize int
		if result := <-s.GetMaxPostSize(); result.Err != nil {
			result.Err = model.NewAppError("SqlPostStore.Save", "store.sql_post.update.app_error", nil, "id="+newPost.Id+", "+result.Err.Error(), http.StatusInternalServerError)
			return
		} else {
			maxPostSize = result.Data.(int)
		}

		if result.Err = newPost.IsValid(maxPostSize); result.Err != nil {
			return
		}

		if _, err := s.GetMaster().Update(newPost); err != nil {
			result.Err = model.NewAppError("SqlPostStore.Update", "store.sql_post.update.app_error", nil, "id="+newPost.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			time := model.GetMillis()
			s.GetMaster().Exec("UPDATE Channels SET LastPostAt = :LastPostAt  WHERE Id = :ChannelId", map[string]interface{}{"LastPostAt": time, "ChannelId": newPost.ChannelId})

			if len(newPost.RootId) > 0 {
				s.GetMaster().Exec("UPDATE Posts SET UpdateAt = :UpdateAt WHERE Id = :RootId", map[string]interface{}{"UpdateAt": time, "RootId": newPost.RootId})
			}

			// mark the old post as deleted
			s.GetMaster().Insert(oldPost)

			result.Data = newPost
		}
	})
}

func (s *SqlPostStore) Overwrite(post *model.Post) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		post.UpdateAt = model.GetMillis()

		var maxPostSize int
		if result := <-s.GetMaxPostSize(); result.Err != nil {
			result.Err = model.NewAppError("SqlPostStore.Save", "store.sql_post.overwrite.app_error", nil, "id="+post.Id+", "+result.Err.Error(), http.StatusInternalServerError)
			return
		} else {
			maxPostSize = result.Data.(int)
		}

		if result.Err = post.IsValid(maxPostSize); result.Err != nil {
			return
		}

		if _, err := s.GetMaster().Update(post); err != nil {
			result.Err = model.NewAppError("SqlPostStore.Overwrite", "store.sql_post.overwrite.app_error", nil, "id="+post.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = post
		}
	})
}

func (s *SqlPostStore) GetFlaggedPosts(userId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		pl := model.NewPostList()

		var posts []*model.Post
		if _, err := s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE Id IN (SELECT Name FROM Preferences WHERE UserId = :UserId AND Category = :Category) AND DeleteAt = 0 ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"UserId": userId, "Category": model.PREFERENCE_CATEGORY_FLAGGED_POST, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetFlaggedPosts", "store.sql_post.get_flagged_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			for _, post := range posts {
				pl.AddPost(post)
				pl.AddOrder(post.Id)
			}
		}

		result.Data = pl
	})
}

func (s *SqlPostStore) GetFlaggedPostsForTeam(userId, teamId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		pl := model.NewPostList()

		var posts []*model.Post

		query := `
            SELECT
                A.*
            FROM
                (SELECT
                    *
                FROM
                    Posts
                WHERE
                    Id
                IN
                    (SELECT
                        Name
                    FROM
                        Preferences
                    WHERE
                        UserId = :UserId
                        AND Category = :Category)
                        AND DeleteAt = 0
                ) as A
            INNER JOIN Channels as B
                ON B.Id = A.ChannelId
            WHERE B.TeamId = :TeamId OR B.TeamId = ''
            ORDER BY CreateAt DESC
            LIMIT :Limit OFFSET :Offset`

		if _, err := s.GetReplica().Select(&posts, query, map[string]interface{}{"UserId": userId, "Category": model.PREFERENCE_CATEGORY_FLAGGED_POST, "Offset": offset, "Limit": limit, "TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetFlaggedPostsForTeam", "store.sql_post.get_flagged_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			for _, post := range posts {
				pl.AddPost(post)
				pl.AddOrder(post.Id)
			}
		}

		result.Data = pl
	})
}

func (s *SqlPostStore) GetFlaggedPostsForChannel(userId, channelId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		pl := model.NewPostList()

		var posts []*model.Post
		query := `
			SELECT 
				* 
			FROM Posts 
			WHERE 
				Id IN (SELECT Name FROM Preferences WHERE UserId = :UserId AND Category = :Category) 
				AND ChannelId = :ChannelId
				AND DeleteAt = 0 
			ORDER BY CreateAt DESC 
			LIMIT :Limit OFFSET :Offset`

		if _, err := s.GetReplica().Select(&posts, query, map[string]interface{}{"UserId": userId, "Category": model.PREFERENCE_CATEGORY_FLAGGED_POST, "ChannelId": channelId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetFlaggedPostsForChannel", "store.sql_post.get_flagged_posts.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			for _, post := range posts {
				pl.AddPost(post)
				pl.AddOrder(post.Id)
			}
		}

		result.Data = pl
	})
}

func (s *SqlPostStore) Get(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		pl := model.NewPostList()

		if len(id) == 0 {
			result.Err = model.NewAppError("SqlPostStore.GetPost", "store.sql_post.get.app_error", nil, "id="+id, http.StatusBadRequest)
			return
		}

		var post model.Post
		err := s.GetReplica().SelectOne(&post, "SELECT * FROM Posts WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetPost", "store.sql_post.get.app_error", nil, "id="+id+err.Error(), http.StatusNotFound)
			return
		}

		pl.AddPost(&post)
		pl.AddOrder(id)

		rootId := post.RootId

		if rootId == "" {
			rootId = post.Id
		}

		if len(rootId) == 0 {
			result.Err = model.NewAppError("SqlPostStore.GetPost", "store.sql_post.get.app_error", nil, "root_id="+rootId, http.StatusInternalServerError)
			return
		}

		var posts []*model.Post
		_, err = s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE (Id = :Id OR RootId = :RootId) AND DeleteAt = 0", map[string]interface{}{"Id": rootId, "RootId": rootId})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetPost", "store.sql_post.get.app_error", nil, "root_id="+rootId+err.Error(), http.StatusInternalServerError)
			return
		} else {
			for _, p := range posts {
				pl.AddPost(p)
			}
		}

		result.Data = pl
	})
}

func (s *SqlPostStore) GetSingle(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var post model.Post
		err := s.GetReplica().SelectOne(&post, "SELECT * FROM Posts WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetSingle", "store.sql_post.get.app_error", nil, "id="+id+err.Error(), http.StatusNotFound)
		}

		result.Data = &post
	})
}

type etagPosts struct {
	Id       string
	UpdateAt int64
}

func (s *SqlPostStore) InvalidateLastPostTimeCache(channelId string) {
	s.lastPostTimeCache.Remove(channelId)

	// Keys are "{channelid}{limit}" and caching only occurs on limits of 30 and 60
	s.lastPostsCache.Remove(channelId + "30")
	s.lastPostsCache.Remove(channelId + "60")

	if s.metrics != nil {
		s.metrics.IncrementMemCacheInvalidationCounter("Last Post Time - Remove by Channel Id")
		s.metrics.IncrementMemCacheInvalidationCounter("Last Posts Cache - Remove by Channel Id")
	}
}

func (s *SqlPostStore) GetEtag(channelId string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if cacheItem, ok := s.lastPostTimeCache.Get(channelId); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("Last Post Time")
				}
				result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, cacheItem.(int64))
				return
			} else {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter("Last Post Time")
				}
			}
		} else {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheMissCounter("Last Post Time")
			}
		}

		var et etagPosts
		err := s.GetReplica().SelectOne(&et, "SELECT Id, UpdateAt FROM Posts WHERE ChannelId = :ChannelId ORDER BY UpdateAt DESC LIMIT 1", map[string]interface{}{"ChannelId": channelId})
		if err != nil {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
		} else {
			result.Data = fmt.Sprintf("%v.%v", model.CurrentVersion, et.UpdateAt)
		}

		s.lastPostTimeCache.AddWithExpiresInSecs(channelId, et.UpdateAt, LAST_POST_TIME_CACHE_SEC)
	})
}

func (s *SqlPostStore) Delete(postId string, time int64, deleteByID string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {

		appErr := func(errMsg string) *model.AppError {
			return model.NewAppError("SqlPostStore.Delete", "store.sql_post.delete.app_error", nil, "id="+postId+", err="+errMsg, http.StatusInternalServerError)
		}

		var post model.Post
		err := s.GetReplica().SelectOne(&post, "SELECT * FROM Posts WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": postId})
		if err != nil {
			result.Err = appErr(err.Error())
		}

		post.Props[model.POST_PROPS_DELETE_BY] = deleteByID

		_, err = s.GetMaster().Exec("UPDATE Posts SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt, Props = :Props WHERE Id = :Id OR RootId = :RootId", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": postId, "RootId": postId, "Props": model.StringInterfaceToJson(post.Props)})
		if err != nil {
			result.Err = appErr(err.Error())
		}
	})
}

func (s *SqlPostStore) permanentDelete(postId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM Posts WHERE Id = :Id OR RootId = :RootId", map[string]interface{}{"Id": postId, "RootId": postId})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.Delete", "store.sql_post.permanent_delete.app_error", nil, "id="+postId+", err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s *SqlPostStore) permanentDeleteAllCommentByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := s.GetMaster().Exec("DELETE FROM Posts WHERE UserId = :UserId AND RootId != ''", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.permanentDeleteAllCommentByUser", "store.sql_post.permanent_delete_all_comments_by_user.app_error", nil, "userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s *SqlPostStore) PermanentDeleteByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		// First attempt to delete all the comments for a user
		if r := <-s.permanentDeleteAllCommentByUser(userId); r.Err != nil {
			result.Err = r.Err
			return
		}

		// Now attempt to delete all the root posts for a user.  This will also
		// delete all the comments for each post.
		found := true
		count := 0

		for found {
			var ids []string
			_, err := s.GetMaster().Select(&ids, "SELECT Id FROM Posts WHERE UserId = :UserId LIMIT 1000", map[string]interface{}{"UserId": userId})
			if err != nil {
				result.Err = model.NewAppError("SqlPostStore.PermanentDeleteByUser.select", "store.sql_post.permanent_delete_by_user.app_error", nil, "userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
				return
			} else {
				found = false
				for _, id := range ids {
					found = true
					if r := <-s.permanentDelete(id); r.Err != nil {
						result.Err = r.Err
						return
					}
				}
			}

			// This is a fail safe, give up if more than 10K messages
			count = count + 1
			if count >= 10 {
				result.Err = model.NewAppError("SqlPostStore.PermanentDeleteByUser.toolarge", "store.sql_post.permanent_delete_by_user.too_many.app_error", nil, "userId="+userId, http.StatusInternalServerError)
				return
			}
		}
	})
}

func (s *SqlPostStore) PermanentDeleteByChannel(channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM Posts WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId}); err != nil {
			result.Err = model.NewAppError("SqlPostStore.PermanentDeleteByChannel", "store.sql_post.permanent_delete_by_channel.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s *SqlPostStore) GetPosts(channelId string, offset int, limit int, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if limit > 1000 {
			result.Err = model.NewAppError("SqlPostStore.GetLinearPosts", "store.sql_post.get_posts.app_error", nil, "channelId="+channelId, http.StatusBadRequest)
			return
		}

		// Caching only occurs on limits of 30 and 60, the common limits requested by MM clients
		if allowFromCache && offset == 0 && (limit == 60 || limit == 30) {
			if cacheItem, ok := s.lastPostsCache.Get(fmt.Sprintf("%s%v", channelId, limit)); ok {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("Last Posts Cache")
				}

				result.Data = cacheItem.(*model.PostList)
				return
			} else {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter("Last Posts Cache")
				}
			}
		} else {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheMissCounter("Last Posts Cache")
			}
		}

		rpc := s.getRootPosts(channelId, offset, limit)
		cpc := s.getParentsPosts(channelId, offset, limit)

		if rpr := <-rpc; rpr.Err != nil {
			result.Err = rpr.Err
		} else if cpr := <-cpc; cpr.Err != nil {
			result.Err = cpr.Err
		} else {
			posts := rpr.Data.([]*model.Post)
			parents := cpr.Data.([]*model.Post)

			list := model.NewPostList()

			for _, p := range posts {
				list.AddPost(p)
				list.AddOrder(p.Id)
			}

			for _, p := range parents {
				list.AddPost(p)
			}

			list.MakeNonNil()

			// Caching only occurs on limits of 30 and 60, the common limits requested by MM clients
			if offset == 0 && (limit == 60 || limit == 30) {
				s.lastPostsCache.AddWithExpiresInSecs(fmt.Sprintf("%s%v", channelId, limit), list, LAST_POSTS_CACHE_SEC)
			}

			result.Data = list
		}
	})
}

func (s *SqlPostStore) GetPostsSince(channelId string, time int64, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			// If the last post in the channel's time is less than or equal to the time we are getting posts since,
			// we can safely return no posts.
			if cacheItem, ok := s.lastPostTimeCache.Get(channelId); ok && cacheItem.(int64) <= time {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheHitCounter("Last Post Time")
				}
				list := model.NewPostList()
				result.Data = list
				return
			} else {
				if s.metrics != nil {
					s.metrics.IncrementMemCacheMissCounter("Last Post Time")
				}
			}
		} else {
			if s.metrics != nil {
				s.metrics.IncrementMemCacheMissCounter("Last Post Time")
			}
		}

		var posts []*model.Post
		_, err := s.GetReplica().Select(&posts,
			`(SELECT
			    *
			FROM
			    Posts
			WHERE
			    (UpdateAt > :Time
			        AND ChannelId = :ChannelId)
			LIMIT 1000)
			UNION
			(SELECT
			    *
			FROM
			    Posts
			WHERE
			    Id
			IN
			    (SELECT * FROM (SELECT
			        RootId
			    FROM
			        Posts
			    WHERE
			        UpdateAt > :Time
			            AND ChannelId = :ChannelId
			    LIMIT 1000) temp_tab))
			ORDER BY CreateAt DESC`,
			map[string]interface{}{"ChannelId": channelId, "Time": time})

		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetPostsSince", "store.sql_post.get_posts_since.app_error", nil, "channelId="+channelId+err.Error(), http.StatusInternalServerError)
		} else {

			list := model.NewPostList()

			var latestUpdate int64 = 0

			for _, p := range posts {
				list.AddPost(p)
				if p.UpdateAt > time {
					list.AddOrder(p.Id)
				}
				if latestUpdate < p.UpdateAt {
					latestUpdate = p.UpdateAt
				}
			}

			s.lastPostTimeCache.AddWithExpiresInSecs(channelId, latestUpdate, LAST_POST_TIME_CACHE_SEC)

			result.Data = list
		}
	})
}

func (s *SqlPostStore) GetPostsBefore(channelId string, postId string, numPosts int, offset int) store.StoreChannel {
	return s.getPostsAround(channelId, postId, numPosts, offset, true)
}

func (s *SqlPostStore) GetPostsAfter(channelId string, postId string, numPosts int, offset int) store.StoreChannel {
	return s.getPostsAround(channelId, postId, numPosts, offset, false)
}

func (s *SqlPostStore) getPostsAround(channelId string, postId string, numPosts int, offset int, before bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var direction string
		var sort string
		if before {
			direction = "<"
			sort = "DESC"
		} else {
			direction = ">"
			sort = "ASC"
		}

		var posts []*model.Post
		var parents []*model.Post
		_, err1 := s.GetReplica().Select(&posts,
			`(SELECT
			    *
			FROM
			    Posts
			WHERE
				(CreateAt `+direction+` (SELECT CreateAt FROM Posts WHERE Id = :PostId)
			        AND ChannelId = :ChannelId
					AND DeleteAt = 0)
			ORDER BY CreateAt `+sort+`
			LIMIT :NumPosts
			OFFSET :Offset)`,
			map[string]interface{}{"ChannelId": channelId, "PostId": postId, "NumPosts": numPosts, "Offset": offset})
		_, err2 := s.GetReplica().Select(&parents,
			`(SELECT
			    *
			FROM
			    Posts
			WHERE
			    Id
			IN
			    (SELECT * FROM (SELECT
			        RootId
			    FROM
			        Posts
			    WHERE
					(CreateAt `+direction+` (SELECT CreateAt FROM Posts WHERE Id = :PostId)
						AND ChannelId = :ChannelId
						AND DeleteAt = 0)
					ORDER BY CreateAt `+sort+`
					LIMIT :NumPosts
					OFFSET :Offset)
			    temp_tab))
			ORDER BY CreateAt DESC`,
			map[string]interface{}{"ChannelId": channelId, "PostId": postId, "NumPosts": numPosts, "Offset": offset})

		if err1 != nil {
			result.Err = model.NewAppError("SqlPostStore.GetPostContext", "store.sql_post.get_posts_around.get.app_error", nil, "channelId="+channelId+err1.Error(), http.StatusInternalServerError)
		} else if err2 != nil {
			result.Err = model.NewAppError("SqlPostStore.GetPostContext", "store.sql_post.get_posts_around.get_parent.app_error", nil, "channelId="+channelId+err2.Error(), http.StatusInternalServerError)
		} else {

			list := model.NewPostList()

			// We need to flip the order if we selected backwards
			if before {
				for _, p := range posts {
					list.AddPost(p)
					list.AddOrder(p.Id)
				}
			} else {
				l := len(posts)
				for i := range posts {
					list.AddPost(posts[l-i-1])
					list.AddOrder(posts[l-i-1].Id)
				}
			}

			for _, p := range parents {
				list.AddPost(p)
			}

			result.Data = list
		}
	})
}

func (s *SqlPostStore) getRootPosts(channelId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var posts []*model.Post
		_, err := s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE ChannelId = :ChannelId AND DeleteAt = 0 ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"ChannelId": channelId, "Offset": offset, "Limit": limit})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetLinearPosts", "store.sql_post.get_root_posts.app_error", nil, "channelId="+channelId+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = posts
		}
	})
}

func (s *SqlPostStore) getParentsPosts(channelId string, offset int, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var posts []*model.Post
		_, err := s.GetReplica().Select(&posts,
			`SELECT
			    q2.*
			FROM
			    Posts q2
			        INNER JOIN
			    (SELECT DISTINCT
			        q3.RootId
			    FROM
			        (SELECT
			        RootId
			    FROM
			        Posts
			    WHERE
			        ChannelId = :ChannelId1
			            AND DeleteAt = 0
			    ORDER BY CreateAt DESC
			    LIMIT :Limit OFFSET :Offset) q3
			    WHERE q3.RootId != '') q1
			    ON q1.RootId = q2.Id OR q1.RootId = q2.RootId
			WHERE
			    ChannelId = :ChannelId2
			        AND DeleteAt = 0
			ORDER BY CreateAt`,
			map[string]interface{}{"ChannelId1": channelId, "Offset": offset, "Limit": limit, "ChannelId2": channelId})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetLinearPosts", "store.sql_post.get_parents_posts.app_error", nil, "channelId="+channelId+" err="+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = posts
		}
	})
}

var specialSearchChar = []string{
	"<",
	">",
	"+",
	"-",
	"(",
	")",
	"~",
	"@",
	":",
}

func (s *SqlPostStore) Search(teamId string, userId string, params *model.SearchParams) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		queryParams := map[string]interface{}{
			"TeamId": teamId,
			"UserId": userId,
		}

		termMap := map[string]bool{}
		terms := params.Terms

		if terms == "" && len(params.InChannels) == 0 && len(params.FromUsers) == 0 && len(params.OnDate) == 0 && len(params.AfterDate) == 0 && len(params.BeforeDate) == 0 {
			result.Data = []*model.Post{}
			return
		}

		searchType := "Message"
		if params.IsHashtag {
			searchType = "Hashtags"
			for _, term := range strings.Split(terms, " ") {
				termMap[strings.ToUpper(term)] = true
			}
		}

		// these chars have special meaning and can be treated as spaces
		for _, c := range specialSearchChar {
			terms = strings.Replace(terms, c, " ", -1)
		}

		var posts []*model.Post

		deletedQueryPart := "AND DeleteAt = 0"
		if params.IncludeDeletedChannels {
			deletedQueryPart = ""
		}

		searchQuery := `
			SELECT
				*
			FROM
				Posts
			WHERE
				DeleteAt = 0
				AND Type NOT LIKE '` + model.POST_SYSTEM_MESSAGE_PREFIX + `%'
				POST_FILTER
				AND ChannelId IN (
					SELECT
						Id
					FROM
						Channels,
						ChannelMembers
					WHERE
						Id = ChannelId
							AND (TeamId = :TeamId OR TeamId = '')
							AND UserId = :UserId
							` + deletedQueryPart + `
							CHANNEL_FILTER)
				CREATEDATE_CLAUSE							
				SEARCH_CLAUSE
				ORDER BY CreateAt DESC
			LIMIT 100`

		if len(params.InChannels) > 1 {
			inClause := ":InChannel0"
			queryParams["InChannel0"] = params.InChannels[0]

			for i := 1; i < len(params.InChannels); i++ {
				paramName := "InChannel" + strconv.FormatInt(int64(i), 10)
				inClause += ", :" + paramName
				queryParams[paramName] = params.InChannels[i]
			}

			searchQuery = strings.Replace(searchQuery, "CHANNEL_FILTER", "AND Name IN ("+inClause+")", 1)
		} else if len(params.InChannels) == 1 {
			queryParams["InChannel"] = params.InChannels[0]
			searchQuery = strings.Replace(searchQuery, "CHANNEL_FILTER", "AND Name = :InChannel", 1)
		} else {
			searchQuery = strings.Replace(searchQuery, "CHANNEL_FILTER", "", 1)
		}

		if len(params.FromUsers) > 1 {
			inClause := ":FromUser0"
			queryParams["FromUser0"] = params.FromUsers[0]

			for i := 1; i < len(params.FromUsers); i++ {
				paramName := "FromUser" + strconv.FormatInt(int64(i), 10)
				inClause += ", :" + paramName
				queryParams[paramName] = params.FromUsers[i]
			}

			searchQuery = strings.Replace(searchQuery, "POST_FILTER", `
				AND UserId IN (
					SELECT
						Id
					FROM
						Users,
						TeamMembers
					WHERE
						TeamMembers.TeamId = :TeamId
						AND Users.Id = TeamMembers.UserId
						AND Username IN (`+inClause+`))`, 1)
		} else if len(params.FromUsers) == 1 {
			queryParams["FromUser"] = params.FromUsers[0]
			searchQuery = strings.Replace(searchQuery, "POST_FILTER", `
				AND UserId IN (
					SELECT
						Id
					FROM
						Users,
						TeamMembers
					WHERE
						TeamMembers.TeamId = :TeamId
						AND Users.Id = TeamMembers.UserId
						AND Username = :FromUser)`, 1)
		} else {
			searchQuery = strings.Replace(searchQuery, "POST_FILTER", "", 1)
		}

		// handle after: before: on: filters
		if len(params.AfterDate) > 1 || len(params.BeforeDate) > 1 || len(params.OnDate) > 1 {
			if len(params.OnDate) > 1 {
				onDateStart, onDateEnd := params.GetOnDateMillis()
				queryParams["OnDateStart"] = strconv.FormatInt(onDateStart, 10)
				queryParams["OnDateEnd"] = strconv.FormatInt(onDateEnd, 10)

				// between `on date` start of day and end of day
				searchQuery = strings.Replace(searchQuery, "CREATEDATE_CLAUSE", "AND CreateAt BETWEEN :OnDateStart AND :OnDateEnd ", 1)
			} else if len(params.AfterDate) > 1 && len(params.BeforeDate) > 1 {
				afterDate := params.GetAfterDateMillis()
				beforeDate := params.GetBeforeDateMillis()
				queryParams["OnDateStart"] = strconv.FormatInt(afterDate, 10)
				queryParams["OnDateEnd"] = strconv.FormatInt(beforeDate, 10)

				// between clause
				searchQuery = strings.Replace(searchQuery, "CREATEDATE_CLAUSE", "AND CreateAt BETWEEN :OnDateStart AND :OnDateEnd ", 1)
			} else if len(params.AfterDate) > 1 {
				afterDate := params.GetAfterDateMillis()
				queryParams["AfterDate"] = strconv.FormatInt(afterDate, 10)

				// greater than `after date`
				searchQuery = strings.Replace(searchQuery, "CREATEDATE_CLAUSE", "AND CreateAt >= :AfterDate ", 1)
			} else if len(params.BeforeDate) > 1 {
				beforeDate := params.GetBeforeDateMillis()
				queryParams["BeforeDate"] = strconv.FormatInt(beforeDate, 10)

				// less than `before date`
				searchQuery = strings.Replace(searchQuery, "CREATEDATE_CLAUSE", "AND CreateAt <= :BeforeDate ", 1)
			}
		} else {
			// no create date filters set
			searchQuery = strings.Replace(searchQuery, "CREATEDATE_CLAUSE", "", 1)
		}

		if terms == "" {
			// we've already confirmed that we have a channel or user to search for
			searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
		} else if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			// Parse text for wildcards
			if wildcard, err := regexp.Compile(`\*($| )`); err == nil {
				terms = wildcard.ReplaceAllLiteralString(terms, ":* ")
			}

			if params.OrTerms {
				terms = strings.Join(strings.Fields(terms), " | ")
			} else {
				terms = strings.Join(strings.Fields(terms), " & ")
			}

			searchClause := fmt.Sprintf("AND %s @@  to_tsquery(:Terms)", searchType)
			searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", searchClause, 1)
		} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
			searchClause := fmt.Sprintf("AND MATCH (%s) AGAINST (:Terms IN BOOLEAN MODE)", searchType)
			searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", searchClause, 1)

			if !params.OrTerms {
				splitTerms := strings.Fields(terms)
				for i, t := range strings.Fields(terms) {
					splitTerms[i] = "+" + t
				}

				terms = strings.Join(splitTerms, " ")
			}
		}

		queryParams["Terms"] = terms

		list := model.NewPostList()

		_, err := s.GetSearchReplica().Select(&posts, searchQuery, queryParams)
		if err != nil {
			mlog.Warn(fmt.Sprintf("Query error searching posts: %v", err.Error()))
			// Don't return the error to the caller as it is of no use to the user. Instead return an empty set of search results.
		} else {
			for _, p := range posts {
				if searchType == "Hashtags" {
					exactMatch := false
					for _, tag := range strings.Split(p.Hashtags, " ") {
						if termMap[strings.ToUpper(tag)] {
							exactMatch = true
						}
					}
					if !exactMatch {
						continue
					}
				}
				list.AddPost(p)
				list.AddOrder(p.Id)
			}
		}

		list.MakeNonNil()

		result.Data = list
	})
}

func (s *SqlPostStore) AnalyticsUserCountsWithPostsByDay(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query :=
			`SELECT DISTINCT
			        DATE(FROM_UNIXTIME(Posts.CreateAt / 1000)) AS Name,
			        COUNT(DISTINCT Posts.UserId) AS Value
			FROM Posts`

		if len(teamId) > 0 {
			query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = :TeamId AND"
		} else {
			query += " WHERE"
		}

		query += ` Posts.CreateAt >= :StartTime AND Posts.CreateAt <= :EndTime
			GROUP BY DATE(FROM_UNIXTIME(Posts.CreateAt / 1000))
			ORDER BY Name DESC
			LIMIT 30`

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			query =
				`SELECT
					TO_CHAR(DATE(TO_TIMESTAMP(Posts.CreateAt / 1000)), 'YYYY-MM-DD') AS Name, COUNT(DISTINCT Posts.UserId) AS Value
				FROM Posts`

			if len(teamId) > 0 {
				query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = :TeamId AND"
			} else {
				query += " WHERE"
			}

			query += ` Posts.CreateAt >= :StartTime AND Posts.CreateAt <= :EndTime
				GROUP BY DATE(TO_TIMESTAMP(Posts.CreateAt / 1000))
				ORDER BY Name DESC
				LIMIT 30`
		}

		end := utils.MillisFromTime(utils.EndOfDay(utils.Yesterday()))
		start := utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -31)))

		var rows model.AnalyticsRows
		_, err := s.GetReplica().Select(
			&rows,
			query,
			map[string]interface{}{"TeamId": teamId, "StartTime": start, "EndTime": end})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.AnalyticsUserCountsWithPostsByDay", "store.sql_post.analytics_user_counts_posts_by_day.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = rows
		}
	})
}

func (s *SqlPostStore) AnalyticsPostCountsByDay(teamId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query :=
			`SELECT
			        DATE(FROM_UNIXTIME(Posts.CreateAt / 1000)) AS Name,
			        COUNT(Posts.Id) AS Value
			    FROM Posts`

		if len(teamId) > 0 {
			query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = :TeamId AND"
		} else {
			query += " WHERE"
		}

		query += ` Posts.CreateAt <= :EndTime
			            AND Posts.CreateAt >= :StartTime
			GROUP BY DATE(FROM_UNIXTIME(Posts.CreateAt / 1000))
			ORDER BY Name DESC
			LIMIT 30`

		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			query =
				`SELECT
					TO_CHAR(DATE(TO_TIMESTAMP(Posts.CreateAt / 1000)), 'YYYY-MM-DD') AS Name, Count(Posts.Id) AS Value
				FROM Posts`

			if len(teamId) > 0 {
				query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id  AND Channels.TeamId = :TeamId AND"
			} else {
				query += " WHERE"
			}

			query += ` Posts.CreateAt <= :EndTime
				            AND Posts.CreateAt >= :StartTime
				GROUP BY DATE(TO_TIMESTAMP(Posts.CreateAt / 1000))
				ORDER BY Name DESC
				LIMIT 30`
		}

		end := utils.MillisFromTime(utils.EndOfDay(utils.Yesterday()))
		start := utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -31)))

		var rows model.AnalyticsRows
		_, err := s.GetReplica().Select(
			&rows,
			query,
			map[string]interface{}{"TeamId": teamId, "StartTime": start, "EndTime": end})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.AnalyticsPostCountsByDay", "store.sql_post.analytics_posts_count_by_day.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = rows
		}
	})
}

func (s *SqlPostStore) AnalyticsPostCount(teamId string, mustHaveFile bool, mustHaveHashtag bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query :=
			`SELECT
			    COUNT(Posts.Id) AS Value
			FROM
			    Posts,
			    Channels
			WHERE
			    Posts.ChannelId = Channels.Id`

		if len(teamId) > 0 {
			query += " AND Channels.TeamId = :TeamId"
		}

		if mustHaveFile {
			query += " AND (Posts.FileIds != '[]' OR Posts.Filenames != '[]')"
		}

		if mustHaveHashtag {
			query += " AND Posts.Hashtags != ''"
		}

		if v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewAppError("SqlPostStore.AnalyticsPostCount", "store.sql_post.analytics_posts_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = v
		}
	})
}

func (s *SqlPostStore) GetPostsCreatedAt(channelId string, time int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := `SELECT * FROM Posts WHERE CreateAt = :CreateAt AND ChannelId = :ChannelId`

		var posts []*model.Post
		_, err := s.GetReplica().Select(&posts, query, map[string]interface{}{"CreateAt": time, "ChannelId": channelId})

		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetPostsCreatedAt", "store.sql_post.get_posts_created_att.app_error", nil, "channelId="+channelId+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = posts
		}
	})
}

func (s *SqlPostStore) GetPostsByIds(postIds []string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		keys := bytes.Buffer{}
		params := make(map[string]interface{})
		for i, postId := range postIds {
			if keys.Len() > 0 {
				keys.WriteString(",")
			}

			key := "Post" + strconv.Itoa(i)
			keys.WriteString(":" + key)
			params[key] = postId
		}

		query := `SELECT * FROM Posts WHERE Id in (` + keys.String() + `) ORDER BY CreateAt DESC`

		var posts []*model.Post
		_, err := s.GetReplica().Select(&posts, query, params)

		if err != nil {
			mlog.Error(fmt.Sprint(err))
			result.Err = model.NewAppError("SqlPostStore.GetPostsByIds", "store.sql_post.get_posts_by_ids.app_error", nil, "", http.StatusInternalServerError)
		} else {
			result.Data = posts
		}
	})
}

func (s *SqlPostStore) GetPostsBatchForIndexing(startTime int64, endTime int64, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var posts []*model.PostForIndexing
		_, err1 := s.GetSearchReplica().Select(&posts,
			`SELECT
				PostsQuery.*, Channels.TeamId, ParentPosts.CreateAt ParentCreateAt
			FROM (
				SELECT
					*
				FROM
					Posts
				WHERE
					Posts.CreateAt >= :StartTime
				AND
					Posts.CreateAt < :EndTime
				ORDER BY
					CreateAt ASC
				LIMIT
					1000
				)
			AS
				PostsQuery
			LEFT JOIN
				Channels
			ON
				PostsQuery.ChannelId = Channels.Id
			LEFT JOIN
				Posts ParentPosts
			ON
				PostsQuery.RootId = ParentPosts.Id`,
			map[string]interface{}{"StartTime": startTime, "EndTime": endTime, "NumPosts": limit})

		if err1 != nil {
			result.Err = model.NewAppError("SqlPostStore.GetPostContext", "store.sql_post.get_posts_batch_for_indexing.get.app_error", nil, err1.Error(), http.StatusInternalServerError)
		} else {
			result.Data = posts
		}
	})
}

func (s *SqlPostStore) PermanentDeleteBatch(endTime int64, limit int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var query string
		if s.DriverName() == "postgres" {
			query = "DELETE from Posts WHERE Id = any (array (SELECT Id FROM Posts WHERE CreateAt < :EndTime LIMIT :Limit))"
		} else {
			query = "DELETE from Posts WHERE CreateAt < :EndTime LIMIT :Limit"
		}

		sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.PermanentDeleteBatch", "store.sql_post.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
		} else {
			rowsAffected, err1 := sqlResult.RowsAffected()
			if err1 != nil {
				result.Err = model.NewAppError("SqlPostStore.PermanentDeleteBatch", "store.sql_post.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
				result.Data = int64(0)
			} else {
				result.Data = rowsAffected
			}
		}
	})
}

func (s *SqlPostStore) GetOldest() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var post model.Post
		err := s.GetReplica().SelectOne(&post, "SELECT * FROM Posts ORDER BY CreateAt LIMIT 1")
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.GetOldest", "store.sql_post.get.app_error", nil, err.Error(), http.StatusNotFound)
		}

		result.Data = &post
	})
}

func (s *SqlPostStore) determineMaxPostSize() int {
	var maxPostSize int = model.POST_MESSAGE_MAX_RUNES_V1
	var maxPostSizeBytes int32

	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		// The Post.Message column in Postgres has historically been VARCHAR(4000), but
		// may be manually enlarged to support longer posts.
		if err := s.GetReplica().SelectOne(&maxPostSizeBytes, `
			SELECT
				COALESCE(character_maximum_length, 0)
			FROM
				information_schema.columns
			WHERE
				table_name = 'posts'
			AND	column_name = 'message'
		`); err != nil {
			mlog.Error(utils.T("store.sql_post.query_max_post_size.error") + err.Error())
		}
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		// The Post.Message column in MySQL has historically been TEXT, with a maximum
		// limit of 65535.
		if err := s.GetReplica().SelectOne(&maxPostSizeBytes, `
			SELECT 
				COALESCE(CHARACTER_MAXIMUM_LENGTH, 0)
			FROM 
				INFORMATION_SCHEMA.COLUMNS
			WHERE 
				table_schema = DATABASE()
			AND	table_name = 'Posts'
			AND	column_name = 'Message'
			LIMIT 0, 1
		`); err != nil {
			mlog.Error(utils.T("store.sql_post.query_max_post_size.error") + err.Error())
		}
	} else {
		mlog.Warn("No implementation found to determine the maximum supported post size")
	}

	// Assume a worst-case representation of four bytes per rune.
	maxPostSize = int(maxPostSizeBytes) / 4

	// To maintain backwards compatibility, don't yield a maximum post
	// size smaller than the previous limit, even though it wasn't
	// actually possible to store 4000 runes in all cases.
	if maxPostSize < model.POST_MESSAGE_MAX_RUNES_V1 {
		maxPostSize = model.POST_MESSAGE_MAX_RUNES_V1
	}

	mlog.Info(fmt.Sprintf("Post.Message supports at most %d characters (%d bytes)", maxPostSize, maxPostSizeBytes))

	return maxPostSize
}

// GetMaxPostSize returns the maximum number of runes that may be stored in a post.
func (s *SqlPostStore) GetMaxPostSize() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		s.maxPostSizeOnce.Do(func() {
			s.maxPostSizeCached = s.determineMaxPostSize()
		})
		result.Data = s.maxPostSizeCached
	})
}

func (s *SqlPostStore) GetParentsForExportAfter(limit int, afterId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var posts []*model.PostForExport
		_, err1 := s.GetSearchReplica().Select(&posts, `
                SELECT
                    p1.*,
                    Users.Username as Username,
                    Teams.Name as TeamName,
                    Channels.Name as ChannelName
                FROM
                    Posts p1
                INNER JOIN
                    Channels ON p1.ChannelId = Channels.Id
                INNER JOIN
                    Teams ON Channels.TeamId = Teams.Id
                INNER JOIN
                    Users ON p1.UserId = Users.Id
                WHERE
                    p1.Id > :AfterId
                    AND p1.ParentId = ''
                    AND p1.DeleteAt = 0
					AND Channels.DeleteAt = 0
					AND Teams.DeleteAt = 0
					AND Users.DeleteAt = 0
                ORDER BY
                    p1.Id
                LIMIT
                    :Limit`,
			map[string]interface{}{"Limit": limit, "AfterId": afterId})

		if err1 != nil {
			result.Err = model.NewAppError("SqlPostStore.GetAllAfterForExport", "store.sql_post.get_posts.app_error", nil, err1.Error(), http.StatusInternalServerError)
		} else {
			result.Data = posts
		}
	})
}

func (s *SqlPostStore) GetRepliesForExport(parentId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var posts []*model.ReplyForExport
		_, err1 := s.GetSearchReplica().Select(&posts, `
                SELECT
                    Posts.*,
                    Users.Username as Username
                FROM
                    Posts
                INNER JOIN
                    Users ON Posts.UserId = Users.Id
                WHERE
                    Posts.ParentId = :ParentId
                    AND Posts.DeleteAt = 0
					AND Users.DeleteAt = 0
                ORDER BY
                    Posts.Id`,
			map[string]interface{}{"ParentId": parentId})

		if err1 != nil {
			result.Err = model.NewAppError("SqlPostStore.GetAllAfterForExport", "store.sql_post.get_posts.app_error", nil, err1.Error(), http.StatusInternalServerError)
		} else {
			result.Data = posts
		}
	})
}
