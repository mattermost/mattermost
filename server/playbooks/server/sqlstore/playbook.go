// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/app"
	"github.com/pkg/errors"
)

type sqlPlaybook struct {
	app.Playbook
	ChecklistsJSON                        json.RawMessage
	ConcatenatedInvitedUserIDs            string
	ConcatenatedInvitedGroupIDs           string
	ConcatenatedSignalAnyKeywords         string
	ConcatenatedBroadcastChannelIDs       string
	ConcatenatedWebhookOnCreationURLs     string
	ConcatenatedWebhookOnStatusUpdateURLs string
}

// playbookStore is a sql store for playbooks. Use NewPlaybookStore to create it.
type playbookStore struct {
	pluginAPI      PluginAPIClient
	store          *SQLStore
	queryBuilder   sq.StatementBuilderType
	playbookSelect sq.SelectBuilder
	membersSelect  sq.SelectBuilder
	metricsSelect  sq.SelectBuilder
}

// Ensure playbookStore implements the playbook.Store interface.
var _ app.PlaybookStore = (*playbookStore)(nil)

type playbookMember struct {
	PlaybookID string
	MemberID   string
	Roles      string
}

// definied to call a common insights query builder for both user and team insights
const insightsQueryTypeUser = "insights_query_type_user"
const insightsQueryTypeTeam = "insights_query_type_team"

func applyPlaybookFilterOptionsSort(builder sq.SelectBuilder, options app.PlaybookFilterOptions) (sq.SelectBuilder, error) {
	var sort string
	switch options.Sort {
	case app.SortByID:
		sort = "ID"
	case app.SortByTitle:
		sort = "Title"
	case app.SortByStages:
		sort = "NumStages"
	case app.SortBySteps:
		sort = "NumSteps"
	case app.SortByRuns:
		sort = "NumRuns"
	case app.SortByCreateAt:
		sort = "CreateAt"
	case app.SortByLastRunAt:
		sort = "LastRunAt"
	case app.SortByActiveRuns:
		sort = "ActiveRuns"
	case "":
		// Default to a stable sort if none explicitly provided.
		sort = "ID"
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

	builder = builder.OrderByClause(fmt.Sprintf("%s %s", sort, direction))

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

	return builder, nil
}

// NewPlaybookStore creates a new store for playbook service.
func NewPlaybookStore(pluginAPI PluginAPIClient, sqlStore *SQLStore) app.PlaybookStore {
	playbookSelect := sqlStore.builder.
		Select(
			"p.ID",
			"p.Title",
			"p.Description",
			"p.Public",
			"p.TeamID",
			"p.CreatePublicIncident AS CreatePublicPlaybookRun",
			"p.CreateAt",
			"p.UpdateAt",
			"p.DeleteAt",
			"p.NumStages",
			"p.NumSteps",
			`(
				1 + -- Channel creation is hard-coded
				CASE WHEN p.InviteUsersEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.DefaultCommanderEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.BroadcastEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnCreationEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.MessageOnJoinEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnStatusUpdateEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.SignalAnyKeywordsEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.CategorizeChannelEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.CreateChannelMemberOnNewParticipant THEN 1 ELSE 0 END +
				CASE WHEN p.RemoveChannelMemberOnRemovedParticipant THEN 1 ELSE 0 END
			) AS NumActions`,
			"COALESCE(p.ReminderMessageTemplate, '') ReminderMessageTemplate",
			"p.ReminderTimerDefaultSeconds",
			"p.StatusUpdateEnabled",
			"p.ConcatenatedInvitedUserIDs",
			"p.ConcatenatedInvitedGroupIDs",
			"p.InviteUsersEnabled",
			"p.DefaultCommanderID AS DefaultOwnerID",
			"p.DefaultCommanderEnabled AS DefaultOwnerEnabled",
			"p.ConcatenatedBroadcastChannelIDs",
			"p.BroadcastEnabled",
			"p.ConcatenatedWebhookOnCreationURLs",
			"p.WebhookOnCreationEnabled",
			"p.MessageOnJoin",
			"p.MessageOnJoinEnabled",
			"p.RetrospectiveReminderIntervalSeconds",
			"p.RetrospectiveTemplate",
			"p.RetrospectiveEnabled",
			"p.ConcatenatedWebhookOnStatusUpdateURLs",
			"p.WebhookOnStatusUpdateEnabled",
			"p.ConcatenatedSignalAnyKeywords",
			"p.SignalAnyKeywordsEnabled",
			"p.CategorizeChannelEnabled",
			"p.CreateChannelMemberOnNewParticipant",
			"p.RemoveChannelMemberOnRemovedParticipant",
			"p.ChannelID",
			"p.ChannelMode",
			"p.ChecklistsJSON",
			"COALESCE(p.CategoryName, '') CategoryName",
			"p.RunSummaryTemplateEnabled",
			"COALESCE(p.RunSummaryTemplate, '') RunSummaryTemplate",
			"COALESCE(p.ChannelNameTemplate, '') ChannelNameTemplate",
			"COALESCE(s.DefaultPlaybookAdminRole, 'playbook_admin') DefaultPlaybookAdminRole",
			"COALESCE(s.DefaultPlaybookMemberRole, 'playbook_member') DefaultPlaybookMemberRole",
			"COALESCE(s.DefaultRunAdminRole, 'run_admin') DefaultRunAdminRole",
			"COALESCE(s.DefaultRunMemberRole, 'run_member') DefaultRunMemberRole",
		).
		From("IR_Playbook p").
		LeftJoin("Teams t ON t.Id = p.TeamID").
		LeftJoin("Schemes s ON t.SchemeId = s.Id")

	membersSelect := sqlStore.builder.
		Select(
			"PlaybookID",
			"MemberID",
			"Roles",
		).
		From("IR_PlaybookMember").
		OrderBy("MemberID ASC") // Entirely for consistency for the tests

	metricsSelect := sqlStore.builder.
		Select(
			"ID",
			"PlaybookID",
			"Title",
			"Description",
			"Type",
			"Target",
		).
		From("IR_MetricConfig").
		Where(sq.Eq{"DeleteAt": 0}).
		OrderBy("Ordering ASC")

	newStore := &playbookStore{
		pluginAPI:      pluginAPI,
		store:          sqlStore,
		queryBuilder:   sqlStore.builder,
		playbookSelect: playbookSelect,
		membersSelect:  membersSelect,
		metricsSelect:  metricsSelect,
	}
	return newStore
}

// Create creates a new playbook
func (p *playbookStore) Create(playbook app.Playbook) (id string, err error) {
	if playbook.ID != "" {
		return "", errors.New("ID should be empty")
	}
	playbook.ID = model.NewId()

	rawPlaybook, err := toSQLPlaybook(playbook)
	if err != nil {
		return "", err
	}

	tx, err := p.store.db.Beginx()
	if err != nil {
		return "", errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	_, err = p.store.execBuilder(tx, sq.
		Insert("IR_Playbook").
		SetMap(map[string]interface{}{
			"ID":                                      rawPlaybook.ID,
			"Title":                                   rawPlaybook.Title,
			"Description":                             rawPlaybook.Description,
			"TeamID":                                  rawPlaybook.TeamID,
			"Public":                                  rawPlaybook.Public,
			"CreatePublicIncident":                    rawPlaybook.CreatePublicPlaybookRun,
			"CreateAt":                                rawPlaybook.CreateAt,
			"UpdateAt":                                rawPlaybook.UpdateAt,
			"DeleteAt":                                rawPlaybook.DeleteAt,
			"ChecklistsJSON":                          rawPlaybook.ChecklistsJSON,
			"NumStages":                               len(rawPlaybook.Checklists),
			"NumSteps":                                getSteps(rawPlaybook.Playbook),
			"ReminderMessageTemplate":                 rawPlaybook.ReminderMessageTemplate,
			"ReminderTimerDefaultSeconds":             rawPlaybook.ReminderTimerDefaultSeconds,
			"StatusUpdateEnabled":                     rawPlaybook.StatusUpdateEnabled,
			"ConcatenatedInvitedUserIDs":              rawPlaybook.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":             rawPlaybook.ConcatenatedInvitedGroupIDs,
			"InviteUsersEnabled":                      rawPlaybook.InviteUsersEnabled,
			"DefaultCommanderID":                      rawPlaybook.DefaultOwnerID,
			"DefaultCommanderEnabled":                 rawPlaybook.DefaultOwnerEnabled,
			"ConcatenatedBroadcastChannelIDs":         rawPlaybook.ConcatenatedBroadcastChannelIDs,
			"BroadcastEnabled":                        rawPlaybook.BroadcastEnabled, //nolint
			"ConcatenatedWebhookOnCreationURLs":       rawPlaybook.ConcatenatedWebhookOnCreationURLs,
			"WebhookOnCreationEnabled":                rawPlaybook.WebhookOnCreationEnabled,
			"MessageOnJoin":                           rawPlaybook.MessageOnJoin,
			"MessageOnJoinEnabled":                    rawPlaybook.MessageOnJoinEnabled,
			"RetrospectiveReminderIntervalSeconds":    rawPlaybook.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveTemplate":                   rawPlaybook.RetrospectiveTemplate,
			"RetrospectiveEnabled":                    rawPlaybook.RetrospectiveEnabled,
			"ConcatenatedWebhookOnStatusUpdateURLs":   rawPlaybook.ConcatenatedWebhookOnStatusUpdateURLs,
			"WebhookOnStatusUpdateEnabled":            rawPlaybook.WebhookOnStatusUpdateEnabled,
			"ConcatenatedSignalAnyKeywords":           rawPlaybook.ConcatenatedSignalAnyKeywords,
			"SignalAnyKeywordsEnabled":                rawPlaybook.SignalAnyKeywordsEnabled,
			"CategorizeChannelEnabled":                rawPlaybook.CategorizeChannelEnabled,
			"CategoryName":                            rawPlaybook.CategoryName,
			"RunSummaryTemplateEnabled":               rawPlaybook.RunSummaryTemplateEnabled,
			"RunSummaryTemplate":                      rawPlaybook.RunSummaryTemplate,
			"ChannelNameTemplate":                     rawPlaybook.ChannelNameTemplate,
			"CreateChannelMemberOnNewParticipant":     rawPlaybook.CreateChannelMemberOnNewParticipant,
			"RemoveChannelMemberOnRemovedParticipant": rawPlaybook.RemoveChannelMemberOnRemovedParticipant,
			"ChannelID":                               rawPlaybook.ChannelID,
			"ChannelMode":                             rawPlaybook.ChannelMode,
		}))
	if err != nil {
		return "", errors.Wrap(err, "failed to store new playbook")
	}

	if err = p.replacePlaybookMembers(tx, rawPlaybook.Playbook); err != nil {
		return "", errors.Wrap(err, "failed to replace playbook members")
	}

	if err = p.replacePlaybookMetrics(tx, rawPlaybook.Playbook); err != nil {
		return "", errors.Wrap(err, "failed to replace playbook metrics configs")
	}

	if err = tx.Commit(); err != nil {
		return "", errors.Wrap(err, "could not commit transaction")
	}

	return rawPlaybook.ID, nil
}

// Get retrieves a playbook
func (p *playbookStore) Get(id string) (app.Playbook, error) {
	if id == "" {
		return app.Playbook{}, errors.New("ID cannot be empty")
	}

	tx, err := p.store.db.Beginx()
	if err != nil {
		return app.Playbook{}, errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	var rawPlaybook sqlPlaybook
	err = p.store.getBuilder(tx, &rawPlaybook, p.playbookSelect.Where(sq.Eq{"p.ID": id}))
	if err == sql.ErrNoRows {
		return app.Playbook{}, errors.Wrapf(app.ErrNotFound, "playbook does not exist for id '%s'", id)
	} else if err != nil {
		return app.Playbook{}, errors.Wrapf(err, "failed to get playbook by id '%s'", id)
	}

	playbook, err := toPlaybook(rawPlaybook)
	if err != nil {
		return app.Playbook{}, err
	}

	var members []playbookMember
	err = p.store.selectBuilder(tx, &members, p.membersSelect.Where(sq.Eq{"PlaybookID": id}))
	if err != nil && err != sql.ErrNoRows {
		return app.Playbook{}, errors.Wrapf(err, "failed to get memberIDs for playbook with id '%s'", id)
	}

	var metrics []app.PlaybookMetricConfig
	err = p.store.selectBuilder(tx, &metrics, p.metricsSelect.Where(sq.Eq{"PlaybookID": id}))
	if err != nil && err != sql.ErrNoRows {
		return app.Playbook{}, errors.Wrapf(err, "failed to get metrics configs for playbook with id '%s'", id)
	}

	if err = tx.Commit(); err != nil {
		return app.Playbook{}, errors.Wrap(err, "could not commit transaction")
	}

	addMembersToPlaybook(members, &playbook)
	playbook.Metrics = metrics
	return playbook, nil
}

// GetPlaybooks retrieves all playbooks that are not deleted.
// Members are not retrieved for this as the query would be large and we don't need it for this for now.
// This is only used for the keywords feature
func (p *playbookStore) GetPlaybooks() ([]app.Playbook, error) {
	tx, err := p.store.db.Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	var playbooks []app.Playbook
	err = p.store.selectBuilder(tx, &playbooks, p.store.builder.
		Select(
			"p.ID",
			"p.Title",
			"p.Description",
			"p.TeamID",
			"p.Public",
			"p.CreatePublicIncident AS CreatePublicPlaybookRun",
			"p.CreateAt",
			"p.DeleteAt",
			"p.NumStages",
			"p.NumSteps",
			"COUNT(i.ID) AS NumRuns",
			"COALESCE(MAX(i.CreateAt), 0) AS LastRunAt",
			`(
				1 + -- Channel creation is hard-coded
				CASE WHEN p.InviteUsersEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.DefaultCommanderEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.BroadcastEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnCreationEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.MessageOnJoinEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnStatusUpdateEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.SignalAnyKeywordsEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.CategorizeChannelEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.CreateChannelMemberOnNewParticipant THEN 1 ELSE 0 END +
				CASE WHEN p.RemoveChannelMemberOnRemovedParticipant THEN 1 ELSE 0 END
			) AS NumActions`,
			"COALESCE(ChannelNameTemplate, '') ChannelNameTemplate",
			"COALESCE(s.DefaultPlaybookAdminRole, 'playbook_admin') DefaultPlaybookAdminRole",
			"COALESCE(s.DefaultPlaybookMemberRole, 'playbook_member') DefaultPlaybookMemberRole",
			"COALESCE(s.DefaultRunAdminRole, 'run_admin') DefaultRunAdminRole",
			"COALESCE(s.DefaultRunMemberRole, 'run_member') DefaultRunMemberRole",
		).
		From("IR_Playbook AS p").
		LeftJoin("IR_Incident AS i ON p.ID = i.PlaybookID").
		LeftJoin("Teams t ON t.Id = p.TeamID").
		LeftJoin("Schemes s ON t.SchemeId = s.Id").
		Where(sq.Eq{"p.DeleteAt": 0}).
		GroupBy("p.ID").
		GroupBy("s.Id"))

	if err == sql.ErrNoRows {
		return nil, errors.Wrap(app.ErrNotFound, "no playbooks found")
	} else if err != nil {
		return nil, errors.Wrap(err, "failed to get playbooks")
	}

	return playbooks, nil
}

// GetPlaybooksForTeam retrieves all playbooks on the specified team given the provided options.
func (p *playbookStore) GetPlaybooksForTeam(requesterInfo app.RequesterInfo, teamID string, opts app.PlaybookFilterOptions) (app.GetPlaybooksResults, error) {
	// Check that you are a playbook member or there are no restrictions.
	permissionsAndFilter := sq.Expr(`(
			EXISTS(SELECT 1
				FROM IR_PlaybookMember as pm
				WHERE pm.PlaybookID = p.ID
				AND pm.MemberID = ?)
		)`, requesterInfo.UserID)
	if !opts.WithMembershipOnly { // return all public playbooks and private ones user is member of
		permissionsAndFilter = sq.Or{sq.Expr(`p.Public = true`), permissionsAndFilter}
	}
	teamLimitExpr := buildTeamLimitExpr(requesterInfo, teamID, "p")

	queryForResults := p.store.builder.
		Select(
			"p.ID",
			"p.Title",
			"p.Description",
			"p.TeamID",
			"p.Public",
			"p.CreatePublicIncident AS CreatePublicPlaybookRun",
			"p.CreateAt",
			"p.DeleteAt",
			"p.NumStages",
			"p.NumSteps",
			"p.DefaultCommanderEnabled AS DefaultOwnerEnabled",
			"p.DefaultCommanderID AS DefaultOwnerID",
			"COUNT(i.ID) AS NumRuns",
			"COUNT(CASE WHEN i.CurrentStatus='InProgress' THEN 1 END) AS ActiveRuns",
			"COALESCE(MAX(i.CreateAt), 0) AS LastRunAt",
			`(
				1 + -- Channel creation is hard-coded
				CASE WHEN p.InviteUsersEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.DefaultCommanderEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.BroadcastEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnCreationEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.MessageOnJoinEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.WebhookOnStatusUpdateEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.SignalAnyKeywordsEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.CategorizeChannelEnabled THEN 1 ELSE 0 END +
				CASE WHEN p.CreateChannelMemberOnNewParticipant THEN 1 ELSE 0 END +
				CASE WHEN p.RemoveChannelMemberOnRemovedParticipant THEN 1 ELSE 0 END
			) AS NumActions`,
			"COALESCE(ChannelNameTemplate, '') ChannelNameTemplate",
			"COALESCE(s.DefaultPlaybookAdminRole, 'playbook_admin') DefaultPlaybookAdminRole",
			"COALESCE(s.DefaultPlaybookMemberRole, 'playbook_member') DefaultPlaybookMemberRole",
			"COALESCE(s.DefaultRunAdminRole, 'run_admin') DefaultRunAdminRole",
			"COALESCE(s.DefaultRunMemberRole, 'run_member') DefaultRunMemberRole",
		).
		From("IR_Playbook AS p").
		LeftJoin("IR_Incident AS i ON p.ID = i.PlaybookID").
		LeftJoin("Teams t ON t.Id = p.TeamID").
		LeftJoin("Schemes s ON t.SchemeId = s.Id").
		GroupBy("p.ID").
		GroupBy("s.Id").
		Where(permissionsAndFilter).
		Where(teamLimitExpr)

	if len(opts.PlaybookIDs) > 0 {
		queryForResults = queryForResults.Where(sq.Eq{"p.ID": opts.PlaybookIDs})
	}
	queryForResults, err := applyPlaybookFilterOptionsSort(queryForResults, opts)
	if err != nil {
		return app.GetPlaybooksResults{}, errors.Wrap(err, "failed to apply sort options")
	}

	queryForTotal := p.store.builder.
		Select("COUNT(*)").
		From("IR_Playbook AS p").
		Where(permissionsAndFilter).
		Where(teamLimitExpr)

	if opts.SearchTerm != "" {
		column := "p.Title"
		searchString := opts.SearchTerm

		// Postgres performs a case-sensitive search, so we need to lowercase
		// both the column contents and the search string
		if p.store.db.DriverName() == model.DatabaseDriverPostgres {
			column = "LOWER(p.Title)"
			searchString = strings.ToLower(opts.SearchTerm)
		}

		queryForResults = queryForResults.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
		queryForTotal = queryForTotal.Where(sq.Like{column: fmt.Sprint("%", searchString, "%")})
	}

	if !opts.WithArchived {
		queryForResults = queryForResults.Where(sq.Eq{"p.DeleteAt": 0})
		queryForTotal = queryForTotal.Where(sq.Eq{"DeleteAt": 0})
	}

	var playbooks []app.Playbook
	err = p.store.selectBuilder(p.store.db, &playbooks, queryForResults)
	if err == sql.ErrNoRows {
		return app.GetPlaybooksResults{}, errors.Wrap(app.ErrNotFound, "no playbooks found")
	} else if err != nil {
		return app.GetPlaybooksResults{}, errors.Wrap(err, "failed to get playbooks")
	}

	var total int
	if err = p.store.getBuilder(p.store.db, &total, queryForTotal); err != nil {
		return app.GetPlaybooksResults{}, errors.Wrap(err, "failed to get total count")
	}

	ids := make([]string, len(playbooks))
	for _, pb := range playbooks {
		ids = append(ids, pb.ID)
	}
	var members []playbookMember
	err = p.store.selectBuilder(p.store.db, &members, p.membersSelect.Where(sq.Eq{"PlaybookID": ids}))
	if err != nil {
		return app.GetPlaybooksResults{}, errors.Wrap(err, "failed to get playbook members")
	}
	var metrics []app.PlaybookMetricConfig
	err = p.store.selectBuilder(p.store.db, &metrics, p.metricsSelect.Where(sq.Eq{"PlaybookID": ids}))
	if err != nil {
		return app.GetPlaybooksResults{}, errors.Wrap(err, "failed to get playbooks metrics")
	}

	addMembersToPlaybooks(members, playbooks)
	addMetricsToPlaybooks(metrics, playbooks)

	pageCount := 0
	if opts.PerPage > 0 {
		pageCount = int(math.Ceil(float64(total) / float64(opts.PerPage)))
	}
	hasMore := opts.Page+1 < pageCount

	return app.GetPlaybooksResults{
		TotalCount: total,
		PageCount:  pageCount,
		HasMore:    hasMore,
		Items:      playbooks,
	}, nil
}

// GetPlaybooksWithKeywords retrieves all playbooks with keywords enabled
func (p *playbookStore) GetPlaybooksWithKeywords(opts app.PlaybookFilterOptions) ([]app.Playbook, error) {
	queryForResults := p.store.builder.
		Select("ID", "Title", "UpdateAt", "TeamID", "ConcatenatedSignalAnyKeywords").
		From("IR_Playbook AS p").
		Where(sq.Eq{"SignalAnyKeywordsEnabled": true}).
		Offset(uint64(opts.Page * opts.PerPage)).
		Limit(uint64(opts.PerPage))

	var rawPlaybooks []sqlPlaybook
	err := p.store.selectBuilder(p.store.db, &rawPlaybooks, queryForResults)
	if err == sql.ErrNoRows {
		return []app.Playbook{}, nil
	} else if err != nil {
		return []app.Playbook{}, errors.Wrap(err, "failed to get playbooks")
	}

	playbooks := make([]app.Playbook, 0, len(rawPlaybooks))
	for _, playbook := range rawPlaybooks {
		out, err := toPlaybook(playbook)
		if err != nil {
			return nil, errors.Wrapf(err, "can't convert raw playbook to playbook type")
		}
		playbooks = append(playbooks, out)
	}
	return playbooks, nil
}

// GetTimeLastUpdated retrieves time last playbook was updated at.
// Passed argument determines whether to include playbooks with
// SignalAnyKeywordsEnabled flag or not.
func (p *playbookStore) GetTimeLastUpdated(onlyPlaybooksWithKeywordsEnabled bool) (int64, error) {
	queryForResults := p.store.builder.
		Select("COALESCE(MAX(UpdateAt), 0)").
		From("IR_Playbook AS p").
		Where(sq.Eq{"DeleteAt": 0})
	if onlyPlaybooksWithKeywordsEnabled {
		queryForResults = queryForResults.Where(sq.Eq{"SignalAnyKeywordsEnabled": true})
	}

	var updateAt []int64
	err := p.store.selectBuilder(p.store.db, &updateAt, queryForResults)
	if err == sql.ErrNoRows {
		return 0, nil
	} else if err != nil {
		return 0, errors.Wrap(err, "failed to get playbooks")
	}
	return updateAt[0], nil
}

// GetPlaybookIDsForUser retrieves playbooks user can access
// Notice that method is not checking weather or not user is member of a team
func (p *playbookStore) GetPlaybookIDsForUser(userID string, teamID string) ([]string, error) {
	// Check that you are a playbook member or there are no restrictions.
	permissionsAndFilter := sq.Expr(`(
		EXISTS(SELECT 1
				FROM IR_PlaybookMember as pm
				WHERE pm.PlaybookID = p.ID
				AND pm.MemberID = ?)
		OR NOT EXISTS(SELECT 1
				FROM IR_PlaybookMember as pm
				WHERE pm.PlaybookID = p.ID)
	)`, userID)

	queryForResults := p.store.builder.
		Select("ID").
		From("IR_Playbook AS p").
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"TeamID": teamID}).
		Where(permissionsAndFilter)

	var playbookIDs []string

	err := p.store.selectBuilder(p.store.db, &playbookIDs, queryForResults)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrapf(err, "failed to get playbookIDs for a user - %v", userID)
	}
	return playbookIDs, nil
}

func (p *playbookStore) GraphqlUpdate(id string, setmap map[string]interface{}) error {
	if id == "" {
		return errors.New("id should not be empty")
	}

	// if checklists are passed and len (as string) is bigger than limit -> fails
	if _, exists := setmap["ChecklistsJSON"]; exists {
		if len(string(setmap["ChecklistsJSON"].([]uint8))) > maxJSONLength {
			return fmt.Errorf("failed update playbook with id '%s': json too long (max %d)", id, maxJSONLength)
		}
	}

	_, err := p.store.execBuilder(p.store.db, sq.
		Update("IR_Playbook").
		SetMap(setmap).
		Where(sq.Eq{"ID": id}))

	if err != nil {
		return errors.Wrapf(err, "failed to update playbook with id '%s'", id)
	}

	return nil
}

// Update updates a playbook
func (p *playbookStore) Update(playbook app.Playbook) (err error) {
	if playbook.ID == "" {
		return errors.New("id should not be empty")
	}

	rawPlaybook, err := toSQLPlaybook(playbook)
	if err != nil {
		return err
	}

	tx, err := p.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer p.store.finalizeTransaction(tx)

	_, err = p.store.execBuilder(tx, sq.
		Update("IR_Playbook").
		SetMap(map[string]interface{}{
			"Title":                                   rawPlaybook.Title,
			"Description":                             rawPlaybook.Description,
			"TeamID":                                  rawPlaybook.TeamID,
			"Public":                                  rawPlaybook.Public,
			"CreatePublicIncident":                    rawPlaybook.CreatePublicPlaybookRun,
			"UpdateAt":                                rawPlaybook.UpdateAt,
			"DeleteAt":                                rawPlaybook.DeleteAt,
			"ChecklistsJSON":                          rawPlaybook.ChecklistsJSON,
			"NumStages":                               len(rawPlaybook.Checklists),
			"NumSteps":                                getSteps(rawPlaybook.Playbook),
			"ReminderMessageTemplate":                 rawPlaybook.ReminderMessageTemplate,
			"ReminderTimerDefaultSeconds":             rawPlaybook.ReminderTimerDefaultSeconds,
			"StatusUpdateEnabled":                     rawPlaybook.StatusUpdateEnabled,
			"ConcatenatedInvitedUserIDs":              rawPlaybook.ConcatenatedInvitedUserIDs,
			"ConcatenatedInvitedGroupIDs":             rawPlaybook.ConcatenatedInvitedGroupIDs,
			"InviteUsersEnabled":                      rawPlaybook.InviteUsersEnabled,
			"DefaultCommanderID":                      rawPlaybook.DefaultOwnerID,
			"DefaultCommanderEnabled":                 rawPlaybook.DefaultOwnerEnabled,
			"ConcatenatedBroadcastChannelIDs":         rawPlaybook.ConcatenatedBroadcastChannelIDs,
			"BroadcastEnabled":                        rawPlaybook.BroadcastEnabled, //nolint
			"ConcatenatedWebhookOnCreationURLs":       rawPlaybook.ConcatenatedWebhookOnCreationURLs,
			"WebhookOnCreationEnabled":                rawPlaybook.WebhookOnCreationEnabled,
			"MessageOnJoin":                           rawPlaybook.MessageOnJoin,
			"MessageOnJoinEnabled":                    rawPlaybook.MessageOnJoinEnabled,
			"RetrospectiveReminderIntervalSeconds":    rawPlaybook.RetrospectiveReminderIntervalSeconds,
			"RetrospectiveTemplate":                   rawPlaybook.RetrospectiveTemplate,
			"RetrospectiveEnabled":                    rawPlaybook.RetrospectiveEnabled,
			"ConcatenatedWebhookOnStatusUpdateURLs":   rawPlaybook.ConcatenatedWebhookOnStatusUpdateURLs,
			"WebhookOnStatusUpdateEnabled":            rawPlaybook.WebhookOnStatusUpdateEnabled,
			"ConcatenatedSignalAnyKeywords":           rawPlaybook.ConcatenatedSignalAnyKeywords,
			"SignalAnyKeywordsEnabled":                rawPlaybook.SignalAnyKeywordsEnabled,
			"CategorizeChannelEnabled":                rawPlaybook.CategorizeChannelEnabled,
			"CategoryName":                            rawPlaybook.CategoryName,
			"RunSummaryTemplateEnabled":               rawPlaybook.RunSummaryTemplateEnabled,
			"RunSummaryTemplate":                      rawPlaybook.RunSummaryTemplate,
			"ChannelNameTemplate":                     rawPlaybook.ChannelNameTemplate,
			"CreateChannelMemberOnNewParticipant":     rawPlaybook.CreateChannelMemberOnNewParticipant,
			"RemoveChannelMemberOnRemovedParticipant": rawPlaybook.RemoveChannelMemberOnRemovedParticipant,
			"ChannelID":                               rawPlaybook.ChannelID,
			"ChannelMode":                             rawPlaybook.ChannelMode,
		}).
		Where(sq.Eq{"ID": rawPlaybook.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update playbook with id '%s'", rawPlaybook.ID)
	}

	if err = p.replacePlaybookMembers(tx, rawPlaybook.Playbook); err != nil {
		return errors.Wrapf(err, "failed to replace playbook members for playbook with id '%s'", rawPlaybook.ID)
	}

	if err = p.replacePlaybookMetrics(tx, rawPlaybook.Playbook); err != nil {
		return errors.Wrapf(err, "failed to replace playbook metrics configs for playbook with id '%s'", rawPlaybook.ID)
	}

	if err = tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit transaction")
	}

	return nil
}

// Archive archives a playbook.
func (p *playbookStore) Archive(id string) error {
	if id == "" {
		return errors.New("ID cannot be empty")
	}

	_, err := p.store.execBuilder(p.store.db, sq.
		Update("IR_Playbook").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"ID": id}))

	if err != nil {
		return errors.Wrapf(err, "failed to delete playbook with id '%s'", id)
	}

	return nil
}

// Restore restores a deleted playbook.
func (p *playbookStore) Restore(id string) error {
	if id == "" {
		return errors.New("ID cannot be empty")
	}

	_, err := p.store.execBuilder(p.store.db, sq.
		Update("IR_Playbook").
		Set("DeleteAt", 0).
		Where(sq.Eq{"ID": id}))

	if err != nil {
		return errors.Wrapf(err, "failed to restore playbook with id '%s'", id)
	}

	return nil
}

// Get number of active playbooks.
func (p *playbookStore) GetPlaybooksActiveTotal() (int64, error) {
	var count int64

	query := p.store.builder.
		Select("COUNT(*)").
		From("IR_Playbook").
		Where(sq.Eq{"DeleteAt": 0})

	if err := p.store.getBuilder(p.store.db, &count, query); err != nil {
		return 0, errors.Wrap(err, "failed to count active playbooks'")
	}

	return count, nil
}

// Get number of active playbooks.
func (p *playbookStore) GetNumMetrics(playbookID string) (int64, error) {
	var count int64

	query := p.store.builder.
		Select("COUNT(*)").
		From("IR_MetricConfig").
		Where(sq.Eq{"PlaybookID": playbookID})

	if err := p.store.getBuilder(p.store.db, &count, query); err != nil {
		return 0, errors.Wrap(err, "failed to count metrics")
	}

	return count, nil
}

func (p *playbookStore) AddPlaybookMember(id string, memberID string) error {
	if id == "" || memberID == "" {
		return errors.New("ids should not be empty")
	}

	_, err := p.store.execBuilder(p.store.db, sq.
		Insert("IR_PlaybookMember").
		Columns("PlaybookID", "MemberID", "Roles").
		Values(id, memberID, app.PlaybookRoleMember))

	if err != nil {
		return errors.Wrapf(err, "failed to update playbook with id '%s'", id)
	}

	return nil
}

func (p *playbookStore) RemovePlaybookMember(id string, memberID string) error {
	if id == "" || memberID == "" {
		return errors.New("ids should not be empty")
	}

	_, err := p.store.execBuilder(p.store.db, sq.
		Delete("IR_PlaybookMember").
		Where(sq.Eq{"PlaybookID": id}).
		Where(sq.Eq{"MemberID": memberID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update playbook with id '%s'", id)
	}

	return nil
}

// replacePlaybookMembers replaces the members of a playbook
func (p *playbookStore) replacePlaybookMembers(q queryExecer, playbook app.Playbook) error {
	// Delete existing members who are not in the new playbook.MemberIDs list
	delBuilder := sq.Delete("IR_PlaybookMember").
		Where(sq.Eq{"PlaybookID": playbook.ID})
	if _, err := p.store.execBuilder(q, delBuilder); err != nil {
		return err
	}

	if len(playbook.Members) == 0 {
		return nil
	}

	insert := sq.
		Insert("IR_PlaybookMember").
		Columns("PlaybookID", "MemberID", "Roles")

	for _, m := range playbook.Members {
		insert = insert.Values(playbook.ID, m.UserID, strings.Join(m.Roles, " "))
	}

	if _, err := p.store.execBuilder(q, insert); err != nil {
		return err
	}

	return nil
}

// replacePlaybookMetrics replaces the metric configs of a playbook
func (p *playbookStore) replacePlaybookMetrics(q queryExecer, playbook app.Playbook) error {
	// First, we mark as deleted all existing metrics for this playbook, then restore those which are in the playbook object.
	updateBuilder := sq.Update("IR_MetricConfig").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"PlaybookID": playbook.ID}).
		Where(sq.Eq{"DeleteAt": 0})

	if _, err := p.store.execBuilder(q, updateBuilder); err != nil {
		return err
	}

	// Restore and update existing metric configs. Insert a new ones.
	var err error
	for i, m := range playbook.Metrics {
		if m.ID == "" {
			_, err = p.store.execBuilder(q, sq.
				Insert("IR_MetricConfig").
				Columns("ID", "PlaybookID", "Title", "Description", "Type", "Target", "Ordering").
				Values(model.NewId(), playbook.ID, m.Title, m.Description, m.Type, m.Target, i))
		} else {
			_, err = p.store.execBuilder(q, sq.
				Update("IR_MetricConfig").
				SetMap(map[string]interface{}{
					"Title":       m.Title,
					"Description": m.Description,
					"Target":      m.Target,
					"Ordering":    i,
					"DeleteAt":    0,
				}).
				Where(sq.Eq{"ID": m.ID}),
			)
		}
		if err != nil {
			return err
		}
	}

	return nil
}

func (p *playbookStore) AutoFollow(playbookID, userID string) error {
	var err error
	if p.store.db.DriverName() == model.DatabaseDriverMysql {
		_, err = p.store.execBuilder(p.store.db, sq.
			Insert("IR_PlaybookAutoFollow").
			Columns("PlaybookID", "UserID").
			Values(playbookID, userID).
			Suffix("ON DUPLICATE KEY UPDATE playbookID = playbookID"))
	} else {
		_, err = p.store.execBuilder(p.store.db, sq.
			Insert("IR_PlaybookAutoFollow").
			Columns("PlaybookID", "UserID").
			Values(playbookID, userID).
			Suffix("ON CONFLICT (PlaybookID,UserID) DO NOTHING"))
	}
	return errors.Wrapf(err, "failed to insert autofollowing '%s' for playbook '%s'", userID, playbookID)
}

func (p *playbookStore) AutoUnfollow(playbookID, userID string) error {
	if _, err := p.store.execBuilder(p.store.db, sq.
		Delete("IR_PlaybookAutoFollow").
		Where(sq.And{sq.Eq{"UserID": userID}, sq.Eq{"PlaybookID": playbookID}})); err != nil {
		return errors.Wrapf(err, "failed to delete autofollow '%s' for playbook '%s'", userID, playbookID)
	}
	return nil
}

func (p *playbookStore) GetAutoFollows(playbookID string) ([]string, error) {
	query := p.queryBuilder.
		Select("UserID").
		From("IR_PlaybookAutoFollow").
		Where(sq.Eq{"PlaybookID": playbookID})

	autoFollows := make([]string, 0)
	err := p.store.selectBuilder(p.store.db, &autoFollows, query)
	if err == sql.ErrNoRows {
		return []string{}, nil
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get autoFollows for playbook '%s'", playbookID)
	}

	return autoFollows, nil
}

func (p *playbookStore) GetMetric(id string) (*app.PlaybookMetricConfig, error) {
	metricSelect := p.queryBuilder.
		Select(
			"c.ID",
			"c.PlaybookID",
			"c.Title",
			"c.Description",
			"c.Type",
			"c.Target",
		).
		From("IR_MetricConfig c").
		Where(sq.Eq{"c.ID": id})

	var metric app.PlaybookMetricConfig
	err := p.store.getBuilder(p.store.db, &metric, metricSelect)
	if err != nil {
		return nil, err
	}

	return &metric, nil
}

func (p *playbookStore) AddMetric(playbookID string, config app.PlaybookMetricConfig) error {
	numExistingMetrics, err := p.GetNumMetrics(playbookID)
	if err != nil {
		return err
	}

	if numExistingMetrics >= app.MaxMetricsPerPlaybook {
		return errors.Errorf("playbook cannot have more than %d key metrics", app.MaxMetricsPerPlaybook)
	}

	_, err = p.store.execBuilder(p.store.db, sq.
		Insert("IR_MetricConfig").
		Columns("ID", "PlaybookID", "Title", "Description", "Type", "Target", "Ordering").
		Values(model.NewId(), playbookID, config.Title, config.Description, config.Type, config.Target, numExistingMetrics))

	if err != nil {
		return errors.Wrapf(err, "failed to add metric")
	}

	return nil
}

func (p *playbookStore) DeleteMetric(id string) error {
	if id == "" {
		return errors.New("id should not be empty")
	}

	_, err := p.store.execBuilder(p.store.db, sq.
		Update("IR_MetricConfig").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"ID": id}))

	if err != nil {
		return errors.Wrapf(err, "failed to delete metric with id %q", id)
	}

	return nil
}

func (p *playbookStore) UpdateMetric(id string, setmap map[string]interface{}) error {
	if id == "" {
		return errors.New("id should not be empty")
	}

	_, err := p.store.execBuilder(p.store.db, sq.
		Update("IR_MetricConfig").
		SetMap(setmap).
		Where(sq.Eq{"ID": id}))

	if err != nil {
		return errors.Wrapf(err, "failed to update metric with id %q", id)
	}

	return nil
}

func generatePlaybookSchemeRoles(member playbookMember, playbook *app.Playbook) []string {
	schemeRoles := []string{}
	for _, role := range strings.Fields(member.Roles) {
		if role == app.PlaybookRoleAdmin {
			if playbook.DefaultPlaybookAdminRole == "" {
				schemeRoles = append(schemeRoles, app.PlaybookRoleAdmin)
			} else {
				schemeRoles = append(schemeRoles, playbook.DefaultPlaybookAdminRole)
			}
		} else if role == app.PlaybookRoleMember {
			if playbook.DefaultPlaybookMemberRole == "" {
				schemeRoles = append(schemeRoles, app.PlaybookRoleMember)
			} else {
				schemeRoles = append(schemeRoles, playbook.DefaultPlaybookMemberRole)
			}
		}
	}

	return schemeRoles
}

func addMembersToPlaybooks(members []playbookMember, playbooks []app.Playbook) {
	playbookToMembers := make(map[string][]playbookMember)
	for _, member := range members {
		playbookToMembers[member.PlaybookID] = append(playbookToMembers[member.PlaybookID], member)
	}

	for i, playbook := range playbooks {
		addMembersToPlaybook(playbookToMembers[playbook.ID], &(playbooks[i]))
	}
}

func addMembersToPlaybook(members []playbookMember, playbook *app.Playbook) {
	for _, m := range members {
		playbook.Members = append(playbook.Members, app.PlaybookMember{
			UserID:      m.MemberID,
			Roles:       strings.Fields(m.Roles),
			SchemeRoles: generatePlaybookSchemeRoles(m, playbook),
		})
	}
}

func addMetricsToPlaybooks(metrics []app.PlaybookMetricConfig, playbooks []app.Playbook) {
	playbookToMetrics := make(map[string][]app.PlaybookMetricConfig)
	for _, metric := range metrics {
		playbookToMetrics[metric.PlaybookID] = append(playbookToMetrics[metric.PlaybookID], metric)
	}

	for i, playbook := range playbooks {
		playbooks[i].Metrics = playbookToMetrics[playbook.ID]
	}
}

func getSteps(playbook app.Playbook) int {
	steps := 0
	for _, p := range playbook.Checklists {
		steps += len(p.Items)
	}

	return steps
}

func toSQLPlaybook(playbook app.Playbook) (*sqlPlaybook, error) {
	checklistsJSON, err := json.Marshal(playbook.Checklists)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal checklist json for playbook id: '%s'", playbook.ID)
	}

	if len(checklistsJSON) > maxJSONLength {
		return nil, errors.Wrapf(errors.New("invalid data"), "checklist json for playbook id '%s' is too long (max %d)", playbook.ID, maxJSONLength)
	}

	return &sqlPlaybook{
		Playbook:                              playbook,
		ChecklistsJSON:                        checklistsJSON,
		ConcatenatedInvitedUserIDs:            strings.Join(playbook.InvitedUserIDs, ","),
		ConcatenatedInvitedGroupIDs:           strings.Join(playbook.InvitedGroupIDs, ","),
		ConcatenatedSignalAnyKeywords:         strings.Join(playbook.SignalAnyKeywords, ","),
		ConcatenatedBroadcastChannelIDs:       strings.Join(playbook.BroadcastChannelIDs, ","),
		ConcatenatedWebhookOnCreationURLs:     strings.Join(playbook.WebhookOnCreationURLs, ","),
		ConcatenatedWebhookOnStatusUpdateURLs: strings.Join(playbook.WebhookOnStatusUpdateURLs, ","),
	}, nil
}

func toPlaybook(rawPlaybook sqlPlaybook) (app.Playbook, error) {
	p := rawPlaybook.Playbook
	if len(rawPlaybook.ChecklistsJSON) > 0 {
		if err := json.Unmarshal(rawPlaybook.ChecklistsJSON, &p.Checklists); err != nil {
			return app.Playbook{}, errors.Wrapf(err, "failed to unmarshal checklists json for playbook id: '%s'", p.ID)
		}
	}

	p.InvitedUserIDs = []string(nil)
	if rawPlaybook.ConcatenatedInvitedUserIDs != "" {
		p.InvitedUserIDs = strings.Split(rawPlaybook.ConcatenatedInvitedUserIDs, ",")
	}

	p.InvitedGroupIDs = []string(nil)
	if rawPlaybook.ConcatenatedInvitedGroupIDs != "" {
		p.InvitedGroupIDs = strings.Split(rawPlaybook.ConcatenatedInvitedGroupIDs, ",")
	}

	p.SignalAnyKeywords = []string(nil)
	if rawPlaybook.ConcatenatedSignalAnyKeywords != "" {
		p.SignalAnyKeywords = strings.Split(rawPlaybook.ConcatenatedSignalAnyKeywords, ",")
	}

	p.BroadcastChannelIDs = []string(nil)
	if rawPlaybook.ConcatenatedBroadcastChannelIDs != "" {
		p.BroadcastChannelIDs = strings.Split(rawPlaybook.ConcatenatedBroadcastChannelIDs, ",")
	}

	p.WebhookOnCreationURLs = []string(nil)
	if rawPlaybook.ConcatenatedWebhookOnCreationURLs != "" {
		p.WebhookOnCreationURLs = strings.Split(rawPlaybook.ConcatenatedWebhookOnCreationURLs, ",")
	}

	p.WebhookOnStatusUpdateURLs = []string(nil)
	if rawPlaybook.ConcatenatedWebhookOnStatusUpdateURLs != "" {
		p.WebhookOnStatusUpdateURLs = strings.Split(rawPlaybook.ConcatenatedWebhookOnStatusUpdateURLs, ",")
	}
	return p, nil
}

// insights - store manager functions

func (p *playbookStore) GetTopPlaybooksForTeam(teamID, userID string, opts *model.InsightsOpts) (*app.PlaybooksInsightsList, error) {

	query := insightsQueryBuilder(p, teamID, userID, opts, insightsQueryTypeTeam)

	topPlaybooksList := make([]*app.PlaybookInsight, 0)
	err := p.store.selectBuilder(p.store.db, &topPlaybooksList, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get top team playbooks for for user: %s", userID)
	}

	topPlaybooks := GetTopPlaybooksInsightsListWithPagination(topPlaybooksList, opts.PerPage)

	return topPlaybooks, nil
}

func (p *playbookStore) GetTopPlaybooksForUser(teamID, userID string, opts *model.InsightsOpts) (*app.PlaybooksInsightsList, error) {

	query := insightsQueryBuilder(p, teamID, userID, opts, insightsQueryTypeUser)

	topPlaybooksList := make([]*app.PlaybookInsight, 0)
	err := p.store.selectBuilder(p.store.db, &topPlaybooksList, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get top user playbooks for for user: %s", userID)
	}

	topPlaybooks := GetTopPlaybooksInsightsListWithPagination(topPlaybooksList, opts.PerPage)

	return topPlaybooks, nil
}

func insightsQueryBuilder(p *playbookStore, teamID, userID string, opts *model.InsightsOpts, queryType string) sq.SelectBuilder {
	permissionsAndFilter := sq.Expr(`(
		EXISTS(SELECT 1
				FROM IR_PlaybookMember as pm
				WHERE pm.PlaybookID = p.ID
				AND pm.MemberID = ?)
	)`, userID)

	var whereCondition sq.And
	if queryType == insightsQueryTypeUser {
		whereCondition = sq.And{
			permissionsAndFilter,
			sq.Eq{"p.TeamID": teamID},
			sq.GtOrEq{"i.CreateAt": opts.StartUnixMilli},
		}
	} else if queryType == insightsQueryTypeTeam {
		whereCondition = sq.And{
			sq.GtOrEq{"i.CreateAt": opts.StartUnixMilli},
			sq.Or{
				permissionsAndFilter,
				sq.Eq{"p.Public": true},
			},
			sq.Eq{"p.TeamID": teamID},
		}
	} else {
		whereCondition = sq.And{}
	}
	offset := opts.Page * opts.PerPage
	limit := opts.PerPage
	query := p.queryBuilder.
		Select(
			"p.ID as PlaybookID",
			"p.Title",
			"COUNT(i.ID) AS NumRuns",
			"COALESCE(MAX(i.CreateAt), 0) AS LastRunAt",
		).
		From("IR_Playbook as p").
		LeftJoin("IR_Incident AS i ON p.ID = i.PlaybookID").
		Where(whereCondition).
		GroupBy("p.ID").
		OrderBy("NumRuns desc").
		Offset(uint64(offset)).
		Limit(uint64(limit + 1))

	return query
}

// GetTopPlaybooksInsightsListWithPagination returns a page given a list of PlaybooksInsight assumed to be
// sorted by Runs(score). Returns a PlaybooksInsightsList.
func GetTopPlaybooksInsightsListWithPagination(playbooks []*app.PlaybookInsight, limit int) *app.PlaybooksInsightsList {
	// Add pagination support
	var hasNext bool
	if (limit != 0) && (len(playbooks) == limit+1) {
		hasNext = true
		playbooks = playbooks[:len(playbooks)-1]
	}

	return &app.PlaybooksInsightsList{HasNext: hasNext, Items: playbooks}
}
