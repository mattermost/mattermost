// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlComplianceStore struct {
	*SqlStore
}

func newSqlComplianceStore(sqlStore *SqlStore) store.ComplianceStore {
	return &SqlComplianceStore{sqlStore}
}

func (s SqlComplianceStore) Save(compliance *model.Compliance) (*model.Compliance, error) {
	compliance.PreSave()
	if err := compliance.IsValid(); err != nil {
		return nil, err
	}

	// DESC is a keyword
	desc := s.toReserveCase("desc")

	query := `INSERT INTO Compliances (Id, CreateAt, UserId, Status, Count, ` + desc + `, Type, StartAt, EndAt, Keywords, Emails)
	VALUES
	(:Id, :CreateAt, :UserId, :Status, :Count, :Desc, :Type, :StartAt, :EndAt, :Keywords, :Emails)`
	if _, err := s.GetMaster().NamedExec(query, compliance); err != nil {
		return nil, errors.Wrap(err, "failed to save Compliance")
	}
	return compliance, nil
}

func (s SqlComplianceStore) Update(compliance *model.Compliance) (*model.Compliance, error) {
	if err := compliance.IsValid(); err != nil {
		return nil, err
	}

	query := s.getQueryBuilder().
		Update("Compliances").
		Set("CreateAt", compliance.CreateAt).
		Set("UserId", compliance.UserId).
		Set("Status", compliance.Status).
		Set("Count", compliance.Count).
		Set("Type", compliance.Type).
		Set("StartAt", compliance.StartAt).
		Set("EndAt", compliance.EndAt).
		Set("Keywords", compliance.Keywords).
		Set("Emails", compliance.Emails).
		Where(sq.Eq{"Id": compliance.Id})

	// DESC is a keyword
	query = query.Set(s.toReserveCase("desc"), compliance.Desc)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "compliances_tosql")
	}

	res, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update Compliance")
	}
	count, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rows_affected")
	}
	if count > 1 {
		return nil, fmt.Errorf("unexpected count while updating compliances: count=%d, Id=%s", count, compliance.Id)
	}
	return compliance, nil
}

func (s SqlComplianceStore) GetAll(offset, limit int) (model.Compliances, error) {
	query := "SELECT * FROM Compliances ORDER BY CreateAt DESC LIMIT ? OFFSET ?"
	compliances := model.Compliances{}
	if err := s.GetReplica().Select(&compliances, query, limit, offset); err != nil {
		return nil, errors.Wrap(err, "failed to find all Compliances")
	}
	return compliances, nil
}

func (s SqlComplianceStore) Get(id string) (*model.Compliance, error) {
	var compliance model.Compliance
	if err := s.GetReplica().Get(&compliance, `SELECT * FROM Compliances WHERE Id = ?`, id); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Compliances", id)
		}
		return nil, errors.Wrapf(err, "failed to get Compliance with id=%s", id)
	}
	if compliance.Id == "" {
		return nil, store.NewErrNotFound("Compliance", id)
	}
	return &compliance, nil
}

func (s SqlComplianceStore) ComplianceExport(job *model.Compliance, cursor model.ComplianceExportCursor, limit int) ([]*model.CompliancePost, model.ComplianceExportCursor, error) {
	keywordQuery := ""
	var argsKeywords []any
	keywords := strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(job.Keywords, ",", " ", -1))))
	if len(keywords) > 0 {
		clauses := make([]string, len(keywords))

		for i, keyword := range keywords {
			keyword = sanitizeSearchTerm(keyword, "\\")
			clauses[i] = "LOWER(Posts.Message) LIKE ?"
			argsKeywords = append(argsKeywords, "%"+keyword+"%")
		}

		keywordQuery = "AND (" + strings.Join(clauses, " OR ") + ")"
	}

	emailQuery := ""
	var argsEmails []any
	emails := strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(job.Emails, ",", " ", -1))))
	if len(emails) > 0 {
		clauses := make([]string, len(emails))

		for i, email := range emails {
			clauses[i] = "Users.Email = ?"
			argsEmails = append(argsEmails, email)
		}

		emailQuery = "AND (" + strings.Join(clauses, " OR ") + ")"
	}

	// The idea is to first iterate over the channel posts, and then when we run out of those,
	// start iterating over the direct message posts.

	channelPosts := []*model.CompliancePost{}
	channelsQuery := ""
	var argsChannelsQuery []any
	if !cursor.ChannelsQueryCompleted {
		if cursor.LastChannelsQueryPostCreateAt == 0 {
			cursor.LastChannelsQueryPostCreateAt = job.StartAt
		}
		// append the named parameters of SQL query in the correct order to argsChannelsQuery
		argsChannelsQuery = append(argsChannelsQuery, cursor.LastChannelsQueryPostCreateAt, cursor.LastChannelsQueryPostCreateAt, cursor.LastChannelsQueryPostID, job.EndAt)
		argsChannelsQuery = append(argsChannelsQuery, argsEmails...)
		argsChannelsQuery = append(argsChannelsQuery, argsKeywords...)
		argsChannelsQuery = append(argsChannelsQuery, limit)
		channelsQuery = `
		SELECT
			Teams.Name AS TeamName,
			Teams.DisplayName AS TeamDisplayName,
			Channels.Name AS ChannelName,
			Channels.DisplayName AS ChannelDisplayName,
			Channels.Type AS ChannelType,
			Users.Username AS UserUsername,
			Users.Email AS UserEmail,
			Users.Nickname AS UserNickname,
			Posts.Id AS PostId,
			Posts.CreateAt AS PostCreateAt,
			Posts.UpdateAt AS PostUpdateAt,
			Posts.DeleteAt AS PostDeleteAt,
			Posts.RootId AS PostRootId,
			Posts.OriginalId AS PostOriginalId,
			Posts.Message AS PostMessage,
			Posts.Type AS PostType,
			Posts.Props AS PostProps,
			Posts.Hashtags AS PostHashtags,
			Posts.FileIds AS PostFileIds,
			Bots.UserId IS NOT NULL AS IsBot
		FROM
			Teams,
			Channels,
			Users,
			Posts
		LEFT JOIN
			Bots ON Bots.UserId = Posts.UserId
		WHERE
			Teams.Id = Channels.TeamId
				AND Posts.ChannelId = Channels.Id
				AND Posts.UserId = Users.Id
				AND (
					Posts.CreateAt > ?
					OR (Posts.CreateAt = ? AND Posts.Id > ?)
				)
				AND Posts.CreateAt < ?
				` + emailQuery + `
				` + keywordQuery + `
		ORDER BY Posts.CreateAt, Posts.Id
		LIMIT ?`
		if err := s.GetReplica().Select(&channelPosts, channelsQuery, argsChannelsQuery...); err != nil {
			return nil, cursor, errors.Wrap(err, "unable to export compliance")
		}
		if len(channelPosts) < limit {
			cursor.ChannelsQueryCompleted = true
		} else {
			cursor.LastChannelsQueryPostCreateAt = channelPosts[len(channelPosts)-1].PostCreateAt
			cursor.LastChannelsQueryPostID = channelPosts[len(channelPosts)-1].PostId
		}
	}

	directMessagePosts := []*model.CompliancePost{}
	directMessagesQuery := ""
	var argsDirectMessagesQuery []any
	if !cursor.DirectMessagesQueryCompleted && len(channelPosts) < limit {
		if cursor.LastDirectMessagesQueryPostCreateAt == 0 {
			cursor.LastDirectMessagesQueryPostCreateAt = job.StartAt
		}
		// append the named parameters of SQL query in the correct order to argsDirectMessagesQuery
		argsDirectMessagesQuery = append(argsDirectMessagesQuery, cursor.LastDirectMessagesQueryPostCreateAt, cursor.LastDirectMessagesQueryPostCreateAt, cursor.LastDirectMessagesQueryPostID, job.EndAt)
		argsDirectMessagesQuery = append(argsDirectMessagesQuery, argsEmails...)
		argsDirectMessagesQuery = append(argsDirectMessagesQuery, argsKeywords...)
		argsDirectMessagesQuery = append(argsDirectMessagesQuery, limit-len(channelPosts))
		directMessagesQuery = `
		SELECT
			'direct-messages' AS TeamName,
			'Direct Messages' AS TeamDisplayName,
			Channels.Name AS ChannelName,
			Channels.DisplayName AS ChannelDisplayName,
			Channels.Type AS ChannelType,
			Users.Username AS UserUsername,
			Users.Email AS UserEmail,
			Users.Nickname AS UserNickname,
			Posts.Id AS PostId,
			Posts.CreateAt AS PostCreateAt,
			Posts.UpdateAt AS PostUpdateAt,
			Posts.DeleteAt AS PostDeleteAt,
			Posts.RootId AS PostRootId,
			Posts.OriginalId AS PostOriginalId,
			Posts.Message AS PostMessage,
			Posts.Type AS PostType,
			Posts.Props AS PostProps,
			Posts.Hashtags AS PostHashtags,
			Posts.FileIds AS PostFileIds,
			Bots.UserId IS NOT NULL AS IsBot
		FROM
			Channels,
			Users,
			Posts
		LEFT JOIN
			Bots ON Bots.UserId = Posts.UserId
		WHERE
			Channels.TeamId = ''
				AND Posts.ChannelId = Channels.Id
				AND Posts.UserId = Users.Id
				AND (
					Posts.CreateAt > ?
					OR (Posts.CreateAt = ? AND Posts.Id > ?)
				)
				AND Posts.CreateAt < ?
				` + emailQuery + `
				` + keywordQuery + `
		ORDER BY Posts.CreateAt, Posts.Id
		LIMIT ?`

		if err := s.GetReplica().Select(&directMessagePosts, directMessagesQuery, argsDirectMessagesQuery...); err != nil {
			return nil, cursor, errors.Wrap(err, "unable to export compliance")
		}
		if len(directMessagePosts) < limit {
			cursor.DirectMessagesQueryCompleted = true
		} else {
			cursor.LastDirectMessagesQueryPostCreateAt = directMessagePosts[len(directMessagePosts)-1].PostCreateAt
			cursor.LastDirectMessagesQueryPostID = directMessagePosts[len(directMessagePosts)-1].PostId
		}
	}

	return append(channelPosts, directMessagePosts...), cursor, nil
}

func (s SqlComplianceStore) MessageExport(c request.CTX, cursor model.MessageExportCursor, limit int) ([]*model.MessageExport, model.MessageExportCursor, error) {
	caseStmt, caseArgs, caseErr := sq.Case().
		When(
			sq.Eq{"Channels.Type": model.ChannelTypeDirect},
			"'Direct Message'",
		).
		When(
			sq.Eq{"Channels.Type": model.ChannelTypeGroup},
			"'Group Message'",
		).
		Else("Channels.DisplayName").ToSql()
	if caseErr != nil {
		return nil, cursor, errors.Wrap(caseErr, "unable to construct case statement")
	}

	builder := s.getQueryBuilder().Select(`Posts.Id AS PostId,
			Posts.CreateAt    AS PostCreateAt,
			Posts.UpdateAt    AS PostUpdateAt,
			Posts.DeleteAt    AS PostDeleteAt,
            Posts.EditAt      AS PostEditAt,
			Posts.Message     AS PostMessage,
			Posts.Type        AS PostType,
			Posts.Props       AS PostProps,
			Posts.OriginalId  AS PostOriginalId,
			Posts.RootId      AS PostRootId,
			Posts.FileIds     AS PostFileIds,
			Teams.Id          AS TeamId,
			Teams.Name        AS TeamName,
			Teams.DisplayName AS TeamDisplayName,
			Channels.Id       AS ChannelId,
			Channels.Name     AS ChannelName,
			Channels.Type     AS ChannelType,
			Users.Id          AS UserId,
			Users.Email       AS UserEmail,
			Users.Username,
			Bots.UserId IS NOT NULL AS IsBot`).
		Column(caseStmt+" AS ChannelDisplayName", caseArgs...).
		From("Posts").
		JoinClause("LEFT OUTER JOIN Channels ON Posts.ChannelId = Channels.Id").
		JoinClause("LEFT OUTER JOIN Teams ON Channels.TeamId = Teams.Id").
		JoinClause("LEFT OUTER JOIN Users ON Posts.UserId = Users.Id").
		LeftJoin("Bots ON Bots.UserId = Posts.UserId").
		Where(sq.And{
			sq.Or{
				sq.Gt{"Posts.UpdateAt": cursor.LastPostUpdateAt},
				sq.And{
					sq.Eq{"Posts.UpdateAt": cursor.LastPostUpdateAt},
					sq.Gt{"Posts.Id": cursor.LastPostId},
				},
			},
			sq.NotLike{"Posts.Type": "system_%"},
		}).
		OrderBy("PostUpdateAt, PostId").
		Limit(uint64(limit))

	if cursor.UntilUpdateAt > 0 {
		builder = builder.Where(sq.LtOrEq{"Posts.UpdateAt": cursor.UntilUpdateAt})
	}

	cposts := []*model.MessageExport{}
	if err := s.GetReplica().SelectBuilderCtx(c.Context(), &cposts, builder); err != nil {
		return nil, cursor, errors.Wrap(err, "unable to export messages")
	}
	if len(cposts) > 0 {
		cursor.LastPostUpdateAt = *cposts[len(cposts)-1].PostUpdateAt
		cursor.LastPostId = *cposts[len(cposts)-1].PostId
	}
	return cposts, cursor, nil
}
