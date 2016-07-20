// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type SqlPostStore struct {
	*SqlStore
}

func NewSqlPostStore(sqlStore *SqlStore) PostStore {
	s := &SqlPostStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Post{}, "Posts").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("ChannelId").SetMaxSize(26)
		table.ColMap("RootId").SetMaxSize(26)
		table.ColMap("ParentId").SetMaxSize(26)
		table.ColMap("Message").SetMaxSize(4000)
		table.ColMap("Type").SetMaxSize(26)
		table.ColMap("Hashtags").SetMaxSize(1000)
		table.ColMap("Props").SetMaxSize(8000)
		table.ColMap("Filenames").SetMaxSize(4000)
	}

	return s
}

func (s SqlPostStore) UpgradeSchemaIfNeeded() {
}

func (s SqlPostStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_posts_update_at", "Posts", "UpdateAt")
	s.CreateIndexIfNotExists("idx_posts_create_at", "Posts", "CreateAt")
	s.CreateIndexIfNotExists("idx_posts_channel_id", "Posts", "ChannelId")
	s.CreateIndexIfNotExists("idx_posts_root_id", "Posts", "RootId")

	s.CreateFullTextIndexIfNotExists("idx_posts_message_txt", "Posts", "Message")
	s.CreateFullTextIndexIfNotExists("idx_posts_hashtags_txt", "Posts", "Hashtags")
}

func (s SqlPostStore) Save(post *model.Post) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(post.Id) > 0 {
			result.Err = model.NewLocAppError("SqlPostStore.Save",
				"store.sql_post.save.existing.app_error", nil, "id="+post.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		post.PreSave()
		if result.Err = post.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(post); err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.Save", "store.sql_post.save.app_error", nil, "id="+post.Id+", "+err.Error())
		} else {
			time := model.GetMillis()

			if post.Type != model.POST_JOIN_LEAVE {
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

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) Update(oldPost *model.Post, newMessage string, newHashtags string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		editPost := *oldPost
		editPost.Message = newMessage
		editPost.UpdateAt = model.GetMillis()
		editPost.Hashtags = newHashtags

		oldPost.DeleteAt = editPost.UpdateAt
		oldPost.UpdateAt = editPost.UpdateAt
		oldPost.OriginalId = oldPost.Id
		oldPost.Id = model.NewId()

		if result.Err = editPost.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if _, err := s.GetMaster().Update(&editPost); err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.Update", "store.sql_post.update.app_error", nil, "id="+editPost.Id+", "+err.Error())
		} else {
			time := model.GetMillis()
			s.GetMaster().Exec("UPDATE Channels SET LastPostAt = :LastPostAt  WHERE Id = :ChannelId", map[string]interface{}{"LastPostAt": time, "ChannelId": editPost.ChannelId})

			if len(editPost.RootId) > 0 {
				s.GetMaster().Exec("UPDATE Posts SET UpdateAt = :UpdateAt WHERE Id = :RootId", map[string]interface{}{"UpdateAt": time, "RootId": editPost.RootId})
			}

			// mark the old post as deleted
			s.GetMaster().Insert(oldPost)

			result.Data = &editPost
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) GetFlaggedPosts(userId string, offset int, limit int) StoreChannel {
	storeChannel := make(StoreChannel)
	go func() {
		result := StoreResult{}
		pl := &model.PostList{}

		var posts []*model.Post
		if _, err := s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE Id IN (SELECT Name FROM Preferences WHERE UserId = :UserId AND Category = :Category) ORDER BY CreateAt ASC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"UserId": userId, "Category": model.PREFERENCE_CATEGORY_FLAGGED_POST, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.GetFlaggedPosts", "store.sql_post.get_flagged_posts.app_error", nil, err.Error())
		} else {
			for _, post := range posts {
				pl.AddPost(post)
				pl.AddOrder(post.Id)
			}
		}

		result.Data = pl

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) Get(id string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}
		pl := &model.PostList{}

		var post model.Post
		err := s.GetReplica().SelectOne(&post, "SELECT * FROM Posts WHERE Id = :Id AND DeleteAt = 0", map[string]interface{}{"Id": id})
		if err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.GetPost", "store.sql_post.get.app_error", nil, "id="+id+err.Error())
		}

		pl.AddPost(&post)
		pl.AddOrder(id)

		rootId := post.RootId

		if rootId == "" {
			rootId = post.Id
		}

		var posts []*model.Post
		_, err = s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE (Id = :Id OR RootId = :RootId) AND DeleteAt = 0", map[string]interface{}{"Id": rootId, "RootId": rootId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.GetPost", "store.sql_post.get.app_error", nil, "root_id="+rootId+err.Error())
		} else {
			for _, p := range posts {
				pl.AddPost(p)
			}
		}

		result.Data = pl

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

type etagPosts struct {
	Id       string
	UpdateAt int64
}

func (s SqlPostStore) GetEtag(channelId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var et etagPosts
		err := s.GetReplica().SelectOne(&et, "SELECT Id, UpdateAt FROM Posts WHERE ChannelId = :ChannelId ORDER BY UpdateAt DESC LIMIT 1", map[string]interface{}{"ChannelId": channelId})
		if err != nil {
			result.Data = fmt.Sprintf("%v.0.%v", model.CurrentVersion, model.GetMillis())
		} else {
			result.Data = fmt.Sprintf("%v.%v.%v", model.CurrentVersion, et.Id, et.UpdateAt)
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) Delete(postId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("Update Posts SET DeleteAt = :DeleteAt, UpdateAt = :UpdateAt WHERE Id = :Id OR ParentId = :ParentId OR RootId = :RootId", map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": postId, "ParentId": postId, "RootId": postId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.Delete", "store.sql_post.delete.app_error", nil, "id="+postId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) permanentDelete(postId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("DELETE FROM Posts WHERE Id = :Id OR ParentId = :ParentId OR RootId = :RootId", map[string]interface{}{"Id": postId, "ParentId": postId, "RootId": postId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.Delete", "store.sql_post.permanent_delete.app_error", nil, "id="+postId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) permanentDeleteAllCommentByUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := s.GetMaster().Exec("DELETE FROM Posts WHERE UserId = :UserId AND RootId != ''", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.permanentDeleteAllCommentByUser", "store.sql_post.permanent_delete_all_comments_by_user.app_error", nil, "userId="+userId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) PermanentDeleteByUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		// First attempt to delete all the comments for a user
		if r := <-s.permanentDeleteAllCommentByUser(userId); r.Err != nil {
			result.Err = r.Err
			storeChannel <- result
			close(storeChannel)
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
				result.Err = model.NewLocAppError("SqlPostStore.PermanentDeleteByUser.select", "store.sql_post.permanent_delete_by_user.app_error", nil, "userId="+userId+", err="+err.Error())
				storeChannel <- result
				close(storeChannel)
				return
			} else {
				found = false
				for _, id := range ids {
					found = true
					if r := <-s.permanentDelete(id); r.Err != nil {
						result.Err = r.Err
						storeChannel <- result
						close(storeChannel)
						return
					}
				}
			}

			// This is a fail safe, give up if more than 10K messages
			count = count + 1
			if count >= 10 {
				result.Err = model.NewLocAppError("SqlPostStore.PermanentDeleteByUser.toolarge", "store.sql_post.permanent_delete_by_user.too_many.app_error", nil, "userId="+userId)
				storeChannel <- result
				close(storeChannel)
				return
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) GetPosts(channelId string, offset int, limit int) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if limit > 1000 {
			result.Err = model.NewLocAppError("SqlPostStore.GetLinearPosts", "store.sql_post.get_posts.app_error", nil, "channelId="+channelId)
			storeChannel <- result
			close(storeChannel)
			return
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

			list := &model.PostList{Order: make([]string, 0, len(posts))}

			for _, p := range posts {
				list.AddPost(p)
				list.AddOrder(p.Id)
			}

			for _, p := range parents {
				list.AddPost(p)
			}

			list.MakeNonNil()

			result.Data = list
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) GetPostsSince(channelId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

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
			result.Err = model.NewLocAppError("SqlPostStore.GetPostsSince", "store.sql_post.get_posts_since.app_error", nil, "channelId="+channelId+err.Error())
		} else {

			list := &model.PostList{Order: make([]string, 0, len(posts))}

			for _, p := range posts {
				list.AddPost(p)
				if p.UpdateAt > time {
					list.AddOrder(p.Id)
				}
			}

			result.Data = list
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) GetPostsBefore(channelId string, postId string, numPosts int, offset int) StoreChannel {
	return s.getPostsAround(channelId, postId, numPosts, offset, true)
}

func (s SqlPostStore) GetPostsAfter(channelId string, postId string, numPosts int, offset int) StoreChannel {
	return s.getPostsAround(channelId, postId, numPosts, offset, false)
}

func (s SqlPostStore) getPostsAround(channelId string, postId string, numPosts int, offset int, before bool) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

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
			result.Err = model.NewLocAppError("SqlPostStore.GetPostContext", "store.sql_post.get_posts_around.get.app_error", nil, "channelId="+channelId+err1.Error())
		} else if err2 != nil {
			result.Err = model.NewLocAppError("SqlPostStore.GetPostContext", "store.sql_post.get_posts_around.get_parent.app_error", nil, "channelId="+channelId+err2.Error())
		} else {

			list := &model.PostList{Order: make([]string, 0, len(posts))}

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

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) getRootPosts(channelId string, offset int, limit int) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var posts []*model.Post
		_, err := s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE ChannelId = :ChannelId AND DeleteAt = 0 ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"ChannelId": channelId, "Offset": offset, "Limit": limit})
		if err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.GetLinearPosts", "store.sql_post.get_root_posts.app_error", nil, "channelId="+channelId+err.Error())
		} else {
			result.Data = posts
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) getParentsPosts(channelId string, offset int, limit int) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

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
			result.Err = model.NewLocAppError("SqlPostStore.GetLinearPosts", "store.sql_post.get_parents_posts.app_error", nil, "channelId="+channelId+err.Error())
		} else {
			result.Data = posts
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
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

func (s SqlPostStore) Search(teamId string, userId string, params *model.SearchParams) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		queryParams := map[string]interface{}{
			"TeamId": teamId,
			"UserId": userId,
		}

		termMap := map[string]bool{}
		terms := params.Terms

		if terms == "" && len(params.InChannels) == 0 && len(params.FromUsers) == 0 {
			result.Data = []*model.Post{}
			storeChannel <- result
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
							AND DeleteAt = 0
							CHANNEL_FILTER)
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

		if terms == "" {
			// we've already confirmed that we have a channel or user to search for
			searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
		} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
			// Parse text for wildcards
			if wildcard, err := regexp.Compile("\\*($| )"); err == nil {
				terms = wildcard.ReplaceAllLiteralString(terms, ":* ")
			}

			if params.OrTerms {
				terms = strings.Join(strings.Fields(terms), " | ")
			} else {
				terms = strings.Join(strings.Fields(terms), " & ")
			}

			searchClause := fmt.Sprintf("AND %s @@  to_tsquery(:Terms)", searchType)
			searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", searchClause, 1)
		} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
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

		_, err := s.GetReplica().Select(&posts, searchQuery, queryParams)
		if err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.Search", "store.sql_post.search.app_error", nil, "teamId="+teamId+", err="+err.Error())
		}

		list := &model.PostList{Order: make([]string, 0, len(posts))}

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

		list.MakeNonNil()

		result.Data = list

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) AnalyticsUserCountsWithPostsByDay(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		query :=
			`SELECT
			    t1.Name, COUNT(t1.UserId) AS Value
			FROM
			    (SELECT DISTINCT
			        DATE(FROM_UNIXTIME(Posts.CreateAt / 1000)) AS Name,
			            Posts.UserId
			    FROM
			        Posts, Channels
			    WHERE
			        Posts.ChannelId = Channels.Id`

		if len(teamId) > 0 {
			query += " AND Channels.TeamId = :TeamId"
		}

		query += ` AND Posts.CreateAt >= :StartTime AND Posts.CreateAt <= :EndTime
			    ORDER BY Name DESC) AS t1
			GROUP BY Name
			ORDER BY Name DESC
			LIMIT 30`

		if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
			query =
				`SELECT
				    TO_CHAR(t1.Name, 'YYYY-MM-DD') AS Name, COUNT(t1.UserId) AS Value
				FROM
				    (SELECT DISTINCT
				        DATE(TO_TIMESTAMP(Posts.CreateAt / 1000)) AS Name,
				            Posts.UserId
				    FROM
				        Posts, Channels
				    WHERE
				        Posts.ChannelId = Channels.Id`

			if len(teamId) > 0 {
				query += " AND Channels.TeamId = :TeamId"
			}

			query += ` AND Posts.CreateAt >= :StartTime AND Posts.CreateAt <= :EndTime
				    ORDER BY Name DESC) AS t1
				GROUP BY Name
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
			result.Err = model.NewLocAppError("SqlPostStore.AnalyticsUserCountsWithPostsByDay", "store.sql_post.analytics_user_counts_posts_by_day.app_error", nil, err.Error())
		} else {
			result.Data = rows
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) AnalyticsPostCountsByDay(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		query :=
			`SELECT 
			    Name, COUNT(Value) AS Value
			FROM
			    (SELECT 
			        DATE(FROM_UNIXTIME(Posts.CreateAt / 1000)) AS Name,
			            '1' AS Value
			    FROM
			        Posts, Channels
			    WHERE
			        Posts.ChannelId = Channels.Id`

		if len(teamId) > 0 {
			query += " AND Channels.TeamId = :TeamId"
		}

		query += ` AND Posts.CreateAt <= :EndTime
			            AND Posts.CreateAt >= :StartTime) AS t1
			GROUP BY Name
			ORDER BY Name DESC
			LIMIT 30`

		if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
			query =
				`SELECT 
				    Name, COUNT(Value) AS Value
				FROM
				    (SELECT 
				        TO_CHAR(DATE(TO_TIMESTAMP(Posts.CreateAt / 1000)), 'YYYY-MM-DD') AS Name,
				            '1' AS Value
				    FROM
				        Posts, Channels
				    WHERE
				        Posts.ChannelId = Channels.Id`

			if len(teamId) > 0 {
				query += " AND Channels.TeamId = :TeamId"
			}

			query += ` AND Posts.CreateAt <= :EndTime
				            AND Posts.CreateAt >= :StartTime) AS t1
				GROUP BY Name
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
			result.Err = model.NewLocAppError("SqlPostStore.AnalyticsPostCountsByDay", "store.sql_post.analytics_posts_count_by_day.app_error", nil, err.Error())
		} else {
			result.Data = rows
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPostStore) AnalyticsPostCount(teamId string, mustHaveFile bool, mustHaveHashtag bool) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

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
			query += " AND Posts.Filenames != '[]'"
		}

		if mustHaveHashtag {
			query += " AND Posts.Hashtags != ''"
		}

		if v, err := s.GetReplica().SelectInt(query, map[string]interface{}{"TeamId": teamId}); err != nil {
			result.Err = model.NewLocAppError("SqlPostStore.AnalyticsPostCount", "store.sql_post.analytics_posts_count.app_error", nil, err.Error())
		} else {
			result.Data = v
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
