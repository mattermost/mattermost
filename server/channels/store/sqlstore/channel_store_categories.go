// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"fmt"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/model"
)

// dbSelecter is an interface used to enable some internal store methods
// using both transaction and normal queries.
type dbSelecter interface {
	Select(i any, query string, args ...any) error
}

func (s SqlChannelStore) CreateInitialSidebarCategories(userId string, opts *store.SidebarCategorySearchOpts) (_ *model.OrderedSidebarCategories, err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "CreateInitialSidebarCategories: begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	teamsWithExclude, err := s.SqlStore.stores.team.GetTeamsForUser(context.Background(), userId, opts.TeamID, false)
	if err != nil {
		return nil, errors.Wrap(err, "CreateInitialSidebarCategories: GetTeamsForUser")
	}
	excludedTeamIDs := make([]string, 0, len(teamsWithExclude))
	for _, tm := range teamsWithExclude {
		excludedTeamIDs = append(excludedTeamIDs, tm.TeamId)
	}

	if err = s.createInitialSidebarCategoriesT(transaction, userId, excludedTeamIDs, opts); err != nil {
		return nil, errors.Wrap(err, "CreateInitialSidebarCategories: createInitialSidebarCategoriesT")
	}

	oc, err := s.getSidebarCategoriesT(transaction, userId, opts)
	if err != nil {
		return nil, errors.Wrap(err, "CreateInitialSidebarCategories: getSidebarCategoriesT")
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "CreateInitialSidebarCategories: commit_transaction")
	}

	return oc, nil
}

func (s SqlChannelStore) createInitialSidebarCategoriesT(transaction *sqlxTxWrapper, userId string, excludedTeamIDs []string, opts *store.SidebarCategorySearchOpts) error {
	query := s.getQueryBuilder().
		Select("Type, TeamId").
		From("SidebarCategories").
		Where(sq.Eq{
			"UserId": userId,
			"Type": []model.SidebarCategoryType{
				model.SidebarCategoryFavorites,
				model.SidebarCategoryChannels,
				model.SidebarCategoryDirectMessages,
			},
		})

	if !opts.ExcludeTeam {
		query = query.Where(sq.Eq{"TeamId": opts.TeamID})
	} else {
		query = query.Where(sq.NotEq{"TeamId": opts.TeamID})
	}

	selectQuery, selectParams, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "createInitialSidebarCategoriesT_Tosql")
	}

	existingTypes := []struct {
		Type   model.SidebarCategoryType
		TeamId string
	}{}
	err = transaction.Select(&existingTypes, selectQuery, selectParams...)
	if err != nil {
		return errors.Wrap(err, "createInitialSidebarCategoriesT: failed to select existing categories")
	}

	hasCategoryOfType := make(map[model.SidebarCategoryType]map[string]bool, len(existingTypes))
	for _, existingType := range existingTypes {
		if hasCategoryOfType[existingType.Type] == nil {
			hasCategoryOfType[existingType.Type] = make(map[string]bool)
			hasCategoryOfType[existingType.Type][existingType.TeamId] = true
		}
	}

	insertBuilder := s.getQueryBuilder().Insert("SidebarCategories").
		Columns("Id, UserId, TeamId, SortOrder, Sorting, Type, DisplayName, Muted, Collapsed")

	hasInsert := false

	getRequiredTeamIDs := func(category model.SidebarCategoryType, opts *store.SidebarCategorySearchOpts) []string {
		// if category == nil - nothing
		// if not exclude - just that team
		// otherwise get all teams excluding that team
		// if != nil - then partial
		// if not exclude, and team exists in map then skip.
		// otherwise, get all teams excluding that team, subtract all items from map.
		if hasCategoryOfType[category] == nil {
			// If not exclude, do for only single team
			// if exclude, get all teams, excluding that team
			if !opts.ExcludeTeam {
				return []string{opts.TeamID}
			}
			return excludedTeamIDs
		}
		mapEntry := hasCategoryOfType[category]
		if !opts.ExcludeTeam && mapEntry[opts.TeamID] {
			// continue, nothing to do since entry already exists.
		} else {
			for i, tID := range excludedTeamIDs {
				if mapEntry[tID] {
					// remove from slice
					copy(excludedTeamIDs[i:], excludedTeamIDs[i+1:])
					excludedTeamIDs[len(excludedTeamIDs)-1] = ""
					excludedTeamIDs = excludedTeamIDs[:len(excludedTeamIDs)-1]
				}
			}
			return excludedTeamIDs
		}
		return []string{}
	}

	teamIDs := getRequiredTeamIDs(model.SidebarCategoryFavorites, opts)
	for _, teamID := range teamIDs {
		// Use deterministic IDs for default categories to prevent potentially creating multiple copies of a default category
		favoritesCategoryId := fmt.Sprintf("%s_%s_%s", model.SidebarCategoryFavorites, userId, teamID)
		// Create the SidebarChannels first since there's more opportunity for something to fail here
		if err := s.migrateFavoritesToSidebarT(transaction, userId, teamID, favoritesCategoryId); err != nil {
			return errors.Wrap(err, "createInitialSidebarCategoriesT: failed to migrate favorites to sidebar")
		}

		insertBuilder = insertBuilder.Values(favoritesCategoryId, userId, teamID, model.DefaultSidebarSortOrderFavorites, model.SidebarCategorySortDefault, model.SidebarCategoryFavorites, "Favorites" /* This will be retranslated by the client into the user's locale */, false, false)
		hasInsert = true
	}

	teamIDs = getRequiredTeamIDs(model.SidebarCategoryChannels, opts)
	for _, teamID := range teamIDs {
		channelsCategoryId := fmt.Sprintf("%s_%s_%s", model.SidebarCategoryChannels, userId, teamID)
		insertBuilder = insertBuilder.Values(channelsCategoryId, userId, teamID, model.DefaultSidebarSortOrderChannels, model.SidebarCategorySortDefault, model.SidebarCategoryChannels, "Channels" /* This will be retranslated by the client into the user's locale */, false, false)
		hasInsert = true
	}

	teamIDs = getRequiredTeamIDs(model.SidebarCategoryDirectMessages, opts)
	for _, teamID := range teamIDs {
		directMessagesCategoryId := fmt.Sprintf("%s_%s_%s", model.SidebarCategoryDirectMessages, userId, teamID)
		insertBuilder = insertBuilder.Values(directMessagesCategoryId, userId, teamID, model.DefaultSidebarSortOrderDMs, model.SidebarCategorySortRecent, model.SidebarCategoryDirectMessages, "Direct Messages" /* This will be retranslated by the client into the user's locale */, false, false)
		hasInsert = true
	}

	if hasInsert {
		sql, args, err := insertBuilder.ToSql()
		if err != nil {
			return errors.Wrap(err, "insertSidebarCategories_Tosql")
		}
		_, err = transaction.Exec(sql, args...)
		if err != nil {
			return errors.Wrap(err, "createInitialSidebarCategoriesT: failed to insert categories")
		}
	}

	return nil
}

type userMembership struct {
	UserId     string
	ChannelId  string
	CategoryId string
}

func (s SqlChannelStore) migrateMembershipToSidebar(transaction *sqlxTxWrapper, runningOrder *int64, sql string, args ...any) ([]userMembership, error) {
	memberships := []userMembership{}
	if err := transaction.Select(&memberships, sql, args...); err != nil {
		return nil, err
	}

	for _, favorite := range memberships {
		sql, args, err := s.getQueryBuilder().
			Insert("SidebarChannels").
			Columns("ChannelId", "UserId", "CategoryId", "SortOrder").
			Values(favorite.ChannelId, favorite.UserId, favorite.CategoryId, *runningOrder).ToSql()
		if err != nil {
			return nil, err
		}
		if _, err := transaction.Exec(sql, args...); err != nil && !IsUniqueConstraintError(err, []string{"UserId", "PRIMARY"}) {
			return nil, err
		}
		*runningOrder = *runningOrder + model.MinimalSidebarSortDistance
	}

	if err := transaction.Commit(); err != nil {
		return nil, err
	}
	return memberships, nil
}

func (s SqlChannelStore) migrateFavoritesToSidebarT(transaction *sqlxTxWrapper, userId, teamId, favoritesCategoryId string) error {
	favoritesQuery, favoritesParams, err := s.getQueryBuilder().
		Select("Preferences.Name").
		From("Preferences").
		Join("Channels on Preferences.Name = Channels.Id").
		Join("ChannelMembers on Preferences.Name = ChannelMembers.ChannelId and Preferences.UserId = ChannelMembers.UserId").
		Where(sq.Eq{
			"Preferences.UserId":   userId,
			"Preferences.Category": model.PreferenceCategoryFavoriteChannel,
			"Preferences.Value":    "true",
		}).
		Where(sq.Or{
			sq.Eq{"Channels.TeamId": teamId},
			sq.Eq{"Channels.TeamId": ""},
		}).
		OrderBy(
			"Channels.DisplayName",
			"Channels.Name ASC",
		).ToSql()
	if err != nil {
		return err
	}

	favoriteChannelIds := []string{}
	if err := transaction.Select(&favoriteChannelIds, favoritesQuery, favoritesParams...); err != nil {
		return errors.Wrap(err, "migrateFavoritesToSidebarT: unable to get favorite channel IDs")
	}

	for i, channelId := range favoriteChannelIds {
		if _, err := transaction.NamedExec(`INSERT INTO
			SidebarChannels(ChannelId, UserId, CategoryId, SortOrder)
			VALUES(:ChannelId, :UserId, :CategoryId, :SortOrder)`, &model.SidebarChannel{
			ChannelId:  channelId,
			CategoryId: favoritesCategoryId,
			UserId:     userId,
			SortOrder:  int64(i * model.MinimalSidebarSortDistance),
		}); err != nil {
			return errors.Wrap(err, "migrateFavoritesToSidebarT: unable to insert SidebarChannel")
		}
	}

	return nil
}

// MigrateFavoritesToSidebarChannels populates the SidebarChannels table by analyzing existing user preferences for favorites
// **IMPORTANT** This function should only be called from the migration task and shouldn't be used by itself
func (s SqlChannelStore) MigrateFavoritesToSidebarChannels(lastUserId string, runningOrder int64) (_ map[string]any, err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, err
	}

	defer finalizeTransactionX(transaction, &err)

	sb := s.
		getQueryBuilder().
		Select("Preferences.UserId", "Preferences.Name AS ChannelId", "SidebarCategories.Id AS CategoryId").
		From("Preferences").
		Where(sq.And{
			sq.Eq{"Preferences.Category": model.PreferenceCategoryFavoriteChannel},
			sq.NotEq{"Preferences.Value": "false"},
			sq.NotEq{"SidebarCategories.Id": nil},
			sq.Gt{"Preferences.UserId": lastUserId},
		}).
		LeftJoin("Channels ON (Channels.Id=Preferences.Name)").
		LeftJoin("SidebarCategories ON (SidebarCategories.UserId=Preferences.UserId AND SidebarCategories.Type='"+string(model.SidebarCategoryFavorites)+"' AND (SidebarCategories.TeamId=Channels.TeamId OR Channels.TeamId=''))").
		OrderBy("Preferences.UserId", "Channels.Name DESC").
		Limit(100)

	sql, args, err := sb.ToSql()
	if err != nil {
		return nil, err
	}

	userFavorites, err := s.migrateMembershipToSidebar(transaction, &runningOrder, sql, args...)
	if err != nil {
		return nil, err
	}
	if len(userFavorites) == 0 {
		return nil, nil
	}

	data := make(map[string]any)
	data["UserId"] = userFavorites[len(userFavorites)-1].UserId
	data["SortOrder"] = runningOrder
	return data, nil
}

type sidebarCategoryForJoin struct {
	model.SidebarCategory
	ChannelId *string
}

func (s SqlChannelStore) CreateSidebarCategory(userId, teamId string, newCategory *model.SidebarCategoryWithChannels) (_ *model.SidebarCategoryWithChannels, err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}

	defer finalizeTransactionX(transaction, &err)

	opts := &store.SidebarCategorySearchOpts{
		TeamID:      teamId,
		ExcludeTeam: false,
	}
	categoriesWithOrder, err := s.getSidebarCategoriesT(transaction, userId, opts)
	if err != nil {
		return nil, err
	} else if len(categoriesWithOrder.Categories) == 0 {
		return nil, store.NewErrNotFound("categories not found", fmt.Sprintf("userId=%s,teamId=%s", userId, teamId))
	}

	newOrder := categoriesWithOrder.Order
	newCategoryId := model.NewId()
	newCategorySortOrder := 0
	/*
		When a new category is created, it should be placed as follows:
		1. If the Favorites category is first, the new category should be placed after it
		2. Otherwise, the new category should be placed first.
	*/
	if categoriesWithOrder.Categories[0].Type == model.SidebarCategoryFavorites {
		newOrder = append([]string{newOrder[0], newCategoryId}, newOrder[1:]...)
		newCategorySortOrder = model.MinimalSidebarSortDistance
	} else {
		newOrder = append([]string{newCategoryId}, newOrder...)
	}

	category := &model.SidebarCategory{
		DisplayName: newCategory.DisplayName,
		Id:          newCategoryId,
		UserId:      userId,
		TeamId:      teamId,
		Sorting:     model.SidebarCategorySortDefault,
		SortOrder:   int64(model.MinimalSidebarSortDistance * len(newOrder)), // first we place it at the end of the list
		Type:        model.SidebarCategoryCustom,
		Muted:       newCategory.Muted,
	}
	if _, err2 := transaction.NamedExec(`INSERT INTO
			SidebarCategories(Id, UserId, TeamId, SortOrder, Sorting, Type, DisplayName, Muted, Collapsed)
			VALUES(:Id, :UserId, :TeamId, :SortOrder, :Sorting, :Type, :DisplayName, :Muted, :Collapsed)`, category); err2 != nil {
		return nil, errors.Wrap(err2, "failed to save SidebarCategory")
	}

	if len(newCategory.Channels) > 0 {
		placeHolder, channelIdArgs := constructArrayArgs(newCategory.Channels)
		// Remove any channels from their previous categories and add them to the new one
		var deleteQuery string
		if s.DriverName() == model.DatabaseDriverMysql {
			deleteQuery = `
				DELETE
					SidebarChannels
				FROM
					SidebarChannels
				JOIN
					SidebarCategories ON SidebarChannels.CategoryId = SidebarCategories.Id
				WHERE
					SidebarChannels.UserId = ?
					AND SidebarChannels.ChannelId IN ` + placeHolder + `
					AND SidebarCategories.TeamId = ?`
		} else {
			deleteQuery = `
				DELETE FROM
					SidebarChannels
				USING
					SidebarCategories
				WHERE
					SidebarChannels.CategoryId = SidebarCategories.Id
					AND SidebarChannels.UserId = ?
					AND SidebarChannels.ChannelId IN ` + placeHolder + `
					AND SidebarCategories.TeamId = ?`
		}

		args := []any{userId}
		args = append(args, channelIdArgs...)
		args = append(args, teamId)
		_, err = transaction.Exec(deleteQuery, args...)
		if err != nil {
			return nil, errors.Wrap(err, "failed to delete SidebarChannels")
		}

		insertQuery := s.getQueryBuilder().
			Insert("SidebarChannels").
			Columns("ChannelId", "UserId", "CategoryId", "SortOrder")
		for i, channelID := range newCategory.Channels {
			insertQuery = insertQuery.Values(channelID, userId, newCategoryId, int64(i*model.MinimalSidebarSortDistance))
		}
		sql, args, err := insertQuery.ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "InsertSidebarChannels_Tosql")
		}

		if _, err := transaction.Exec(sql, args...); err != nil {
			return nil, errors.Wrap(err, "failed to save SidebarChannels")
		}
	}

	// now we re-order the categories according to the new order
	if err := s.updateSidebarCategoryOrderT(transaction, newOrder); err != nil {
		return nil, err
	}

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	// patch category to return proper sort order
	category.SortOrder = int64(newCategorySortOrder)
	result := &model.SidebarCategoryWithChannels{
		SidebarCategory: *category,
		Channels:        newCategory.Channels,
	}

	return result, nil
}

func (s SqlChannelStore) completePopulatingCategoryChannels(category *model.SidebarCategoryWithChannels) (_ *model.SidebarCategoryWithChannels, err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	result, err := s.completePopulatingCategoryChannelsT(transaction, category)
	if err != nil {
		return nil, err
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return result, nil
}

func (s SqlChannelStore) completePopulatingCategoryChannelsT(db dbSelecter, category *model.SidebarCategoryWithChannels) (*model.SidebarCategoryWithChannels, error) {
	if category.Type == model.SidebarCategoryCustom || category.Type == model.SidebarCategoryFavorites {
		return category, nil
	}

	var channelTypeFilter sq.Sqlizer
	if category.Type == model.SidebarCategoryDirectMessages {
		// any DM/GM channels that aren't in any category should be returned as part of the Direct Messages category
		channelTypeFilter = sq.Eq{"Channels.Type": []model.ChannelType{model.ChannelTypeDirect, model.ChannelTypeGroup}}
	} else if category.Type == model.SidebarCategoryChannels {
		// any public/private channels that are on the current team and aren't in any category should be returned as part of the Channels category
		channelTypeFilter = sq.And{
			sq.Eq{"Channels.Type": []model.ChannelType{model.ChannelTypeOpen, model.ChannelTypePrivate}},
			sq.Eq{"Channels.TeamId": category.TeamId},
		}
	} else {
		return nil, fmt.Errorf("invalid category type: %q", category.Type)
	}

	// A subquery that is true if the channel does not have a SidebarChannel entry for the current user on the current team
	doesNotHaveSidebarChannel := sq.Select("1").
		Prefix("NOT EXISTS (").
		From("SidebarChannels").
		Join("SidebarCategories on SidebarChannels.CategoryId=SidebarCategories.Id").
		Where(sq.And{
			sq.Expr("SidebarChannels.ChannelId = ChannelMembers.ChannelId"),
			sq.Eq{"SidebarCategories.UserId": category.UserId},
			sq.Eq{"SidebarCategories.TeamId": category.TeamId},
		}).
		Suffix(")")

	channels := []string{}
	sql, args, err := s.getQueryBuilder().
		Select("Id").
		From("ChannelMembers").
		LeftJoin("Channels ON Channels.Id=ChannelMembers.ChannelId").
		Where(sq.And{
			sq.Eq{"ChannelMembers.UserId": category.UserId},
			channelTypeFilter,
			sq.Eq{"Channels.DeleteAt": 0},
			doesNotHaveSidebarChannel,
		}).
		OrderBy("DisplayName ASC").ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_tosql")
	}

	if err := db.Select(&channels, sql, args...); err != nil {
		return nil, store.NewErrNotFound("ChannelMembers", "<too many fields>").Wrap(err)
	}

	category.Channels = append(channels, category.Channels...)
	return category, nil
}

func (s SqlChannelStore) GetSidebarCategory(categoryId string) (*model.SidebarCategoryWithChannels, error) {
	sql, args, err := s.getQueryBuilder().
		Select("SidebarCategories.*", "SidebarChannels.ChannelId").
		From("SidebarCategories").
		LeftJoin("SidebarChannels ON SidebarChannels.CategoryId=SidebarCategories.Id").
		Where(sq.Eq{"SidebarCategories.Id": categoryId}).
		OrderBy("SidebarChannels.SortOrder ASC").ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "sidebar_category_tosql")
	}

	categories := []*sidebarCategoryForJoin{}
	if err = s.GetReplicaX().Select(&categories, sql, args...); err != nil {
		return nil, store.NewErrNotFound("SidebarCategories", categoryId).Wrap(err)
	}

	if len(categories) == 0 {
		return nil, store.NewErrNotFound("SidebarCategories", categoryId)
	}

	result := &model.SidebarCategoryWithChannels{
		SidebarCategory: categories[0].SidebarCategory,
		Channels:        make([]string, 0),
	}
	for _, category := range categories {
		if category.ChannelId != nil {
			result.Channels = append(result.Channels, *category.ChannelId)
		}
	}
	return s.completePopulatingCategoryChannels(result)
}

func (s SqlChannelStore) getSidebarCategoriesT(db dbSelecter, userId string, opts *store.SidebarCategorySearchOpts) (*model.OrderedSidebarCategories, error) {
	oc := model.OrderedSidebarCategories{
		Categories: make(model.SidebarCategoriesWithChannels, 0),
		Order:      make([]string, 0),
	}

	categories := []*sidebarCategoryForJoin{}
	query := s.getQueryBuilder().
		Select("SidebarCategories.*", "SidebarChannels.ChannelId").
		From("SidebarCategories").
		LeftJoin("SidebarChannels ON SidebarChannels.CategoryId=Id").
		InnerJoin("Teams ON Teams.Id=SidebarCategories.TeamId").
		InnerJoin("TeamMembers ON TeamMembers.TeamId=SidebarCategories.TeamId").
		Where(sq.And{
			sq.Eq{"TeamMembers.UserId": userId},
			sq.Eq{"TeamMembers.DeleteAt": 0},
			sq.Eq{"Teams.DeleteAt": 0},
		}).
		Where(sq.And{
			sq.Eq{"SidebarCategories.UserId": userId},
		}).
		OrderBy("SidebarCategories.SortOrder ASC, SidebarChannels.SortOrder ASC")

	if opts.ExcludeTeam {
		query = query.Where(sq.NotEq{"SidebarCategories.TeamId": opts.TeamID})
	} else {
		query = query.Where(sq.Eq{"SidebarCategories.TeamId": opts.TeamID})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "sidebar_categories_tosql")
	}

	if err := db.Select(&categories, sql, args...); err != nil {
		return nil, store.NewErrNotFound("SidebarCategories", fmt.Sprintf("userId=%s,teamId=%s", userId, opts.TeamID)).Wrap(err)
	}

	for _, category := range categories {
		var prevCategory *model.SidebarCategoryWithChannels
		for _, existing := range oc.Categories {
			if existing.Id == category.Id {
				prevCategory = existing
				break
			}
		}
		if prevCategory == nil {
			prevCategory = &model.SidebarCategoryWithChannels{
				SidebarCategory: category.SidebarCategory,
				Channels:        make([]string, 0),
			}
			oc.Categories = append(oc.Categories, prevCategory)
			oc.Order = append(oc.Order, category.Id)
		}
		if category.ChannelId != nil {
			prevCategory.Channels = append(prevCategory.Channels, *category.ChannelId)
		}
	}
	for _, category := range oc.Categories {
		if _, err := s.completePopulatingCategoryChannelsT(db, category); err != nil {
			return nil, err
		}
	}

	return &oc, nil
}

func (s SqlChannelStore) GetSidebarCategoriesForTeamForUser(userId, teamId string) (*model.OrderedSidebarCategories, error) {
	opts := &store.SidebarCategorySearchOpts{
		TeamID:      teamId,
		ExcludeTeam: false,
	}
	return s.getSidebarCategoriesT(s.GetReplicaX(), userId, opts)
}

func (s SqlChannelStore) GetSidebarCategories(userID string, opts *store.SidebarCategorySearchOpts) (*model.OrderedSidebarCategories, error) {
	return s.getSidebarCategoriesT(s.GetReplicaX(), userID, opts)
}

func (s SqlChannelStore) GetSidebarCategoryOrder(userId, teamId string) ([]string, error) {
	ids := []string{}

	sql, args, err := s.getQueryBuilder().
		Select("Id").
		From("SidebarCategories").
		Where(sq.And{
			sq.Eq{"UserId": userId},
			sq.Eq{"TeamId": teamId},
		}).
		OrderBy("SidebarCategories.SortOrder ASC").ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "sidebar_category_tosql")
	}

	if err := s.GetReplicaX().Select(&ids, sql, args...); err != nil {
		return nil, store.NewErrNotFound("SidebarCategories", fmt.Sprintf("userId=%s,teamId=%s", userId, teamId)).Wrap(err)
	}

	return ids, nil
}

func (s SqlChannelStore) updateSidebarCategoryOrderT(transaction *sqlxTxWrapper, categoryOrder []string) error {
	runningOrder := 0
	for _, categoryId := range categoryOrder {
		sql, args, err := s.getQueryBuilder().
			Update("SidebarCategories").
			Set("SortOrder", runningOrder).
			Where(sq.Eq{"Id": categoryId}).ToSql()
		if err != nil {
			return errors.Wrap(err, "updateSidebarCategoryOrderT_Tosql")
		}

		if _, err := transaction.Exec(sql, args...); err != nil {
			return errors.Wrap(err, "Error updating sidebar category order")
		}
		runningOrder += model.MinimalSidebarSortDistance
	}
	return nil
}

func (s SqlChannelStore) UpdateSidebarCategoryOrder(userId, teamId string, categoryOrder []string) (err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}

	defer finalizeTransactionX(transaction, &err)

	// Ensure no invalid categories are included and that no categories are left out
	existingOrder, err := s.GetSidebarCategoryOrder(userId, teamId)
	if err != nil {
		return err
	}

	if len(existingOrder) != len(categoryOrder) {
		return errors.New("cannot update category order, passed list of categories different size than in DB")
	}

	for _, originalCategoryId := range existingOrder {
		found := false
		for _, newCategoryId := range categoryOrder {
			if newCategoryId == originalCategoryId {
				found = true
				break
			}
		}
		if !found {
			return store.NewErrInvalidInput("SidebarCategories", "id", fmt.Sprintf("%v", categoryOrder))
		}
	}

	if err := s.updateSidebarCategoryOrderT(transaction, categoryOrder); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

//nolint:unparam
func (s SqlChannelStore) UpdateSidebarCategories(userId, teamId string, categories []*model.SidebarCategoryWithChannels) (updated []*model.SidebarCategoryWithChannels, original []*model.SidebarCategoryWithChannels, err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updatedCategories := []*model.SidebarCategoryWithChannels{}
	originalCategories := []*model.SidebarCategoryWithChannels{}
	for _, category := range categories {
		srcCategory, err2 := s.GetSidebarCategory(category.Id)
		if err2 != nil {
			return nil, nil, errors.Wrap(err2, "failed to find SidebarCategories")
		}

		// Copy category to avoid modifying an argument
		destCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: category.SidebarCategory,
		}

		// Prevent any changes to read-only fields of SidebarCategories
		destCategory.UserId = srcCategory.UserId
		destCategory.TeamId = srcCategory.TeamId
		destCategory.SortOrder = srcCategory.SortOrder
		destCategory.Type = srcCategory.Type
		destCategory.Muted = srcCategory.Muted

		if destCategory.Type != model.SidebarCategoryCustom {
			destCategory.DisplayName = srcCategory.DisplayName
		}

		if destCategory.Type != model.SidebarCategoryDirectMessages {
			destCategory.Channels = make([]string, len(category.Channels))
			copy(destCategory.Channels, category.Channels)

			destCategory.Muted = category.Muted
		}

		// The order in which the queries are executed in the transaction is important.
		// SidebarCategories need to be update first, and then SidebarChannels should be deleted.
		// The net effect remains the same, but it prevents deadlocks from other transactions
		// operating on the tables in reverse order.

		updateQuery, updateParams, err2 := s.getQueryBuilder().
			Update("SidebarCategories").
			Set("DisplayName", destCategory.DisplayName).
			Set("Sorting", destCategory.Sorting).
			Set("Muted", destCategory.Muted).
			Set("Collapsed", destCategory.Collapsed).
			Where(sq.Eq{"Id": destCategory.Id}).ToSql()
		if err2 != nil {
			return nil, nil, errors.Wrap(err2, "update_sidebar_categories_tosql1")
		}
		if _, err = transaction.Exec(updateQuery, updateParams...); err != nil {
			return nil, nil, errors.Wrap(err, "failed to update SidebarCategories")
		}

		// if we are updating DM category, it's order can't channel order cannot be changed.
		if category.Type != model.SidebarCategoryDirectMessages {
			// Remove any SidebarChannels entries that were either:
			// - previously in this category (and any ones that are still in the category will be recreated below)
			// - in another category and are being added to this category
			query, args, err2 := s.getQueryBuilder().
				Delete("SidebarChannels").
				Where(
					sq.And{
						sq.Eq{"ChannelId": srcCategory.Channels},
						sq.Eq{"CategoryId": category.Id},
					},
				).ToSql()

			if err2 != nil {
				return nil, nil, errors.Wrap(err2, "update_sidebar_categories_tosql2")
			}

			if _, err = transaction.Exec(query, args...); err != nil {
				return nil, nil, errors.Wrap(err, "failed to delete SidebarChannels")
			}

			runningOrder := 0
			insertQuery := s.getQueryBuilder().
				Insert("SidebarChannels").
				Columns("ChannelId", "UserId", "CategoryId", "SortOrder")
			for _, channelID := range category.Channels {
				insertQuery = insertQuery.Values(channelID, userId, category.Id, int64(runningOrder))
				runningOrder += model.MinimalSidebarSortDistance
			}

			if len(category.Channels) > 0 {
				sql, args, err2 := insertQuery.ToSql()
				if err2 != nil {
					return nil, nil, errors.Wrap(err2, "InsertSidebarChannels_Tosql")
				}

				if _, err2 := transaction.Exec(sql, args...); err2 != nil {
					return nil, nil, errors.Wrap(err2, "failed to save SidebarChannels")
				}
			}
		}

		// Update the favorites preferences based on channels moving into or out of the Favorites category for compatibility
		if category.Type == model.SidebarCategoryFavorites {
			// Remove any old favorites
			sql, args, err2 := s.getQueryBuilder().Delete("Preferences").Where(
				sq.Eq{
					"UserId":   userId,
					"Name":     srcCategory.Channels,
					"Category": model.PreferenceCategoryFavoriteChannel,
				},
			).ToSql()
			if err2 != nil {
				return nil, nil, errors.Wrap(err2, "UpdateSidebarChannels_Tosql_DeletePreferences")
			}

			if _, err = transaction.Exec(sql, args...); err != nil {
				return nil, nil, errors.Wrap(err, "failed to delete Preferences")
			}

			// And then add the new ones
			for _, channelID := range category.Channels {
				// This breaks the PreferenceStore abstraction, but it should be safe to assume that everything is a SQL
				// store in this package.
				if err = s.Preference().(*SqlPreferenceStore).save(transaction, &model.Preference{
					Name:     channelID,
					UserId:   userId,
					Category: model.PreferenceCategoryFavoriteChannel,
					Value:    "true",
				}); err != nil {
					return nil, nil, errors.Wrap(err, "failed to save Preference")
				}
			}
		} else {
			// Remove any old favorites that might have been in this category
			query, args, nErr := s.getQueryBuilder().Delete("Preferences").Where(
				sq.Eq{
					"UserId":   userId,
					"Name":     category.Channels,
					"Category": model.PreferenceCategoryFavoriteChannel,
				},
			).ToSql()
			if nErr != nil {
				return nil, nil, errors.Wrap(nErr, "update_sidebar_categories_tosql")
			}

			if _, nErr = transaction.Exec(query, args...); nErr != nil {
				return nil, nil, errors.Wrap(nErr, "failed to delete Preferences")
			}
		}

		updatedCategories = append(updatedCategories, destCategory)
		originalCategories = append(originalCategories, srcCategory)
	}

	// Ensure Channels are populated for Channels/Direct Messages category if they change
	for i, updatedCategory := range updatedCategories {
		populated, nErr := s.completePopulatingCategoryChannelsT(transaction, updatedCategory)
		if nErr != nil {
			return nil, nil, nErr
		}

		updatedCategories[i] = populated
	}

	if err = transaction.Commit(); err != nil {
		return nil, nil, errors.Wrap(err, "commit_transaction")
	}

	return updatedCategories, originalCategories, nil
}

// UpdateSidebarChannelsByPreferences is called when the Preference table is being updated to keep SidebarCategories in sync
// At the moment, it's only handling Favorites and NOT DMs/GMs (those will be handled client side)
func (s SqlChannelStore) UpdateSidebarChannelsByPreferences(preferences model.Preferences) (err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "UpdateSidebarChannelsByPreferences: begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	for _, preference := range preferences {
		preference := preference

		if preference.Category != model.PreferenceCategoryFavoriteChannel {
			continue
		}

		// if new preference is false - remove the channel from the appropriate sidebar category
		if preference.Value == "false" {
			if err := s.removeSidebarEntriesForPreferenceT(transaction, &preference); err != nil {
				return errors.Wrap(err, "UpdateSidebarChannelsByPreferences: removeSidebarEntriesForPreferenceT")
			}
		} else {
			if err := s.addChannelToFavoritesCategoryT(transaction, &preference); err != nil {
				return errors.Wrap(err, "UpdateSidebarChannelsByPreferences: addChannelToFavoritesCategoryT")
			}
		}
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrap(err, "UpdateSidebarChannelsByPreferences: commit_transaction")
	}

	return nil
}

func (s SqlChannelStore) removeSidebarEntriesForPreferenceT(transaction *sqlxTxWrapper, preference *model.Preference) error {
	if preference.Category != model.PreferenceCategoryFavoriteChannel {
		return nil
	}

	// Delete any corresponding SidebarChannels entries in a Favorites category corresponding to this preference.
	var query string
	if s.DriverName() == model.DatabaseDriverMysql {
		query = `
			DELETE
				SidebarChannels
			FROM
				SidebarChannels
			JOIN
				SidebarCategories ON SidebarChannels.CategoryId = SidebarCategories.Id
			WHERE
				SidebarChannels.UserId = ?
				AND SidebarChannels.ChannelId = ?
				AND SidebarCategories.Type = ?`
	} else {
		query = `
			DELETE FROM
				SidebarChannels
			USING
				SidebarCategories
			WHERE
				SidebarChannels.CategoryId = SidebarCategories.Id
				AND SidebarChannels.UserId = ?
				AND SidebarChannels.ChannelId = ?
				AND SidebarCategories.Type = ?`
	}

	if _, err := transaction.Exec(query, preference.UserId, preference.Name, model.SidebarCategoryFavorites); err != nil {
		return errors.Wrap(err, "Failed to remove sidebar entries for preference")
	}

	return nil
}

func (s SqlChannelStore) addChannelToFavoritesCategoryT(transaction *sqlxTxWrapper, preference *model.Preference) error {
	if preference.Category != model.PreferenceCategoryFavoriteChannel {
		return nil
	}

	var channel model.Channel
	if err := transaction.Get(&channel, `SELECT * FROM Channels WHERE Id=?`, preference.Name); err != nil {
		return errors.Wrapf(err, "Failed to get favorited channel with id=%s", preference.Name)
	} else if channel.Id == "" {
		return store.NewErrNotFound("Channel", preference.Name)
	}

	// Get the IDs of the Favorites category/categories that the channel needs to be added to
	builder := s.getQueryBuilder().
		Select("SidebarCategories.Id").
		From("SidebarCategories").
		LeftJoin("SidebarChannels on SidebarCategories.Id = SidebarChannels.CategoryId and SidebarChannels.ChannelId = ?", preference.Name).
		Where(sq.Eq{
			"SidebarCategories.UserId": preference.UserId,
			"Type":                     model.SidebarCategoryFavorites,
		}).
		Where("SidebarChannels.ChannelId is null")

	if channel.TeamId != "" {
		builder = builder.Where(sq.Eq{"TeamId": channel.TeamId})
	}

	idsQuery, idsParams, err := builder.ToSql()
	if err != nil {
		return errors.Wrap(err, "addChannelToFavoritesCategoryT_ToSql_Select")
	}

	categoryIds := []string{}
	if err = transaction.Select(&categoryIds, idsQuery, idsParams...); err != nil {
		return errors.Wrap(err, "Failed to get Favorites sidebar categories")
	}

	if len(categoryIds) == 0 {
		// The channel is already in the Favorites category/categories
		return nil
	}

	// For each category ID, insert a row into SidebarChannels with the given channel ID and a SortOrder that's less than
	// all existing SortOrders in the category so that the newly favorited channel comes first
	insertQuery, insertParams, err := s.getQueryBuilder().
		Insert("SidebarChannels").
		Columns(
			"ChannelId",
			"CategoryId",
			"UserId",
			"SortOrder",
		).
		Select(
			sq.Select().
				Column("? as ChannelId", preference.Name).
				Column("SidebarCategories.Id as CategoryId").
				Column("? as UserId", preference.UserId).
				Column("COALESCE(MIN(SidebarChannels.SortOrder) - 10, 0) as SortOrder").
				From("SidebarCategories").
				LeftJoin("SidebarChannels on SidebarCategories.Id = SidebarChannels.CategoryId").
				Where(sq.Eq{
					"SidebarCategories.Id": categoryIds,
				}).
				GroupBy("SidebarCategories.Id")).ToSql()
	if err != nil {
		return errors.Wrap(err, "addChannelToFavoritesCategoryT_ToSql_Insert")
	}
	if _, err := transaction.Exec(insertQuery, insertParams...); err != nil {
		return errors.Wrap(err, "Failed to add sidebar entries for favorited channel")
	}

	return nil
}

// DeleteSidebarChannelsByPreferences is called when the Preference table is being updated to keep SidebarCategories in sync
// At the moment, it's only handling Favorites and NOT DMs/GMs (those will be handled client side)
func (s SqlChannelStore) DeleteSidebarChannelsByPreferences(preferences model.Preferences) (err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "DeleteSidebarChannelsByPreferences: begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	for _, preference := range preferences {
		preference := preference

		if preference.Category != model.PreferenceCategoryFavoriteChannel {
			continue
		}

		if err := s.removeSidebarEntriesForPreferenceT(transaction, &preference); err != nil {
			return errors.Wrap(err, "DeleteSidebarChannelsByPreferences: removeSidebarEntriesForPreferenceT")
		}
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrap(err, "DeleteSidebarChannelsByPreferences: commit_transaction")
	}

	return nil
}

//nolint:unparam
func (s SqlChannelStore) UpdateSidebarChannelCategoryOnMove(channel *model.Channel, newTeamId string) error {
	// if channel is being moved, remove it from the categories, since it's possible that there's no matching category in the new team
	if _, err := s.GetMasterX().Exec("DELETE FROM SidebarChannels WHERE ChannelId=?", channel.Id); err != nil {
		return errors.Wrapf(err, "failed to delete SidebarChannels with channelId=%s", channel.Id)
	}
	return nil
}

func (s SqlChannelStore) ClearSidebarOnTeamLeave(userId, teamId string) error {
	// if user leaves the team, clean their team related entries in sidebar channels and categories
	var deleteQuery string
	if s.DriverName() == model.DatabaseDriverMysql {
		deleteQuery = "DELETE SidebarChannels FROM SidebarChannels LEFT JOIN SidebarCategories ON SidebarCategories.Id = SidebarChannels.CategoryId WHERE SidebarCategories.TeamId=? AND SidebarCategories.UserId=?"
	} else {
		deleteQuery = `
			DELETE FROM
				SidebarChannels
			WHERE
				CategoryId IN (
					SELECT
						CategoryId
					FROM
						SidebarChannels,
						SidebarCategories
					WHERE
						SidebarChannels.CategoryId = SidebarCategories.Id
						AND SidebarCategories.TeamId = ?
						AND SidebarChannels.UserId = ?)`
	}
	if _, err := s.GetMasterX().Exec(deleteQuery, teamId, userId); err != nil {
		return errors.Wrap(err, "failed to delete from SidebarChannels")
	}
	if _, err := s.GetMasterX().Exec("DELETE FROM SidebarCategories WHERE SidebarCategories.TeamId = ? AND SidebarCategories.UserId = ?", teamId, userId); err != nil {
		return errors.Wrap(err, "failed to delete from SidebarCategories")
	}
	return nil
}

// DeleteSidebarCategory removes a custom category and moves any channels into it into the Channels and Direct Messages
// categories respectively. Assumes that the provided user ID and team ID match the given category ID.
func (s SqlChannelStore) DeleteSidebarCategory(categoryId string) (err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	// Ensure that we're deleting a custom category
	var category model.SidebarCategory
	if err = transaction.Get(&category, "SELECT * FROM SidebarCategories WHERE Id = ?", categoryId); err != nil {
		return errors.Wrapf(err, "failed to find SidebarCategories with id=%s", categoryId)
	}

	if category.Type != model.SidebarCategoryCustom {
		return store.NewErrInvalidInput("SidebarCategory", "id", categoryId)
	}

	// The order in which the queries are executed in the transaction is important.
	// SidebarCategories need to be deleted first, and then SidebarChannels.
	// The net effect remains the same, but it prevents deadlocks from other transactions
	// operating on the tables in reverse order.

	// Delete the category itself
	query, args, err := s.getQueryBuilder().
		Delete("SidebarCategories").
		Where(sq.Eq{"Id": categoryId}).ToSql()
	if err != nil {
		return errors.Wrap(err, "delete_sidebar_category_tosql")
	}
	if _, err = transaction.Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to delete SidebarCategory")
	}

	// Delete the channels in the category
	query, args, err = s.getQueryBuilder().
		Delete("SidebarChannels").
		Where(sq.Eq{"CategoryId": categoryId}).ToSql()
	if err != nil {
		return errors.Wrap(err, "delete_sidebar_category_tosql")
	}
	if _, err = transaction.Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to delete SidebarChannel")
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}
