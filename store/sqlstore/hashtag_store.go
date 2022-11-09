// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/model/sort"
	"github.com/mattermost/mattermost-server/v6/store"
	sq "github.com/mattermost/squirrel"
)

type SqlHashtagStore struct {
	*SqlStore
}

func newSqlHashtagStore(sqlStore *SqlStore) store.HashtagStore {
	return &SqlHashtagStore{sqlStore}
}

func (s *SqlHashtagStore) UpdateOnPostOverwrite(posts []*model.Post) error {
	transaction, err := s.GetReplicaX().Beginx()

	if err != nil {
		return err
	}

	for _, post := range posts {
		_, err = transaction.Exec("DELETE FROM Hashtags WHERE PostId = ?", post.Id)

		if err != nil {
			return err
		}
	}

	err = transaction.Commit()

	if err != nil {
		return err
	}

	_, err = s.SaveMultipleForPosts(posts)

	if err != nil {
		return err
	}

	return nil
}

func (s *SqlHashtagStore) UpdateOnPostEdit(oldPost *model.Post, newPost *model.Post) error {
	sql, args, err := s.getQueryBuilder().Update("Hashtags").Set("PostId", oldPost.Id).Where(sq.Eq{"PostId": oldPost.OriginalId}).ToSql()
	if err != nil {
		return err
	}

	if _, err := s.GetReplicaX().Exec(sql, args...); err != nil {
		return err
	}

	if _, err := s.SaveMultipleForPosts([]*model.Post{newPost}); err != nil {
		return err
	}

	return nil
}

func (s *SqlHashtagStore) SearchForUser(phrase string, userId string) ([]*model.HashtagWithMessageCountSearch, error) {
	columns := "MAX(p.UpdateAt) as UpdateAt, 30 as priority, MAX(h.Id) AS Id, MAX(h.PostId) AS PostId, h.Value as Value, COUNT(Value) as Messages"
	query := fmt.Sprintf(`
			SELECT DISTINCT Id, PostId, Value, Messages FROM (
				(
					SELECT %s
						FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id
						WHERE (p.UserId = ? AND SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE ?)
							GROUP BY h.Value
							ORDER BY MAX(p.UpdateAt) DESC LIMIT 10
			   )
				UNION
				(
					SELECT %s
						FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id
						WHERE (p.UserId = ? AND SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE ?)
							GROUP BY h.Value
							ORDER BY MAX(p.UpdateAt) DESC LIMIT 10)
				UNION
				(
					SELECT %s
						FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id
						WHERE SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE ?
							GROUP BY h.Value
							ORDER BY Messages DESC LIMIT 10
			   	)
				UNION
				(
					SELECT %s
						FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id
					  	WHERE SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE ?
					 		GROUP BY h.Value
					 		ORDER BY Messages DESC LIMIT 10
				)
			) result LIMIT 10;
	`, columns, columns, columns, columns)
	/*
		SELECT DISTINCT Id, PostId, Value, Messages FROM (
		(SELECT MAX(p.UpdateAt) as UpdateAt, 30 as priority, MAX(h.Id) AS Id, MAX(h.PostId) AS PostId, h.Value as Value, COUNT(Value) as Messages
													FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id
													WHERE (p.UserId = "9skzkqrbktgo8f3a63giug7mjr" AND SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE "he%")
														GROUP BY h.Value ORDER BY MAX(p.UpdateAt) DESC LIMIT 10)
		UNION
		(SELECT MAX(p.UpdateAt) as UpdateAt, 20 as priority, MAX(h.Id) AS Id, MAX(h.PostId) AS PostId, h.Value as Value, COUNT(Value) as Messages
													FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id
													WHERE (p.UserId = "9skzkqrbktgo8f3a63giug7mjr" AND SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE "%he%")
														GROUP BY h.Value ORDER BY MAX(p.UpdateAt) DESC LIMIT 10)
		UNION
			(SELECT MAX(p.UpdateAt) as UpdateAt, 10 as priority, MAX(h.Id) AS Id, MAX(h.PostId) AS PostId, h.Value, COUNT(h.Value) as Messages FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id WHERE SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE "he%" GROUP BY h.Value ORDER BY Messages DESC LIMIT 10)
		UNION
			(SELECT MAX(p.UpdateAt) as UpdateAt, 0 as priority, MAX(h.Id) AS Id, MAX(h.PostId) AS PostId, h.Value, COUNT(h.Value) as Messages FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id WHERE SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE "%he%" GROUP BY h.Value ORDER BY Messages DESC LIMIT 10)
		) result LIMIT 10;


		(SELECT MAX(p.UpdateAt) as UpdateAt, 30 as priority, MAX(h.PostId) AS PostId, h.Value as Value, COUNT(Value) as Messages
												FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id
												WHERE (p.UserId = "9skzkqrbktgo8f3a63giug7mjr" AND SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE "he%")
													GROUP BY h.Value ORDER BY MAX(p.UpdateAt) DESC)

		(SELECT MAX(p.UpdateAt) as UpdateAt, 20 as priority, MAX(h.Id) AS Id, MAX(h.PostId) AS PostId, h.Value as Value, COUNT(Value) as Messages
												FROM Hashtags h LEFT JOIN Posts p ON h.PostId = p.Id
												WHERE (p.UserId = "9skzkqrbktgo8f3a63giug7mjr" AND SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE "%he%")
													GROUP BY h.Value ORDER BY MAX(p.UpdateAt) DESC)

		(SELECT 1 as dupa, COUNT(h.Value) as Messages, 10 as priority, MAX(h.Id) AS Id, MAX(h.PostId) AS PostId, h.Value FROM Hashtags h WHERE SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE "he%" GROUP BY h.Value ORDER BY Messages DESC)

		(SELECT 1 as dupa, COUNT(h.Value) as Messages, 0 as priority, MAX(h.Id) AS Id, MAX(h.PostId) AS PostId, h.Value FROM Hashtags h WHERE SUBSTRING(h.Value, 2, LENGTH(h.Value) - 1) LIKE "%he%" GROUP BY h.Value ORDER BY Messages DESC)
	*/

	var result []*model.HashtagWithMessageCountSearch
	startingWithPrase := phrase + "%"
	containingPhrase := "%" + startingWithPrase

	if err := s.GetReplicaX().Select(&result, query, userId, startingWithPrase, userId, containingPhrase, startingWithPrase, containingPhrase); err != nil {
		return nil, err
	}

	return result, nil
}

func (s *SqlHashtagStore) SaveMultipleForPosts(posts []*model.Post) ([]*model.Hashtag, error) {
	var results []*model.Hashtag
	builder := s.getQueryBuilder().Insert("Hashtags").Columns("Id", "PostId", "Value")

	for _, post := range posts {
		whitespaceDelimitedHashtags, _ := model.ParseHashtags(post.Message)
		hashtags := filterDuplicates(filterEmpty(model.ExtractHashtags(whitespaceDelimitedHashtags)))

		for _, hashtag := range hashtags {
			hashtagModel := model.Hashtag{Id: model.NewId(), PostId: post.Id, Value: hashtag}
			builder = builder.Values(hashtagModel.Id, hashtagModel.PostId, hashtagModel.Value)
			results = append(results, &hashtagModel)
		}
	}

	if len(results) == 0 {
		return results, nil
	}

	query, args, err := builder.ToSql()

	if err != nil {
		return nil, err
	}

	transaction, err := s.GetReplicaX().Beginx()

	if err != nil {
		return nil, err
	}

	defer finalizeTransactionX(transaction, &err)

	if err != nil {
		return nil, err
	}

	_, err = transaction.Exec(query, args...)

	if err != nil {
		return nil, err
	}

	if err := transaction.Commit(); err != nil {
		return nil, err
	}

	return results, nil
}

func filterEmpty(hashtags []string) (result []string) {
	for _, hashtag := range hashtags {
		if hashtag == "" {
			continue
		}

		result = append(result, hashtag)
	}

	return result
}

func filterDuplicates(hashtags []string) (result []string) {
	alreadyVerified := make(map[string]bool)
	for _, hashtag := range hashtags {
		if alreadyVerified[hashtag] {
			continue
		}

		alreadyVerified[hashtag] = true
		result = append(result, hashtag)
	}

	return result
}

func (s *SqlHashtagStore) GetMostCommon(sort sort.Sort) ([]*model.HashtagWithMessageCount, error) {
	sql, _, err := s.getQueryBuilder().
		Select("Value, COUNT(Value) as Messages").
		From("Hashtags").
		GroupBy("Value").
		OrderBy(fmt.Sprintf("messages %s, Value", sort)).
		Limit(10).
		ToSql()

	if err != nil {
		return nil, err
	}

	var hashtags []*model.HashtagWithMessageCount

	if err := s.GetReplicaX().Select(&hashtags, sql); err != nil {
		return nil, err
	}

	return hashtags, nil
}

func (s *SqlHashtagStore) GetAll() ([]*model.Hashtag, error) {
	sql, _, err := s.getQueryBuilder().Select("*").From("Hashtags").Limit(10).ToSql()

	if err != nil {
		return nil, err
	}

	var hashtags []*model.Hashtag
	if err := s.GetReplicaX().Select(&hashtags, sql); err != nil {
		return nil, err
	}

	return hashtags, nil
}

func (s *SqlHashtagStore) Save(hashtag *model.Hashtag) (re *model.Hashtag, err error) {
	hashtag.Id = model.NewId()
	transaction, _ := s.GetReplicaX().Beginx()

	if _, err := transaction.NamedExec(
		`INSERT INTO
				Hashtags
				(Id, PostId, Value)
			VALUES
				(:Id, :PostId, :Value)`, hashtag); err != nil {
		return nil, err
	}

	transaction.Commit()

	return hashtag, nil
}
