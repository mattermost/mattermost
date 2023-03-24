// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"gopkg.in/guregu/null.v4"

	"github.com/jmoiron/sqlx"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/pkg/errors"
)

const (
	legacyEventTypeCommanderChanged = "commander_changed"
)

type sqlPlaybookRun struct {
	app.PlaybookRun
	ChecklistsJSON                        json.RawMessage
	ConcatenatedInvitedUserIDs            string
	ConcatenatedInvitedGroupIDs           string
	ConcatenatedParticipantIDs            string
	ConcatenatedBroadcastChannelIDs       string
	ConcatenatedWebhookOnCreationURLs     string
	ConcatenatedWebhookOnStatusUpdateURLs string
	Metric                                null.Int
}

type sqlRunMetricData struct {
	IncidentID     string
	MetricConfigID string
	Value          null.Int
}

// playbookRunStore holds the information needed to fulfill the methods in the store interface.
type playbookRunStore struct {
	pluginAPI                        PluginAPIClient
	store                            *SQLStore
	queryBuilder                     sq.StatementBuilderType
	playbookRunSelect                sq.SelectBuilder
	statusPostsSelect                sq.SelectBuilder
	timelineEventsSelect             sq.SelectBuilder
	metricsDataSelectSingleRun       sq.SelectBuilder
	sqlMetricsDataSelectMultipleRuns sq.SelectBuilder
}

// Ensure playbookRunStore implements the app.PlaybookRunStore interface.
var _ app.PlaybookRunStore = (*playbookRunStore)(nil)

type playbookRunStatusPosts []struct {
	PlaybookRunID string
	app.StatusPost
}

func applyPlaybookRunFilterOptionsSort(builder sq.SelectBuilder, options app.PlaybookRunFilterOptions) (sq.SelectBuilder, error) {
	var sort string
	switch options.Sort {
	case app.SortByCreateAt:
		sort = "CreateAt"
	case app.SortByID:
		sort = "ID"
	case app.SortByName:
		sort = "Name"
	case app.SortByOwnerUserID:
		sort = "OwnerUserID"
	case app.SortByTeamID:
		sort = "TeamID"
	case app.SortByEndAt:
		sort = "EndAt"
	case app.SortByStatus:
		sort = "CurrentStatus"
	case app.SortByLastStatusUpdateAt:
		sort = "LastStatusUpdateAt"
	case "":
		// Default to a stable sort if none explicitly provided.
		sort = "ID"
	case app.SortByMetric0, app.SortByMetric1, app.SortByMetric2, app.SortByMetric3:
		// Will handle below
	default:
		return sq.SelectBuilder{}, errors.Errorf("unsupported sort parameter '%s'", options.Sort)
	}

	var direction string
	switch options.Direction {
	case app.DirectionAsc:
		direction = "ASC"
	case app.DirectionDesc:
		direction = "DESC"
	case "":
		// Default to an ascending sort if none explicitly provided.
		direction = "ASC"
	default:
		return sq.SelectBuilder{}, errors.Errorf("unsupported direction parameter '%s'", options.Direction)
	}

	page := options.Page
	perPage := options.PerPage
	if page < 0 {
		page = 0
	}
	if perPage < 0 {
		perPage = 0
	}

	builder = builder.
		Offset(uint64(page * perPage)).
		Limit(uint64(perPage))

	switch options.Sort {
	case app.SortByMetric0, app.SortByMetric1, app.SortByMetric2, app.SortByMetric3:
		if options.PlaybookID == "" {
			return sq.SelectBuilder{}, errors.New("sorting by metric requires a playbook_id")
		}

		ordering := 0
		switch options.Sort {
		case app.SortByMetric1:
			ordering = 1
		case app.SortByMetric2:
			ordering = 2
		case app.SortByMetric3:
			ordering = 3
		}

		// Since we're sorting by metric, we need to create the correct metric column to sort by
		builder = builder.Column(
			sq.Alias(
				sq.Select("m.Value").
					From("IR_Metric AS m").
					InnerJoin("IR_MetricConfig AS mc ON (mc.ID = m.MetricConfigID)").
					Where("mc.DeleteAt = 0").
					Where(sq.Eq{"mc.PlaybookID": options.PlaybookID}).
					Where("m.IncidentID = i.ID").
					Where(sq.Eq{"mc.Ordering": ordering}),
				"Metric",
			)).
			OrderByClause("Metric " + direction)
	default:
		builder = builder.OrderByClause(fmt.Sprintf("%s %s", sort, direction))
	}

	return builder, nil
}

// NewPlaybookRunStore creates a new store for playbook run ServiceImpl.
func NewPlaybookRunStore(pluginAPI PluginAPIClient, sqlStore *SQLStore) app.PlaybookRunStore {
	// construct the participants list so that the frontend doesn't have to query the server, bc if
	// the user is not a member of the channel they won't have permissions to get the user list
	participantsCol := `
        COALESCE(
			(SELECT string_agg(rp.UserId, ',')
				FROM IR_Incident as i2
					JOIN IR_Run_Participants as rp on rp.IncidentID = i2.ID
				WHERE i2.Id = i.Id
				AND rp.IsParticipant = true
				AND rp.UserId NOT IN (SELECT UserId FROM Bots)
			), ''
        ) AS ConcatenatedParticipantIDs`
	if sqlStore.db.DriverName() == model.DatabaseDriverMysql {
		participantsCol = `
        COALESCE(
			(SELECT group_concat(rp.UserId separator ',')
				FROM IR_Incident as i2
					JOIN IR_Run_Participants as rp on rp.IncidentID = i2.ID
				WHERE i2.Id = i.Id
				AND rp.IsParticipant = true
				AND rp.UserId NOT IN (SELECT UserId FROM Bots)
			), ''
        ) AS ConcatenatedParticipantIDs`
	}

	// When adding a PlaybookRun column #1: add to this select
	playbookRunSelect := sqlStore.builder.
		Select("i.ID", "i.Name AS Name", "i.Description AS Summary", "i.CommanderUserID AS OwnerUserID", "i.TeamID", "i.ChannelID",
			"i.CreateAt", "i.EndAt", "i.DeleteAt", "i.PostID", "i.PlaybookID", "i.ReporterUserID", "i.CurrentStatus", "i.LastStatusUpdateAt",
			"i.ChecklistsJSON", "COALESCE(i.ReminderPostID, '') ReminderPostID", "i.PreviousReminder",
			"COALESCE(ReminderMessageTemplate, '') ReminderMessageTemplate", "ReminderTimerDefaultSeconds", "StatusUpdateEnabled",
			"ConcatenatedInvitedUserIDs", "ConcatenatedInvitedGroupIDs", "DefaultCommanderID AS DefaultOwnerID",
			"ConcatenatedBroadcastChannelIDs", "ConcatenatedWebhookOnCreationURLs", "Retrospective", "RetrospectiveEnabled", "MessageOnJoin", "RetrospectivePublishedAt", "RetrospectiveReminderIntervalSeconds",
			"RetrospectiveWasCanceled", "ConcatenatedWebhookOnStatusUpdateURLs", "StatusUpdateBroadcastChannelsEnabled", "StatusUpdateBroadcastWebhooksEnabled",
			"CreateChannelMemberOnNewParticipant", "RemoveChannelMemberOnRemovedParticipant",
			"COALESCE(CategoryName, '') CategoryName", "SummaryModifiedAt", "i.RunType AS Type").
		Column(participantsCol).
		From("IR_Incident AS i")

	statusPostsSelect := sqlStore.builder.
		Select("sp.IncidentID AS PlaybookRunID", "p.ID", "p.CreateAt", "p.DeleteAt").
		From("IR_StatusPosts as sp").
		Join("Posts as p ON sp.PostID = p.Id")

	timelineEventsSelect := sqlStore.builder.
		Select(
			"te.ID",
			"te.IncidentID AS PlaybookRunID",
			"te.CreateAt",
			"te.DeleteAt",
			"te.EventAt",
		).
		// Map "commander_changed" to "owner_changed", preserving database compatibility
		// without complicating the code.
		Column(
			sq.Alias(
				sq.Case().
					When(sq.Eq{"te.EventType": legacyEventTypeCommanderChanged}, sq.Expr("?", app.OwnerChanged)).
					Else("te.EventType"),
				"EventType",
			),
		).
		Columns(
			"te.Summary",
			"te.Details",
			"te.PostID",
			"te.SubjectUserID",
			"te.CreatorUserID",
		).
		From("IR_TimelineEvent as te")

	metricsDataSelectSingleRun := sqlStore.builder.
		Select("MetricConfigID", "Value").
		From("IR_Metric AS m").
		Join("IR_MetricConfig AS mc ON (mc.ID = m.MetricConfigID)").
		Where("mc.DeleteAt = 0")

	sqlMetricsDataSelectMultipleRuns := sqlStore.builder.
		Select("IncidentID", "MetricConfigID", "Value").
		From("IR_Metric AS m").
		Join("IR_MetricConfig AS mc ON (mc.ID = m.MetricConfigID)").
		Where("mc.DeleteAt = 0").
		OrderBy("mc.Ordering ASC")

	return &playbookRunStore{
		pluginAPI:                        pluginAPI,
		store:                            sqlStore,
		queryBuilder:                     sqlStore.builder,
		playbookRunSelect:                playbookRunSelect,
		statusPostsSelect:                statusPostsSelect,
		timelineEventsSelect:             timelineEventsSelect,
		metricsDataSelectSingleRun:       metricsDataSelectSingleRun,
		sqlMetricsDataSelectMultipleRuns: sqlMetricsDataSelectMultipleRuns,
	}
}

// GetPlaybookRuns returns filtered playbook runs and the total count before paging.
func (s *playbookRunStore) GetPlaybookRuns(requesterInfo app.RequesterInfo, options app.PlaybookRunFilterOptions) (*app.GetPlaybookRunsResults, error) {
	permissionsExpr := s.buildPermissionsExpr(requesterInfo)
	teamLimitExpr := buildTeamLimitExpr(requesterInfo, options.TeamID, "i")

	queryForResults := s.playbookRunSelect.
		Where(permissionsExpr).
		Where(teamLimitExpr)

	queryForTotal := s.store.builder.
		Select("COUNT(*)").
		From("IR_Incident AS i").
		Where(permissionsExpr).
		Where(teamLimitExpr)

	if len(options.Statuses) != 0 {
		queryForResults = queryForResults.Where(sq.Eq{"i.CurrentStatus": options.Statuses})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.CurrentStatus": options.Statuses})
	}

	if len(options.Types) != 0 {
		queryForResults = queryForResults.Where(sq.Eq{"i.RunType": options.Types})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.RunType": options.Types})
	}

	if options.OwnerID != "" {
		queryForResults = queryForResults.Where(sq.Eq{"i.CommanderUserID": options.OwnerID})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.CommanderUserID": options.OwnerID})
	}

	if options.ParticipantID != "" {
		membershipClause := s.queryBuilder.
			Select("1").
			Prefix("EXISTS(").
			From("IR_Run_Participants AS p").
			Where("p.IncidentID = i.ID").
			Where("p.IsParticipant = true").
			Where(sq.Eq{"p.UserID": strings.ToLower(options.ParticipantID)}).
			Suffix(")")

		queryForResults = queryForResults.Where(membershipClause)
		queryForTotal = queryForTotal.Where(membershipClause)
	}

	if options.ParticipantOrFollowerID != "" {
		userIDFilter := strings.ToLower(options.ParticipantOrFollowerID)
		followerFilterExpr := sq.Expr(`EXISTS(SELECT 1
			FROM IR_Run_Participants as rp
			WHERE rp.IncidentID = i.ID
			AND rp.UserID = ?
			AND rp.IsFollower = TRUE)`, userIDFilter)
		participantFilterExpr := sq.Expr(`EXISTS(SELECT 1
			FROM IR_Run_Participants as rp
			WHERE rp.IncidentID = i.ID
			AND rp.UserID = ?
			AND rp.IsParticipant = TRUE)`, userIDFilter)
		myRunsClause := sq.Or{followerFilterExpr, participantFilterExpr}

		if options.IncludeFavorites {
			favoriteFilterExpr := sq.Expr(`EXISTS(SELECT 1
				FROM IR_Category AS cat
				INNER JOIN IR_Category_Item it ON cat.ID = it.CategoryID
				WHERE cat.Name = 'Favorite'
				AND	it.Type = 'r'
				AND	it.ItemID = i.ID
				AND cat.UserID = ?)`, userIDFilter)
			myRunsClause = append(myRunsClause, favoriteFilterExpr)
		}

		queryForResults = queryForResults.Where(myRunsClause)
		queryForTotal = queryForTotal.Where(myRunsClause)
	}

	if options.PlaybookID != "" {
		queryForResults = queryForResults.Where(sq.Eq{"i.PlaybookID": options.PlaybookID})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.PlaybookID": options.PlaybookID})
	}

	// TODO: do we need to sanitize (replace any '%'s in the search term)?
	if options.SearchTerm != "" {
		column := "i.Name"
		searchString := options.SearchTerm

		// Postgres performs a case-sensitive search, so we need to lowercase
		// both the column contents and the search string
		if s.store.db.DriverName() == model.DatabaseDriverPostgres {
			column = "LOWER(i.Name)"
			searchString = strings.ToLower(options.SearchTerm)
		}

		queryForResults = queryForResults.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
		queryForTotal = queryForTotal.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
	}

	if options.ChannelID != "" {
		queryForResults = queryForResults.Where(sq.Eq{"i.ChannelId": options.ChannelID})
		queryForTotal = queryForTotal.Where(sq.Eq{"i.ChannelId": options.ChannelID})
	}

	queryForResults = queryActiveBetweenTimes(queryForResults, options.ActiveGTE, options.ActiveLT)
	queryForTotal = queryActiveBetweenTimes(queryForTotal, options.ActiveGTE, options.ActiveLT)

	queryForResults = queryStartedBetweenTimes(queryForResults, options.StartedGTE, options.StartedLT)
	queryForTotal = queryStartedBetweenTimes(queryForTotal, options.StartedGTE, options.StartedLT)

	queryForResults, err := applyPlaybookRunFilterOptionsSort(queryForResults, options)
	if err != nil {
		return nil, errors.Wrap(err, "failed to apply sort options")
	}

	tx, err := s.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	var rawPlaybookRuns []sqlPlaybookRun
	if err = s.store.selectBuilder(tx, &rawPlaybookRuns, queryForResults); err != nil {
		return nil, errors.Wrap(err, "failed to query for playbook runs")
	}

	var total int
	if err = s.store.getBuilder(tx, &total, queryForTotal); err != nil {
		return nil, errors.Wrap(err, "failed to get total count")
	}
	pageCount := 0
	if options.PerPage > 0 {
		pageCount = int(math.Ceil(float64(total) / float64(options.PerPage)))
	}
	hasMore := options.Page+1 < pageCount

	playbookRuns := make([]app.PlaybookRun, 0, len(rawPlaybookRuns))
	playbookRunIDs := make([]string, 0, len(rawPlaybookRuns))
	for _, rawPlaybookRun := range rawPlaybookRuns {
		var playbookRun *app.PlaybookRun
		playbookRun, err = s.toPlaybookRun(rawPlaybookRun)
		if err != nil {
			return nil, err
		}
		playbookRuns = append(playbookRuns, *playbookRun)
		playbookRunIDs = append(playbookRunIDs, playbookRun.ID)
	}

	var statusPosts playbookRunStatusPosts

	postInfoSelect := s.statusPostsSelect.
		OrderBy("p.CreateAt").
		Where(sq.Eq{"sp.IncidentID": playbookRunIDs})

	err = s.store.selectBuilder(tx, &statusPosts, postInfoSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, "failed to get playbook run status posts")
	}

	timelineEvents, err := s.getTimelineEventsForPlaybookRun(tx, playbookRunIDs)
	if err != nil {
		return nil, err
	}

	metricsData, err := s.getMetricsForPlaybookRun(tx, playbookRunIDs)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	addStatusPostsToPlaybookRuns(statusPosts, playbookRuns)
	addTimelineEventsToPlaybookRuns(timelineEvents, playbookRuns)
	addMetricsToPlaybookRuns(metricsData, playbookRuns)

	return &app.GetPlaybookRunsResults{
		TotalCount: total,
		PageCount:  pageCount,
		PerPage:    options.PerPage,
		HasMore:    hasMore,
		Items:      playbookRuns,
	}, nil
}

// CreatePlaybookRun creates a new playbook run. If playbook run has an ID, that ID will be used.
func (s *playbookRunStore) CreatePlaybookRun(playbookRun *app.PlaybookRun) (*app.PlaybookRun, error) {
	if playbookRun == nil {
		return nil, errors.New("playbook run is nil")
	}

	playbookRun = playbookRun.Clone()

	if playbookRun.ID == "" {
		playbookRun.ID = model.NewId()
	}

	playbookRun.Checklists = populateChecklistIDs(playbookRun.Checklists)

	rawPlaybookRun, err := toSQLPlaybookRun(*playbookRun)
	if err != nil {
		return nil, err
	}

	if rawPlaybookRun.Type != app.RunTypeChannelChecklist && rawPlaybookRun.Type != app.RunTypePlaybook {
		rawPlaybookRun.Type = app.RunTypePlaybook
	}

	// When adding a PlaybookRun column #2: add to the SetMap
	_, err = s.store.execBuilder(s.store.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":                                      rawPlaybookRun.ID,
			"Name":                                    rawPlaybookRun.Name,
			"Description":                             rawPlaybookRun.Summary,
			"SummaryModifiedAt":                       rawPlaybookRun.SummaryModifiedAt,
			"CommanderUserID":                         rawPlaybookRun.OwnerUserID,
			"ReporterUserID":                          rawPlaybookRun.ReporterUserID,
			"TeamID":                                  rawPlaybookRun.TeamID,
			"ChannelID":                               rawPlaybookRun.ChannelID,
			"CreateAt":                                rawPlaybookRun.CreateAt,
			"EndAt":                                   rawPlaybookRun.EndAt,
			"PostID":                                  rawPlaybookRun.PostID,
			"PlaybookID":                              rawPlaybookRun.PlaybookID,
			"ChecklistsJSON":                          rawPlaybookRun.ChecklistsJSON,
			"ReminderPostID":                          rawPlaybookRun.ReminderPostID,
			"PreviousReminder":                        rawPlaybookRun.PreviousReminder,
			"ReminderMessageTemplate":                 rawPlaybookRun.ReminderMessageTemplate,
			"StatusUpdateEnabled":                     rawPlaybookRun.StatusUpdateEnabled,
			"ReminderTimerDefaultSeconds":             rawPlaybookRun.ReminderTimerDefaultSeconds,
			"CurrentStatus":                           rawPlaybookRun.CurrentStatus,
			"LastStatusUpdateAt":                      rawPlaybookRun.LastStatusUpdateAt,
			"ConcatenatedInvitedUserIDs":              rawPlaybookRun.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":             rawPlaybookRun.ConcatenatedInvitedGroupIDs,
			"DefaultCommanderID":                      rawPlaybookRun.DefaultOwnerID,
			"ConcatenatedBroadcastChannelIDs":         rawPlaybookRun.ConcatenatedBroadcastChannelIDs,
			"ConcatenatedWebhookOnCreationURLs":       rawPlaybookRun.ConcatenatedWebhookOnCreationURLs,
			"Retrospective":                           rawPlaybookRun.Retrospective,
			"RetrospectivePublishedAt":                rawPlaybookRun.RetrospectivePublishedAt,
			"RetrospectiveEnabled":                    rawPlaybookRun.RetrospectiveEnabled,
			"MessageOnJoin":                           rawPlaybookRun.MessageOnJoin,
			"RetrospectiveReminderIntervalSeconds":    rawPlaybookRun.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveWasCanceled":                rawPlaybookRun.RetrospectiveWasCanceled,
			"ConcatenatedWebhookOnStatusUpdateURLs":   rawPlaybookRun.ConcatenatedWebhookOnStatusUpdateURLs,
			"CategoryName":                            rawPlaybookRun.CategoryName,
			"StatusUpdateBroadcastChannelsEnabled":    rawPlaybookRun.StatusUpdateBroadcastChannelsEnabled,
			"StatusUpdateBroadcastWebhooksEnabled":    rawPlaybookRun.StatusUpdateBroadcastWebhooksEnabled,
			"CreateChannelMemberOnNewParticipant":     rawPlaybookRun.CreateChannelMemberOnNewParticipant,
			"RemoveChannelMemberOnRemovedParticipant": rawPlaybookRun.RemoveChannelMemberOnRemovedParticipant,
			"RunType":                                 rawPlaybookRun.Type,
			// Preserved for backwards compatibility with v1.2
			"ActiveStage":      0,
			"ActiveStageTitle": "",
			"IsActive":         true,
			"DeleteAt":         0,
		}))

	if err != nil {
		return nil, errors.Wrapf(err, "failed to store new playbook run")
	}

	return playbookRun, nil
}

// UpdatePlaybookRun updates a playbook run.
func (s *playbookRunStore) UpdatePlaybookRun(playbookRun *app.PlaybookRun) (*app.PlaybookRun, error) {
	if playbookRun == nil {
		return nil, errors.New("playbook run is nil")
	}
	if playbookRun.ID == "" {
		return nil, errors.New("ID should not be empty")
	}

	playbookRun = playbookRun.Clone()
	playbookRun.Checklists = populateChecklistIDs(playbookRun.Checklists)

	rawPlaybookRun, err := toSQLPlaybookRun(*playbookRun)
	if err != nil {
		return nil, err
	}
	tx, err := s.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	// When adding a PlaybookRun column #3: add to this SetMap (if it is a column that can be updated)
	_, err = s.store.execBuilder(tx, sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"Name":                                    rawPlaybookRun.Name,
			"Description":                             rawPlaybookRun.Summary,
			"SummaryModifiedAt":                       rawPlaybookRun.SummaryModifiedAt,
			"CommanderUserID":                         rawPlaybookRun.OwnerUserID,
			"LastStatusUpdateAt":                      rawPlaybookRun.LastStatusUpdateAt,
			"ChecklistsJSON":                          rawPlaybookRun.ChecklistsJSON,
			"ReminderPostID":                          rawPlaybookRun.ReminderPostID,
			"PreviousReminder":                        rawPlaybookRun.PreviousReminder,
			"ConcatenatedInvitedUserIDs":              rawPlaybookRun.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":             rawPlaybookRun.ConcatenatedInvitedGroupIDs,
			"DefaultCommanderID":                      rawPlaybookRun.DefaultOwnerID,
			"ConcatenatedBroadcastChannelIDs":         rawPlaybookRun.ConcatenatedBroadcastChannelIDs,
			"ConcatenatedWebhookOnCreationURLs":       rawPlaybookRun.ConcatenatedWebhookOnCreationURLs,
			"Retrospective":                           rawPlaybookRun.Retrospective,
			"RetrospectivePublishedAt":                rawPlaybookRun.RetrospectivePublishedAt,
			"MessageOnJoin":                           rawPlaybookRun.MessageOnJoin,
			"RetrospectiveReminderIntervalSeconds":    rawPlaybookRun.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveWasCanceled":                rawPlaybookRun.RetrospectiveWasCanceled,
			"ConcatenatedWebhookOnStatusUpdateURLs":   rawPlaybookRun.ConcatenatedWebhookOnStatusUpdateURLs,
			"StatusUpdateBroadcastChannelsEnabled":    rawPlaybookRun.StatusUpdateBroadcastChannelsEnabled,
			"StatusUpdateBroadcastWebhooksEnabled":    rawPlaybookRun.StatusUpdateBroadcastWebhooksEnabled,
			"StatusUpdateEnabled":                     rawPlaybookRun.StatusUpdateEnabled,
			"CreateChannelMemberOnNewParticipant":     rawPlaybookRun.CreateChannelMemberOnNewParticipant,
			"RemoveChannelMemberOnRemovedParticipant": rawPlaybookRun.RemoveChannelMemberOnRemovedParticipant,
			"RunType": rawPlaybookRun.Type,
		}).
		Where(sq.Eq{"ID": rawPlaybookRun.ID}))

	if err != nil {
		return nil, errors.Wrapf(err, "failed to update playbook run with id '%s'", rawPlaybookRun.ID)
	}

	if err = s.updateRunMetrics(tx, rawPlaybookRun.PlaybookRun); err != nil {
		return nil, errors.Wrapf(err, "failed to update playbook run metrics for run with id '%s'", rawPlaybookRun.PlaybookRun.ID)
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	return playbookRun, nil
}

func (s *playbookRunStore) UpdateStatus(statusPost *app.SQLStatusPost) error {
	if statusPost == nil {
		return errors.New("status post is nil")
	}
	if statusPost.PlaybookRunID == "" {
		return errors.New("needs playbook run ID")
	}
	if statusPost.PostID == "" {
		return errors.New("needs post ID")
	}

	if _, err := s.store.execBuilder(s.store.db, sq.
		Insert("IR_StatusPosts").
		SetMap(map[string]interface{}{
			"IncidentID": statusPost.PlaybookRunID,
			"PostID":     statusPost.PostID,
		})); err != nil {
		return errors.Wrap(err, "failed to add new status post")
	}

	return nil
}

func (s *playbookRunStore) FinishPlaybookRun(playbookRunID string, endAt int64) error {
	if _, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"CurrentStatus": app.StatusFinished,
			"EndAt":         endAt,
		}).
		Where(sq.Eq{"ID": playbookRunID}),
	); err != nil {
		return errors.Wrapf(err, "failed to finish run for id '%s'", playbookRunID)
	}

	return nil
}

func (s *playbookRunStore) RestorePlaybookRun(playbookRunID string, restoredAt int64) error {
	if _, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_Incident").
		SetMap(map[string]interface{}{
			"CurrentStatus":      app.StatusInProgress,
			"EndAt":              0,
			"LastStatusUpdateAt": restoredAt,
		}).
		Where(sq.Eq{"ID": playbookRunID})); err != nil {
		return errors.Wrapf(err, "failed to restore run for id '%s'", playbookRunID)
	}

	return nil
}

// CreateTimelineEvent creates the timeline event
func (s *playbookRunStore) CreateTimelineEvent(event *app.TimelineEvent) (*app.TimelineEvent, error) {
	if event.PlaybookRunID == "" {
		return nil, errors.New("needs playbook run ID")
	}
	if event.EventType == "" {
		return nil, errors.New("needs event type")
	}
	if event.CreateAt == 0 {
		event.CreateAt = model.GetMillis()
	}
	event.ID = model.NewId()

	eventType := string(event.EventType)
	if event.EventType == app.OwnerChanged {
		eventType = legacyEventTypeCommanderChanged
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Insert("IR_TimelineEvent").
		SetMap(map[string]interface{}{
			"ID":            event.ID,
			"IncidentID":    event.PlaybookRunID,
			"CreateAt":      event.CreateAt,
			"DeleteAt":      event.DeleteAt,
			"EventAt":       event.EventAt,
			"EventType":     eventType,
			"Summary":       event.Summary,
			"Details":       event.Details,
			"PostID":        event.PostID,
			"SubjectUserID": event.SubjectUserID,
			"CreatorUserID": event.CreatorUserID,
		}))

	if err != nil {
		return nil, errors.Wrap(err, "failed to insert timeline event")
	}

	return event, nil
}

// UpdateTimelineEvent updates (or inserts) the timeline event
func (s *playbookRunStore) UpdateTimelineEvent(event *app.TimelineEvent) error {
	if event.ID == "" {
		return errors.New("needs event ID")
	}
	if event.PlaybookRunID == "" {
		return errors.New("needs playbook run ID")
	}
	if event.EventType == "" {
		return errors.New("needs event type")
	}

	eventType := string(event.EventType)
	if event.EventType == app.OwnerChanged {
		eventType = legacyEventTypeCommanderChanged
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_TimelineEvent").
		SetMap(map[string]interface{}{
			"IncidentID":    event.PlaybookRunID,
			"CreateAt":      event.CreateAt,
			"DeleteAt":      event.DeleteAt,
			"EventAt":       event.EventAt,
			"EventType":     eventType,
			"Summary":       event.Summary,
			"Details":       event.Details,
			"PostID":        event.PostID,
			"SubjectUserID": event.SubjectUserID,
			"CreatorUserID": event.CreatorUserID,
		}).
		Where(sq.Eq{"ID": event.ID}))

	if err != nil {
		return errors.Wrap(err, "failed to update timeline event")
	}

	return nil
}

// GetPlaybookRun gets a playbook run by ID.
func (s *playbookRunStore) GetPlaybookRun(playbookRunID string) (*app.PlaybookRun, error) {
	if playbookRunID == "" {
		return nil, errors.New("ID cannot be empty")
	}

	tx, err := s.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	var rawPlaybookRun sqlPlaybookRun
	err = s.store.getBuilder(tx, &rawPlaybookRun, s.playbookRunSelect.Where(sq.Eq{"i.ID": playbookRunID}))
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "playbook run with id '%s' does not exist", playbookRunID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get playbook run by id '%s'", playbookRunID)
	}

	playbookRun, err := s.toPlaybookRun(rawPlaybookRun)
	if err != nil {
		return nil, err
	}

	var statusPosts playbookRunStatusPosts

	postInfoSelect := s.statusPostsSelect.
		Where(sq.Eq{"sp.IncidentID": playbookRunID}).
		OrderBy("p.CreateAt")

	err = s.store.selectBuilder(tx, &statusPosts, postInfoSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrapf(err, "failed to get playbook run status posts for playbook run with id '%s'", playbookRunID)
	}

	timelineEvents, err := s.getTimelineEventsForPlaybookRun(tx, []string{playbookRunID})
	if err != nil {
		return nil, err
	}

	var metricsData []app.RunMetricData

	err = s.store.selectBuilder(tx, &metricsData, s.metricsDataSelectSingleRun.
		Where(sq.Eq{"IncidentID": playbookRunID}).
		OrderBy("MetricConfigID")) // Entirely for consistency for the tests)

	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrapf(err, "failed to get metrics data for run with id `%s`", playbookRunID)
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "could not commit transaction")
	}

	for _, p := range statusPosts {
		playbookRun.StatusPosts = append(playbookRun.StatusPosts, p.StatusPost)
	}

	playbookRun.TimelineEvents = append(playbookRun.TimelineEvents, timelineEvents...)
	playbookRun.MetricsData = metricsData

	return playbookRun, nil
}

func (s *playbookRunStore) getTimelineEventsForPlaybookRun(q sqlx.Queryer, playbookRunIDs []string) ([]app.TimelineEvent, error) {
	var timelineEvents []app.TimelineEvent

	timelineEventsSelect := s.timelineEventsSelect.
		OrderBy("te.EventAt ASC").
		Where(sq.And{sq.Eq{"te.IncidentID": playbookRunIDs}, sq.Eq{"te.DeleteAt": 0}})

	err := s.store.selectBuilder(q, &timelineEvents, timelineEventsSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, "failed to get timelineEvents")
	}

	return timelineEvents, nil
}

func (s *playbookRunStore) getMetricsForPlaybookRun(q sqlx.Queryer, playbookRunIDs []string) ([]sqlRunMetricData, error) {
	var metricsData []sqlRunMetricData

	sqlMetricsDataSelect := s.sqlMetricsDataSelectMultipleRuns.
		Where(sq.Eq{"IncidentID": playbookRunIDs})

	err := s.store.selectBuilder(q, &metricsData, sqlMetricsDataSelect)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, "failed to get metricsData")
	}

	return metricsData, nil
}

// GetTimelineEvent returns the timeline event by id for the given playbook run.
func (s *playbookRunStore) GetTimelineEvent(playbookRunID, eventID string) (*app.TimelineEvent, error) {
	var event app.TimelineEvent

	timelineEventSelect := s.timelineEventsSelect.
		Where(sq.And{sq.Eq{"te.IncidentID": playbookRunID}, sq.Eq{"te.ID": eventID}})

	err := s.store.getBuilder(s.store.db, &event, timelineEventSelect)
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "timeline event with id (%s) does not exist for playbook run with id (%s)", eventID, playbookRunID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get timeline event with id (%s) for playbook run with id (%s)", eventID, playbookRunID)
	}

	return &event, nil
}

// GetPlaybookRunIDsForChannel gets the playbook run IDs list associated with the given channel ID.
func (s *playbookRunStore) GetPlaybookRunIDsForChannel(channelID string) ([]string, error) {
	query := s.queryBuilder.
		Select("i.ID").
		From("IR_Incident i").
		Where(sq.Eq{"i.ChannelID": channelID}).
		Where(sq.Eq{"i.CurrentStatus": app.StatusInProgress}).
		OrderBy("i.CreateAt DESC").
		OrderBy("i.ID")

	var ids []string
	err := s.store.selectBuilder(s.store.db, &ids, query)
	if err == sql.ErrNoRows || len(ids) == 0 {
		return nil, errors.Wrapf(app.ErrNotFound, "channel with id (%s) does not have a playbook run", channelID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get playbook run by channelID '%s'", channelID)
	}

	return ids, nil
}

// GetHistoricalPlaybookRunParticipantsCount returns the count of all members of a playbook run's channel
// since the beginning of the playbook run, excluding bots.
func (s *playbookRunStore) GetHistoricalPlaybookRunParticipantsCount(channelID string) (int64, error) {
	query := s.queryBuilder.
		Select("COUNT(DISTINCT cmh.UserId)").
		From("ChannelMemberHistory AS cmh").
		Where(sq.Eq{"cmh.ChannelId": channelID}).
		Where(sq.Expr("cmh.UserId NOT IN (SELECT UserId FROM Bots)"))

	var numParticipants int64
	err := s.store.getBuilder(s.store.db, &numParticipants, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to query database")
	}

	return numParticipants, nil
}

// GetOwners returns the owners of the playbook runs selected by options
func (s *playbookRunStore) GetOwners(requesterInfo app.RequesterInfo, options app.PlaybookRunFilterOptions) ([]app.OwnerInfo, error) {
	permissionsExpr := s.buildPermissionsExpr(requesterInfo)
	teamLimitExpr := buildTeamLimitExpr(requesterInfo, options.TeamID, "i")

	// At the moment, the options only includes teamID
	query := s.queryBuilder.
		Select("DISTINCT u.Id AS UserID", "u.Username", "u.FirstName", "u.LastName", "u.Nickname").
		From("IR_Incident AS i").
		Join("Users AS u ON i.CommanderUserID = u.Id").
		Where(teamLimitExpr).
		Where(permissionsExpr)

	var owners []app.OwnerInfo
	err := s.store.selectBuilder(s.store.db, &owners, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query database")
	}

	return owners, nil
}

// NukeDB removes all playbook run related data.
func (s *playbookRunStore) NukeDB() (err error) {
	tx, err := s.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer s.store.finalizeTransaction(tx)

	if _, err := tx.Exec("DROP TABLE IF EXISTS IR_Metric, IR_MetricConfig, IR_PlaybookMember, IR_Run_Participants, IR_PlaybookAutoFollow, IR_StatusPosts, IR_TimelineEvent, IR_Incident, IR_Playbook, IR_System"); err != nil {
		return errors.Wrap(err, "could not delete all IR tables")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit")
	}

	return s.store.RunMigrations()
}

func (s *playbookRunStore) ChangeCreationDate(playbookRunID string, creationTimestamp time.Time) error {
	updateQuery := s.queryBuilder.Update("IR_Incident").
		Where(sq.Eq{"ID": playbookRunID}).
		Set("CreateAt", model.GetMillisForTime(creationTimestamp))

	sqlResult, err := s.store.execBuilder(s.store.db, updateQuery)
	if err != nil {
		return errors.Wrapf(err, "unable to execute the update query")
	}

	numRows, err := sqlResult.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "unable to check how many rows were updated")
	}

	if numRows == 0 {
		return app.ErrNotFound
	}

	return nil
}

func (s *playbookRunStore) GetBroadcastChannelIDsToRootIDs(playbookRunID string) (map[string]string, error) {
	var retAsJSON string
	query := s.store.builder.Select("COALESCE(ChannelIDToRootID, '')").
		From("IR_Incident").
		Where(sq.Eq{"ID": playbookRunID})

	err := s.store.getBuilder(s.store.db, &retAsJSON, query)
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "could not find playbook with id '%s'", playbookRunID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get channelID to rootID map for playbookRunID '%s'", playbookRunID)
	}

	ret := make(map[string]string)
	if retAsJSON == "" {
		return ret, nil
	}

	if err := json.Unmarshal([]byte(retAsJSON), &ret); err != nil {
		return nil, errors.Wrapf(err, "failed to unmarshal channelID to rootID map for playbookRunID: '%s'", playbookRunID)
	}

	return ret, nil
}

func (s *playbookRunStore) SetBroadcastChannelIDsToRootID(playbookRunID string, channelIDsToRootIDs map[string]string) error {
	data, err := json.Marshal(channelIDsToRootIDs)
	if err != nil {
		return errors.Wrap(err, "failed to marshal channelIDsToRootIDs map")
	}

	_, err = s.store.execBuilder(s.store.db,
		sq.Update("IR_Incident").
			Set("ChannelIDToRootID", data).
			Where(sq.Eq{"ID": playbookRunID}))
	if err != nil {
		return errors.Wrapf(err, "failed to set ChannelIDsToRootID column for playbookRunID '%s'", playbookRunID)
	}

	return nil
}

func (s *playbookRunStore) buildPermissionsExpr(info app.RequesterInfo) sq.Sqlizer {
	if info.IsAdmin {
		return nil
	}

	// Guests must be participants
	if info.IsGuest {
		return sq.Expr(`
			  EXISTS(SELECT 1
						 FROM IR_Run_Participants as rp
						 WHERE rp.IncidentID = i.ID
						   AND rp.UserId = ?
						   AND rp.IsParticipant = true
					   )
		`, info.UserID)
	}

	// 1. Is the user a participant of the run?
	// 2. Is the playbook open to everyone on the team, or is the user a member of the playbook?
	//    If so, they have permission to view the run.
	return sq.Expr(`
        ((
			EXISTS (
                    SELECT 1
						FROM IR_Run_Participants as rp
						WHERE rp.IncidentID = i.ID
						  AND rp.UserId = ?
						  AND rp.IsParticipant = true
					  )
			) OR (
				(SELECT Public
					FROM IR_Playbook
					WHERE ID = i.PlaybookID)
				  OR EXISTS(
						SELECT 1
							FROM IR_PlaybookMember
							WHERE PlaybookID = i.PlaybookID
							  AND MemberID = ?)
		))`, info.UserID, info.UserID)
}

func buildTeamLimitExpr(info app.RequesterInfo, teamID, tableName string) sq.Sqlizer {
	filterToSelectedTeam := sq.Eq{fmt.Sprintf("%s.TeamID", tableName): teamID}
	onlyTeamsUserIsAMember := sq.Expr(fmt.Sprintf(`
		EXISTS(SELECT 1
					FROM TeamMembers as tm
					WHERE tm.TeamId = %s.TeamID
					  AND tm.DeleteAt = 0
		  	  		  AND tm.UserId = ?)
		`, tableName), info.UserID)

	if info.IsAdmin {
		if teamID != "" {
			return filterToSelectedTeam
		}
		return nil
	}

	if teamID != "" {
		return sq.And{
			filterToSelectedTeam,
			onlyTeamsUserIsAMember,
		}
	}

	return onlyTeamsUserIsAMember

}

func (s *playbookRunStore) toPlaybookRun(rawPlaybookRun sqlPlaybookRun) (*app.PlaybookRun, error) {
	playbookRun := rawPlaybookRun.PlaybookRun
	if err := json.Unmarshal(rawPlaybookRun.ChecklistsJSON, &playbookRun.Checklists); err != nil {
		return nil, errors.Wrapf(err, "failed to unmarshal checklists json for playbook run id: %s", rawPlaybookRun.ID)
	}

	playbookRun.InvitedUserIDs = []string(nil)
	if rawPlaybookRun.ConcatenatedInvitedUserIDs != "" {
		playbookRun.InvitedUserIDs = strings.Split(rawPlaybookRun.ConcatenatedInvitedUserIDs, ",")
	}

	playbookRun.InvitedGroupIDs = []string(nil)
	if rawPlaybookRun.ConcatenatedInvitedGroupIDs != "" {
		playbookRun.InvitedGroupIDs = strings.Split(rawPlaybookRun.ConcatenatedInvitedGroupIDs, ",")
	}

	playbookRun.ParticipantIDs = []string(nil)
	if rawPlaybookRun.ConcatenatedParticipantIDs != "" {
		playbookRun.ParticipantIDs = strings.Split(rawPlaybookRun.ConcatenatedParticipantIDs, ",")
	}

	playbookRun.BroadcastChannelIDs = []string(nil)
	if rawPlaybookRun.ConcatenatedBroadcastChannelIDs != "" {
		playbookRun.BroadcastChannelIDs = strings.Split(rawPlaybookRun.ConcatenatedBroadcastChannelIDs, ",")
	}

	playbookRun.WebhookOnCreationURLs = []string(nil)
	if rawPlaybookRun.ConcatenatedWebhookOnCreationURLs != "" {
		playbookRun.WebhookOnCreationURLs = strings.Split(rawPlaybookRun.ConcatenatedWebhookOnCreationURLs, ",")
	}

	playbookRun.WebhookOnStatusUpdateURLs = []string(nil)
	if rawPlaybookRun.ConcatenatedWebhookOnStatusUpdateURLs != "" {
		playbookRun.WebhookOnStatusUpdateURLs = strings.Split(rawPlaybookRun.ConcatenatedWebhookOnStatusUpdateURLs, ",")
	}

	// force false broadcast-on-status-update flags if they have no destinations
	if len(playbookRun.WebhookOnStatusUpdateURLs) == 0 {
		playbookRun.StatusUpdateBroadcastWebhooksEnabled = false
	}
	if len(playbookRun.BroadcastChannelIDs) == 0 {
		playbookRun.StatusUpdateBroadcastChannelsEnabled = false
	}

	return &playbookRun, nil
}

// GetRunsWithAssignedTasks returns the list of runs that have tasks assigned to userID
func (s *playbookRunStore) GetRunsWithAssignedTasks(userID string) ([]app.AssignedRun, error) {
	var raw []struct {
		app.AssignedRun
		ChecklistsJSON json.RawMessage
	}

	query := s.store.builder.Select("i.ID AS PlaybookRunID", "i.Name", "i.ChecklistsJSON AS ChecklistsJSON").
		From("IR_Incident AS i").
		Where(sq.Eq{"i.CurrentStatus": app.StatusInProgress}).
		OrderBy("i.Name")

	if s.store.db.DriverName() == model.DatabaseDriverMysql {
		query = query.Where(sq.Like{"i.ChecklistsJSON": fmt.Sprintf("%%\"%s\"%%", userID)})
	} else {
		query = query.Where(sq.Like{"i.ChecklistsJSON::text": fmt.Sprintf("%%\"%s\"%%", userID)})
	}

	if err := s.store.selectBuilder(s.store.db, &raw, query); err != nil {
		return nil, errors.Wrap(err, "failed to query for assigned tasks")
	}

	var ret []app.AssignedRun
	for _, rawItem := range raw {
		run := rawItem.AssignedRun

		var checklists []app.Checklist
		err := json.Unmarshal(rawItem.ChecklistsJSON, &checklists)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to unmarshal checklists json for playbook run id: %s", rawItem.PlaybookRunID)
		}

		// Check which item(s) have this user as an assignee and add them to the list
		for _, checklist := range checklists {
			for _, item := range checklist.Items {
				if item.AssigneeID == userID && item.State == "" {
					task := app.AssignedTask{
						ChecklistID:    checklist.ID,
						ChecklistTitle: checklist.Title,
						ChecklistItem:  item,
					}
					run.Tasks = append(run.Tasks, task)
				}
			}
		}

		if len(run.Tasks) > 0 {
			ret = append(ret, run)
		}
	}

	return ret, nil
}

// GetParticipatingRuns returns the list of active runs with userID as a participant
func (s *playbookRunStore) GetParticipatingRuns(userID string) ([]app.RunLink, error) {
	membershipClause := s.queryBuilder.
		Select("1").
		Prefix("EXISTS(").
		From("IR_Run_Participants AS rp").
		Where("rp.IncidentID = i.ID").
		Where(sq.Eq{"rp.UserId": userID}).
		Where(sq.Eq{"rp.IsParticipant": true}).
		Suffix(")")

	query := s.store.builder.
		Select("i.ID AS PlaybookRunID", "i.Name").
		From("IR_Incident AS i").
		Where(sq.Eq{"i.CurrentStatus": app.StatusInProgress}).
		Where(membershipClause).
		OrderBy("i.Name")

	var ret []app.RunLink
	if err := s.store.selectBuilder(s.store.db, &ret, query); err != nil {
		return nil, errors.Wrap(err, "failed to query for active runs")
	}

	return ret, nil
}

// GetOverdueUpdateRuns returns runs owned by userID and that have overdue status updates.
func (s *playbookRunStore) GetOverdueUpdateRuns(userID string) ([]app.RunLink, error) {
	// only notify if the user is still a participant
	// in other words: don't notify the commander of an overdue run if they have left the run
	membershipClause := s.queryBuilder.
		Select("1").
		Prefix("EXISTS(").
		From("IR_Run_Participants AS rp").
		Where("rp.IncidentID = i.ID").
		Where(sq.Eq{"rp.UserId": userID}).
		Where(sq.Eq{"rp.IsParticipant": true}).
		Suffix(")")

	query := s.store.builder.
		Select("i.ID AS PlaybookRunID", "i.Name").
		From("IR_Incident AS i").
		Where(sq.Eq{"i.CurrentStatus": app.StatusInProgress}).
		Where(sq.NotEq{"i.PreviousReminder": 0}).
		Where(sq.Eq{"i.CommanderUserId": userID}).
		Where(sq.Eq{"i.StatusUpdateEnabled": true}).
		Where(membershipClause).
		OrderBy("i.Name")

	if s.store.db.DriverName() == model.DatabaseDriverMysql {
		query = query.Where(sq.Expr("(i.PreviousReminder / 1e6 + i.LastStatusUpdateAt) <= FLOOR(UNIX_TIMESTAMP() * 1000)"))
	} else {
		query = query.Where(sq.Expr("(i.PreviousReminder / 1e6 + i.LastStatusUpdateAt) <= FLOOR(EXTRACT (EPOCH FROM now())::float*1000)"))
	}

	var ret []app.RunLink
	if err := s.store.selectBuilder(s.store.db, &ret, query); err != nil {
		return nil, errors.Wrap(err, "failed to query for active runs")
	}

	return ret, nil
}

func (s *playbookRunStore) Follow(playbookRunID, userID string) error {
	return s.updateFollowing(playbookRunID, userID, true)
}

func (s *playbookRunStore) Unfollow(playbookRunID, userID string) error {
	return s.updateFollowing(playbookRunID, userID, false)
}

func (s *playbookRunStore) updateFollowing(playbookRunID, userID string, isFollowing bool) error {
	var err error
	if s.store.db.DriverName() == model.DatabaseDriverMysql {
		_, err = s.store.execBuilder(s.store.db, sq.
			Insert("IR_Run_Participants").
			Columns("IncidentID", "UserID", "IsFollower").
			Values(playbookRunID, userID, isFollowing).
			Suffix("ON DUPLICATE KEY UPDATE IsFollower = ?", isFollowing))
	} else {
		_, err = s.store.execBuilder(s.store.db, sq.
			Insert("IR_Run_Participants").
			Columns("IncidentID", "UserID", "IsFollower").
			Values(playbookRunID, userID, isFollowing).
			Suffix("ON CONFLICT (IncidentID,UserID) DO UPDATE SET IsFollower = ?", isFollowing))
	}

	if err != nil {
		return errors.Wrapf(err, "failed to upsert follower '%s' for run '%s'", userID, playbookRunID)
	}

	return nil
}

func (s *playbookRunStore) GetFollowers(playbookRunID string) ([]string, error) {
	query := s.queryBuilder.
		Select("UserID").
		From("IR_Run_Participants").
		Where(sq.And{sq.Eq{"IsFollower": true}, sq.Eq{"IncidentID": playbookRunID}})

	var followers []string
	err := s.store.selectBuilder(s.store.db, &followers, query)
	if err == sql.ErrNoRows {
		return []string{}, nil
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get followers for run '%s'", playbookRunID)
	}

	return followers, nil
}

// Get number of active runs.
func (s *playbookRunStore) GetRunsActiveTotal() (int64, error) {
	var count int64

	query := s.store.builder.
		Select("COUNT(*)").
		From("IR_Incident").
		Where(sq.Eq{"CurrentStatus": app.StatusInProgress})

	if err := s.store.getBuilder(s.store.db, &count, query); err != nil {
		return 0, errors.Wrap(err, "failed to count active runs'")
	}

	return count, nil
}

// GetOverdueUpdateRunsTotal returns number of runs that have overdue status updates.
func (s *playbookRunStore) GetOverdueUpdateRunsTotal() (int64, error) {
	query := s.store.builder.
		Select("COUNT(*)").
		From("IR_Incident").
		Where(sq.Eq{"CurrentStatus": app.StatusInProgress}).
		Where(sq.Eq{"StatusUpdateEnabled": true}).
		Where(sq.NotEq{"PreviousReminder": 0})

	if s.store.db.DriverName() == model.DatabaseDriverMysql {
		query = query.Where(sq.Expr("(PreviousReminder / 1e6 + LastStatusUpdateAt) <= FLOOR(UNIX_TIMESTAMP() * 1000)"))
	} else {
		query = query.Where(sq.Expr("(PreviousReminder / 1e6 + LastStatusUpdateAt) <= FLOOR(EXTRACT (EPOCH FROM now())::float*1000)"))
	}

	var count int64
	if err := s.store.getBuilder(s.store.db, &count, query); err != nil {
		return 0, errors.Wrap(err, "failed to count active runs that have overdue status updates")
	}

	return count, nil
}

// GetOverdueRetroRunsTotal returns the number of completed runs without retro and with reminder
func (s *playbookRunStore) GetOverdueRetroRunsTotal() (int64, error) {
	query := s.store.builder.
		Select("COUNT(*)").
		From("IR_Incident").
		Where(sq.Eq{"CurrentStatus": app.StatusFinished}).
		Where(sq.Eq{"RetrospectiveEnabled": true}).
		Where(sq.Eq{"RetrospectivePublishedAt": 0}).
		Where(sq.NotEq{"RetrospectiveReminderIntervalSeconds": 0})

	var count int64
	if err := s.store.getBuilder(s.store.db, &count, query); err != nil {
		return 0, errors.Wrap(err, "failed to count finished runs without retro")
	}

	return count, nil
}

// GetFollowersActiveTotal returns total number of active followers, including duplicates
// if a user is following more than one run, it will be counted multiple times
func (s *playbookRunStore) GetFollowersActiveTotal() (int64, error) {
	var count int64

	query := s.store.builder.
		Select("COUNT(*)").
		From("IR_Run_Participants as rp").
		Join("IR_Incident AS i ON (i.ID = rp.IncidentID)").
		Where(sq.Eq{"rp.IsFollower": true}).
		Where(sq.Eq{"i.CurrentStatus": app.StatusInProgress})

	if err := s.store.getBuilder(s.store.db, &count, query); err != nil {
		return 0, errors.Wrap(err, "failed to count active followers'")
	}

	return count, nil
}

// GetParticipantsActiveTotal returns number of active participants
// if a user is a participant in more than one run they will be counted multiple times
func (s *playbookRunStore) GetParticipantsActiveTotal() (int64, error) {
	var count int64

	query := s.store.builder.
		Select("COUNT(*)").
		From("IR_Run_Participants as rp").
		Join("IR_Incident AS i ON i.ID = rp.IncidentID").
		Where(sq.Eq{"i.CurrentStatus": app.StatusInProgress}).
		Where(sq.Eq{"rp.IsParticipant": true}).
		Where(sq.Expr("rp.UserId NOT IN (SELECT UserId FROM Bots)"))

	if err := s.store.getBuilder(s.store.db, &count, query); err != nil {
		return 0, errors.Wrap(err, "failed to count active participants")
	}

	return count, nil
}

// GetSchemeRolesForChannel scheme role ids for the channel
func (s *playbookRunStore) GetSchemeRolesForChannel(channelID string) (string, string, string, error) {
	query := s.queryBuilder.
		Select("COALESCE(s.DefaultChannelGuestRole, 'channel_guest') DefaultChannelGuestRole",
			"COALESCE(s.DefaultChannelUserRole, 'channel_user') DefaultChannelUserRole",
			"COALESCE(s.DefaultChannelAdminRole, 'channel_admin') DefaultChannelAdminRole").
		From("Schemes as s").
		Join("Channels AS c ON (c.SchemeId = s.Id)").
		Where(sq.Eq{"c.Id": channelID})

	var scheme model.Scheme
	err := s.store.getBuilder(s.store.db, &scheme, query)

	return scheme.DefaultChannelGuestRole, scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole, err
}

// GetSchemeRolesForTeam scheme role ids for the team
func (s *playbookRunStore) GetSchemeRolesForTeam(teamID string) (string, string, string, error) {
	query := s.queryBuilder.
		Select("COALESCE(s.DefaultChannelGuestRole, 'channel_guest') DefaultChannelGuestRole",
			"COALESCE(s.DefaultChannelUserRole, 'channel_user') DefaultChannelUserRole",
			"COALESCE(s.DefaultChannelAdminRole, 'channel_admin') DefaultChannelAdminRole").
		From("Schemes as s").
		Join("Teams AS t ON (t.SchemeId = s.Id)").
		Where(sq.Eq{"t.Id": teamID})

	var scheme model.Scheme
	err := s.store.getBuilder(s.store.db, &scheme, query)

	return scheme.DefaultChannelGuestRole, scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole, err
}

// updateRunMetrics updates run metrics values.
func (s *playbookRunStore) updateRunMetrics(q queryExecer, playbookRun app.PlaybookRun) error {
	if len(playbookRun.MetricsData) == 0 {
		return nil
	}

	//retrieve metrics configurations ids for this run to validate received data
	query := s.queryBuilder.
		Select("ID").
		From("IR_MetricConfig").
		Where(sq.Eq{"PlaybookID": playbookRun.PlaybookID}).
		Where(sq.Eq{"DeleteAt": 0})

	var metricsConfigsIDs []string
	err := s.store.selectBuilder(q, &metricsConfigsIDs, query)
	if err != nil {
		return errors.Wrapf(err, "failed to get metric configs ids for playbook '%s'", playbookRun.PlaybookID)
	}
	validIDs := make(map[string]bool)
	for _, id := range metricsConfigsIDs {
		validIDs[id] = true
	}

	retrospectivePublished := !playbookRun.RetrospectiveWasCanceled && playbookRun.RetrospectivePublishedAt > 0

	for _, m := range playbookRun.MetricsData {
		//do not store if id is not in run's playbook configuration
		if !validIDs[m.MetricConfigID] {
			continue
		}
		if s.store.db.DriverName() == model.DatabaseDriverMysql {
			_, err = s.store.execBuilder(q, sq.
				Insert("IR_Metric").
				Columns("IncidentID", "MetricConfigID", "Value", "Published").
				Values(playbookRun.ID, m.MetricConfigID, m.Value, retrospectivePublished).
				Suffix("ON DUPLICATE KEY UPDATE Value = ?, Published = ?", m.Value, retrospectivePublished))
		} else {
			_, err = s.store.execBuilder(q, sq.
				Insert("IR_Metric").
				Columns("IncidentID", "MetricConfigID", "Value", "Published").
				Values(playbookRun.ID, m.MetricConfigID, m.Value, retrospectivePublished).
				Suffix("ON CONFLICT (IncidentID,MetricConfigID) DO UPDATE SET Value = ?, Published = ?", m.Value, retrospectivePublished))
		}
		if err != nil {
			return errors.Wrapf(err, "failed to upsert metric value '%s'", m.MetricConfigID)
		}
	}
	return nil
}

func (s *playbookRunStore) AddParticipants(playbookRunID string, userIDs []string) error {
	return s.updateParticipating(playbookRunID, userIDs, true)
}

func (s *playbookRunStore) RemoveParticipants(playbookRunID string, userIDs []string) error {
	return s.updateParticipating(playbookRunID, userIDs, false)
}

func (s *playbookRunStore) updateParticipating(playbookRunID string, userIDs []string, isParticipating bool) error {
	if len(userIDs) == 0 {
		return nil
	}

	query := sq.
		Insert("IR_Run_Participants").
		Columns("IncidentID", "UserID", "IsParticipant")

	for _, userID := range userIDs {
		query = query.Values(playbookRunID, userID, isParticipating)
	}

	var err error
	if s.store.db.DriverName() == model.DatabaseDriverMysql {
		_, err = s.store.execBuilder(
			s.store.db,
			query.Suffix("ON DUPLICATE KEY UPDATE IsParticipant = ?", isParticipating),
		)
	} else {
		_, err = s.store.execBuilder(
			s.store.db,
			query.Suffix("ON CONFLICT (IncidentID,UserID) DO UPDATE SET IsParticipant = ?", isParticipating),
		)
	}

	if err != nil {
		return errors.Wrapf(err, "failed to upsert participants '%+v' for run '%s'", userIDs, playbookRunID)
	}

	return nil
}

// GetPlaybookRunIDsForUser returns run ids where user is a participant or is following
func (s *playbookRunStore) GetPlaybookRunIDsForUser(userID string) ([]string, error) {
	requesterInfo := app.RequesterInfo{UserID: userID}
	permissionsExpr := s.buildPermissionsExpr(requesterInfo)
	teamLimitExpr := buildTeamLimitExpr(requesterInfo, "", "i")

	query := s.store.builder.
		Select("i.ID").
		From("IR_Incident AS i").
		Join("IR_Run_Participants AS p ON p.IncidentID = i.ID").
		Where(sq.Or{sq.Eq{"p.IsParticipant": true}, sq.Eq{"p.IsFollower": true}}).
		Where(sq.Eq{"p.UserID": strings.ToLower(userID)}).
		Where(teamLimitExpr).
		Where(permissionsExpr)

	var ids []string
	if err := s.store.selectBuilder(s.store.db, &ids, query); err != nil {
		return nil, errors.Wrap(err, "failed to query for playbook runs")
	}
	return ids, nil
}

// GetRunMetadataByIDs returns playbook runs metadata by passed run IDs.
func (s *playbookRunStore) GetRunMetadataByIDs(runIDs []string) ([]app.RunMetadata, error) {
	var runs []app.RunMetadata
	query := s.store.builder.
		Select("ID", "TeamID", "Name").
		From("IR_Incident").
		Where(sq.Eq{"ID": runIDs})
	if err := s.store.selectBuilder(s.store.db, &runs, query); err != nil {
		return nil, errors.Wrap(err, "failed to query playbook run by runIDs")
	}

	runsMap := make(map[string]app.RunMetadata, len(runs))
	for _, run := range runs {
		runsMap[run.ID] = run
	}
	orderedRuns := make([]app.RunMetadata, len(runIDs))
	for i, runID := range runIDs {
		orderedRuns[i] = runsMap[runID]
	}
	return orderedRuns, nil
}

// GetTaskAsTopicMetadataByIDs gets PlaybookRunIDs and TeamIDs from runs by taskIDs
func (s *playbookRunStore) GetTaskAsTopicMetadataByIDs(taskIDs []string) ([]app.TopicMetadata, error) {
	tasksMap := make(map[string]app.TopicMetadata, len(taskIDs))
	for _, taskID := range taskIDs {
		var runsInDB []struct {
			app.TopicMetadata
			ChecklistsJSON json.RawMessage
		}
		query := s.store.builder.
			Select("ID AS RunID", "TeamID", "ChecklistsJSON").
			From("IR_Incident")

		if s.store.db.DriverName() == model.DatabaseDriverMysql {
			query = query.Where(sq.Like{"ChecklistsJSON": fmt.Sprintf("%%\"%s\"%%", taskID)})
		} else {
			query = query.Where(sq.Like{"ChecklistsJSON::text": fmt.Sprintf("%%\"%s\"%%", taskID)})
		}

		if err := s.store.selectBuilder(s.store.db, &runsInDB, query); err != nil {
			return nil, errors.Wrapf(err, "failed to query playbook run by taskID - %s", taskID)
		}

		for _, run := range runsInDB {
			var checklists []app.Checklist
			err := json.Unmarshal(run.ChecklistsJSON, &checklists)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to unmarshal checklists json for playbook run id: %s", run.RunID)
			}

			if isTaskInChecklists(checklists, taskID) {
				tasksMap[taskID] = app.TopicMetadata{
					ID:     taskID,
					RunID:  run.RunID,
					TeamID: run.TeamID,
				}
			}
		}
	}
	tasks := make([]app.TopicMetadata, len(taskIDs))
	for i, taskID := range taskIDs {
		tasks[i] = tasksMap[taskID]
	}

	return tasks, nil
}

func isTaskInChecklists(checklists []app.Checklist, taskID string) bool {
	for _, checklist := range checklists {
		for _, item := range checklist.Items {
			if item.ID == taskID {
				return true
			}
		}
	}
	return false
}

// GetStatusAsTopicMetadataByIDs gets PlaybookRunIDs and TeamIDs from runs by statusIDs
func (s *playbookRunStore) GetStatusAsTopicMetadataByIDs(statusIDs []string) ([]app.TopicMetadata, error) {
	var statuses []app.TopicMetadata
	query := s.store.builder.
		Select("sp.PostID AS ID", "sp.IncidentID AS RunID", "i.TeamID AS TeamID").
		From("IR_StatusPosts as sp").
		Join("IR_Incident as i ON sp.IncidentID = i.ID").
		Where(sq.Eq{"sp.PostID": statusIDs})
	if err := s.store.selectBuilder(s.store.db, &statuses, query); err != nil {
		return nil, errors.Wrap(err, "failed to query playbook runs by statusIDs")
	}
	statusesMap := make(map[string]app.TopicMetadata, len(statuses))
	for _, status := range statuses {
		statusesMap[status.ID] = status
	}
	orderedStatuses := make([]app.TopicMetadata, len(statusIDs))
	for i, statusID := range statusIDs {
		orderedStatuses[i] = statusesMap[statusID]
	}
	return orderedStatuses, nil
}

func (s *playbookRunStore) GraphqlUpdate(id string, setmap map[string]interface{}) error {
	if id == "" {
		return errors.New("id should not be empty")
	}

	_, err := s.store.execBuilder(s.store.db, sq.
		Update("IR_Incident").
		SetMap(setmap).
		Where(sq.Eq{"ID": id}))

	if err != nil {
		return errors.Wrapf(err, "failed to update playbook run with id '%s'", id)
	}

	return nil
}

func toSQLPlaybookRun(playbookRun app.PlaybookRun) (*sqlPlaybookRun, error) {
	checklistsJSON, err := checklistsToJSON(playbookRun.Checklists)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal checklist json for playbook run id '%s'", playbookRun.ID)
	}

	if len(checklistsJSON) > maxJSONLength {
		return nil, errors.Wrapf(errors.New("invalid data"), "checklist json for playbook run id '%s' is too long (max %d)", playbookRun.ID, maxJSONLength)
	}

	return &sqlPlaybookRun{
		PlaybookRun:                           playbookRun,
		ChecklistsJSON:                        checklistsJSON,
		ConcatenatedInvitedUserIDs:            strings.Join(playbookRun.InvitedUserIDs, ","),
		ConcatenatedInvitedGroupIDs:           strings.Join(playbookRun.InvitedGroupIDs, ","),
		ConcatenatedBroadcastChannelIDs:       strings.Join(playbookRun.BroadcastChannelIDs, ","),
		ConcatenatedWebhookOnCreationURLs:     strings.Join(playbookRun.WebhookOnCreationURLs, ","),
		ConcatenatedWebhookOnStatusUpdateURLs: strings.Join(playbookRun.WebhookOnStatusUpdateURLs, ","),
	}, nil
}

// populateChecklistIDs returns a cloned slice with ids entered for checklists and checklist items.
func populateChecklistIDs(checklists []app.Checklist) []app.Checklist {
	if len(checklists) == 0 {
		return nil
	}

	newChecklists := make([]app.Checklist, len(checklists))
	for i, c := range checklists {
		newChecklists[i] = c.Clone()
		if newChecklists[i].ID == "" {
			newChecklists[i].ID = model.NewId()
		}
		for j, item := range newChecklists[i].Items {
			if item.ID == "" {
				newChecklists[i].Items[j].ID = model.NewId()
			}
		}
	}

	return newChecklists
}

// A playbook run needs to assign unique ids to its checklist items
func checklistsToJSON(checklists []app.Checklist) (json.RawMessage, error) {
	checklistsJSON, err := json.Marshal(checklists)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal checklist json")
	}

	return checklistsJSON, nil
}

func addStatusPostsToPlaybookRuns(statusIDs playbookRunStatusPosts, playbookRuns []app.PlaybookRun) {
	iToPosts := make(map[string][]app.StatusPost)
	for _, p := range statusIDs {
		iToPosts[p.PlaybookRunID] = append(iToPosts[p.PlaybookRunID], p.StatusPost)
	}
	for i, playbookRun := range playbookRuns {
		playbookRuns[i].StatusPosts = iToPosts[playbookRun.ID]
	}
}

func addTimelineEventsToPlaybookRuns(timelineEvents []app.TimelineEvent, playbookRuns []app.PlaybookRun) {
	iToTe := make(map[string][]app.TimelineEvent)
	for _, te := range timelineEvents {
		iToTe[te.PlaybookRunID] = append(iToTe[te.PlaybookRunID], te)
	}
	for i, playbookRun := range playbookRuns {
		playbookRuns[i].TimelineEvents = iToTe[playbookRun.ID]
	}
}

func addMetricsToPlaybookRuns(metrics []sqlRunMetricData, playbookRuns []app.PlaybookRun) {
	playbookRunToMetrics := make(map[string][]app.RunMetricData)
	for _, metric := range metrics {
		playbookRunToMetrics[metric.IncidentID] = append(playbookRunToMetrics[metric.IncidentID],
			app.RunMetricData{
				MetricConfigID: metric.MetricConfigID,
				Value:          metric.Value,
			})
	}

	for i, run := range playbookRuns {
		playbookRuns[i].MetricsData = playbookRunToMetrics[run.ID]
	}
}

// queryActiveBetweenTimes will modify the query only if one (or both) of start and end are non-zero.
// If both are non-zero, return the playbook runs active between those two times.
// If start is zero, return the playbook run active before the end (not active after the end).
// If end is zero, return the playbook run active after start.
func queryActiveBetweenTimes(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	if start > 0 && end > 0 {
		return queryActive(query, start, end)
	} else if start > 0 {
		return queryActive(query, start, model.GetMillis())
	} else if end > 0 {
		return queryActive(query, 0, end)
	}

	// both were zero, don't apply a filter:
	return query
}

func queryActive(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	return query.Where(
		sq.And{
			sq.Or{
				sq.GtOrEq{"i.EndAt": start},
				sq.Eq{"i.EndAt": 0},
			},
			sq.Lt{"i.CreateAt": end},
		})
}

// queryStartedBetweenTimes will modify the query only if one (or both) of start and end are non-zero.
// If both are non-zero, return the playbook runs started between those two times.
// If start is zero, return the playbook run started before the end
// If end is zero, return the playbook run started after start.
func queryStartedBetweenTimes(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	if start > 0 && end > 0 {
		return queryStarted(query, start, end)
	} else if start > 0 {
		return queryStarted(query, start, model.GetMillis())
	} else if end > 0 {
		return queryStarted(query, 0, end)
	}

	// both were zero, don't apply a filter:
	return query
}

func queryStarted(query sq.SelectBuilder, start int64, end int64) sq.SelectBuilder {
	return query.Where(
		sq.And{
			sq.GtOrEq{"i.CreateAt": start},
			sq.Lt{"i.CreateAt": end},
		})
}
