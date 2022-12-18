// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bleveengine

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search/query"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

const DeletePostsBatchSize = 500
const DeleteFilesBatchSize = 500

// Find the end of the term and include the wildcard if it exists
// because we will put a wildcard at the end of the term regardless of whether a wildcard exists or not
var wildcardRegExpForFileSearch = regexp.MustCompile(`\*?$`)

// In excludedTerms case, we don't put a wildcard after the term.
var exactPhraseRegExpForFileSearch = regexp.MustCompile(`"[^"]+"`)

func (b *BleveEngine) IndexPost(post *model.Post, teamId string) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	blvPost := BLVPostFromPost(post, teamId)
	if err := b.PostIndex.Index(blvPost.Id, blvPost); err != nil {
		return model.NewAppError("Bleveengine.IndexPost", "bleveengine.index_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) SearchPosts(channels model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError) {
	channelQueries := []query.Query{}
	for _, channel := range channels {
		channelIdQ := bleve.NewTermQuery(channel.Id)
		channelIdQ.SetField("ChannelId")
		channelQueries = append(channelQueries, channelIdQ)
	}
	channelDisjunctionQ := bleve.NewDisjunctionQuery(channelQueries...)

	var termQueries []query.Query
	var notTermQueries []query.Query
	var filters []query.Query
	var notFilters []query.Query

	typeQ := bleve.NewTermQuery("")
	typeQ.SetField("Type")
	filters = append(filters, typeQ)

	for i, params := range searchParams {
		var termOperator query.MatchQueryOperator = query.MatchQueryOperatorAnd
		if searchParams[0].OrTerms {
			termOperator = query.MatchQueryOperatorOr
		}

		// Date, channels and FromUsers filters come in all
		// searchParams iteration, and as they are global to the
		// query, we only need to process them once
		if i == 0 {
			if len(params.InChannels) > 0 {
				inChannels := []query.Query{}
				for _, channelId := range params.InChannels {
					channelQ := bleve.NewTermQuery(channelId)
					channelQ.SetField("ChannelId")
					inChannels = append(inChannels, channelQ)
				}
				filters = append(filters, bleve.NewDisjunctionQuery(inChannels...))
			}

			if len(params.ExcludedChannels) > 0 {
				excludedChannels := []query.Query{}
				for _, channelId := range params.ExcludedChannels {
					channelQ := bleve.NewTermQuery(channelId)
					channelQ.SetField("ChannelId")
					excludedChannels = append(excludedChannels, channelQ)
				}
				notFilters = append(notFilters, bleve.NewDisjunctionQuery(excludedChannels...))
			}

			if len(params.FromUsers) > 0 {
				fromUsers := []query.Query{}
				for _, userId := range params.FromUsers {
					userQ := bleve.NewTermQuery(userId)
					userQ.SetField("UserId")
					fromUsers = append(fromUsers, userQ)
				}
				filters = append(filters, bleve.NewDisjunctionQuery(fromUsers...))
			}

			if len(params.ExcludedUsers) > 0 {
				excludedUsers := []query.Query{}
				for _, userId := range params.ExcludedUsers {
					userQ := bleve.NewTermQuery(userId)
					userQ.SetField("UserId")
					excludedUsers = append(excludedUsers, userQ)
				}
				notFilters = append(notFilters, bleve.NewDisjunctionQuery(excludedUsers...))
			}

			if params.OnDate != "" {
				before, after := params.GetOnDateMillis()
				beforeFloat64 := float64(before)
				afterFloat64 := float64(after)
				onDateQ := bleve.NewNumericRangeQuery(&beforeFloat64, &afterFloat64)
				onDateQ.SetField("CreateAt")
				filters = append(filters, onDateQ)
			} else {
				if params.AfterDate != "" || params.BeforeDate != "" {
					var min, max *float64
					if params.AfterDate != "" {
						minf := float64(params.GetAfterDateMillis())
						min = &minf
					}

					if params.BeforeDate != "" {
						maxf := float64(params.GetBeforeDateMillis())
						max = &maxf
					}

					dateQ := bleve.NewNumericRangeQuery(min, max)
					dateQ.SetField("CreateAt")
					filters = append(filters, dateQ)
				}

				if params.ExcludedAfterDate != "" {
					minf := float64(params.GetExcludedAfterDateMillis())
					dateQ := bleve.NewNumericRangeQuery(&minf, nil)
					dateQ.SetField("CreateAt")
					notFilters = append(notFilters, dateQ)
				}

				if params.ExcludedBeforeDate != "" {
					maxf := float64(params.GetExcludedBeforeDateMillis())
					dateQ := bleve.NewNumericRangeQuery(nil, &maxf)
					dateQ.SetField("CreateAt")
					notFilters = append(notFilters, dateQ)
				}

				if params.ExcludedDate != "" {
					before, after := params.GetExcludedDateMillis()
					beforef := float64(before)
					afterf := float64(after)
					onDateQ := bleve.NewNumericRangeQuery(&beforef, &afterf)
					onDateQ.SetField("CreateAt")
					notFilters = append(notFilters, onDateQ)
				}
			}
		}

		if params.IsHashtag {
			if params.Terms != "" {
				hashtagQ := bleve.NewMatchQuery(params.Terms)
				hashtagQ.SetField("Hashtags")
				hashtagQ.SetOperator(termOperator)
				termQueries = append(termQueries, hashtagQ)
			} else if params.ExcludedTerms != "" {
				hashtagQ := bleve.NewMatchQuery(params.ExcludedTerms)
				hashtagQ.SetField("Hashtags")
				hashtagQ.SetOperator(termOperator)
				notTermQueries = append(notTermQueries, hashtagQ)
			}
		} else {
			if params.Terms != "" {
				terms := []string{}
				for _, term := range strings.Split(params.Terms, " ") {
					if strings.HasSuffix(term, "*") {
						messageQ := bleve.NewWildcardQuery(term)
						messageQ.SetField("Message")
						termQueries = append(termQueries, messageQ)
					} else {
						terms = append(terms, term)
					}
				}

				if len(terms) > 0 {
					messageQ := bleve.NewMatchQuery(strings.Join(terms, " "))
					messageQ.SetField("Message")
					messageQ.SetOperator(termOperator)
					termQueries = append(termQueries, messageQ)
				}
			}

			if params.ExcludedTerms != "" {
				messageQ := bleve.NewMatchQuery(params.ExcludedTerms)
				messageQ.SetField("Message")
				messageQ.SetOperator(termOperator)
				notTermQueries = append(notTermQueries, messageQ)
			}
		}
	}

	allTermsQ := bleve.NewBooleanQuery()
	allTermsQ.AddMustNot(notTermQueries...)
	if searchParams[0].OrTerms {
		allTermsQ.AddShould(termQueries...)
	} else {
		allTermsQ.AddMust(termQueries...)
	}

	query := bleve.NewBooleanQuery()
	query.AddMust(channelDisjunctionQ)

	if len(termQueries) > 0 || len(notTermQueries) > 0 {
		query.AddMust(allTermsQ)
	}

	if len(filters) > 0 {
		query.AddMust(bleve.NewConjunctionQuery(filters...))
	}
	if len(notFilters) > 0 {
		query.AddMustNot(notFilters...)
	}

	search := bleve.NewSearchRequestOptions(query, perPage, page*perPage, false)
	search.SortBy([]string{"-CreateAt"})
	results, err := b.PostIndex.Search(search)
	if err != nil {
		return nil, nil, model.NewAppError("Bleveengine.SearchPosts", "bleveengine.search_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	postIds := []string{}
	matches := model.PostSearchMatches{}

	for _, r := range results.Hits {
		postIds = append(postIds, r.ID)
	}

	return postIds, matches, nil
}

func (b *BleveEngine) deletePosts(searchRequest *bleve.SearchRequest, batchSize int) (int64, error) {
	resultsCount := int64(0)

	for {
		// As we are deleting the posts after fetching them, we need to keep
		// From fixed always to 0
		searchRequest.From = 0
		searchRequest.Size = batchSize
		results, err := b.PostIndex.Search(searchRequest)
		if err != nil {
			return -1, err
		}
		batch := b.PostIndex.NewBatch()
		for _, post := range results.Hits {
			batch.Delete(post.ID)
		}
		if err := b.PostIndex.Batch(batch); err != nil {
			return -1, err
		}
		resultsCount += int64(results.Hits.Len())
		if results.Hits.Len() < batchSize {
			break
		}
	}

	return resultsCount, nil
}

func (b *BleveEngine) DeleteChannelPosts(channelID string) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	query := bleve.NewTermQuery(channelID)
	query.SetField("ChannelId")
	search := bleve.NewSearchRequest(query)
	deleted, err := b.deletePosts(search, DeletePostsBatchSize)
	if err != nil {
		return model.NewAppError("Bleveengine.DeleteChannelPosts",
			"bleveengine.delete_channel_posts.error", nil,
			err.Error(), http.StatusInternalServerError)
	}

	mlog.Info("Posts for channel deleted", mlog.String("channel_id", channelID), mlog.Int64("deleted", deleted))

	return nil
}

func (b *BleveEngine) DeleteUserPosts(userID string) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	query := bleve.NewTermQuery(userID)
	query.SetField("UserId")
	search := bleve.NewSearchRequest(query)
	deleted, err := b.deletePosts(search, DeletePostsBatchSize)
	if err != nil {
		return model.NewAppError("Bleveengine.DeleteUserPosts",
			"bleveengine.delete_user_posts.error", nil,
			err.Error(), http.StatusInternalServerError)
	}

	mlog.Info("Posts for user deleted", mlog.String("user_id", userID), mlog.Int64("deleted", deleted))

	return nil
}

func (b *BleveEngine) DeletePost(post *model.Post) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	if err := b.PostIndex.Delete(post.Id); err != nil {
		return model.NewAppError("Bleveengine.DeletePost", "bleveengine.delete_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) IndexChannel(channel *model.Channel, userIDs, teamMemberIDs []string) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	blvChannel := BLVChannelFromChannel(channel, userIDs, teamMemberIDs)
	if err := b.ChannelIndex.Index(blvChannel.Id, blvChannel); err != nil {
		return model.NewAppError("Bleveengine.IndexChannel", "bleveengine.index_channel.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) SearchChannels(teamId, userID, term string, isGuest bool) ([]string, *model.AppError) {
	// This query essentially boils down to (if teamID is passed):
	// match teamID == <>
	// AND
	// match term == <>
	// AND
	// match (channelType != 'P' || (<> in userIDs && channelType == 'P'))

	// (or if teamID is not passed)
	// <> in teamMemberIds
	// AND
	// match term == <>
	// AND
	// match (channelType != 'P' || (<> in userIDs && channelType == 'P'))

	// (or if isGuest is true)
	// <> in teamMemberIds
	// AND
	// match term == <>
	// AND
	// match (<> in userIDs)

	queries := []query.Query{}
	if teamId != "" {
		teamIdQ := bleve.NewTermQuery(teamId)
		teamIdQ.SetField("TeamId")
		queries = append(queries, teamIdQ)
	} else {
		teamMemberQ := bleve.NewTermQuery(userID)
		teamMemberQ.SetField("TeamMemberIDs")
		queries = append(queries, teamMemberQ)
	}

	if isGuest {
		userQ := bleve.NewBooleanQuery()
		userIDQ := bleve.NewTermQuery(userID)
		userIDQ.SetField("UserIDs")
		userQ.AddMust(userIDQ)
		queries = append(queries, userIDQ)
	} else {
		boolNotPrivate := bleve.NewBooleanQuery()
		privateQ := bleve.NewTermQuery(string(model.ChannelTypePrivate))
		privateQ.SetField("Type")
		boolNotPrivate.AddMustNot(privateQ)

		userQ := bleve.NewBooleanQuery()
		userIDQ := bleve.NewTermQuery(userID)
		userIDQ.SetField("UserIDs")
		userQ.AddMust(userIDQ)
		userQ.AddMust(privateQ)

		channelTypeQ := bleve.NewDisjunctionQuery()
		channelTypeQ.AddQuery(boolNotPrivate)
		channelTypeQ.AddQuery(userQ) // userID && 'p'
		queries = append(queries, channelTypeQ)
	}

	if term != "" {
		nameSuggestQ := bleve.NewPrefixQuery(strings.ToLower(term))
		nameSuggestQ.SetField("NameSuggest")
		queries = append(queries, nameSuggestQ)
	}

	query := bleve.NewSearchRequest(bleve.NewConjunctionQuery(queries...))
	query.Size = model.ChannelSearchDefaultLimit
	results, err := b.ChannelIndex.Search(query)
	if err != nil {
		return nil, model.NewAppError("Bleveengine.SearchChannels", "bleveengine.search_channels.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	channelIds := []string{}
	for _, result := range results.Hits {
		channelIds = append(channelIds, result.ID)
	}

	return channelIds, nil
}

func (b *BleveEngine) DeleteChannel(channel *model.Channel) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	if err := b.ChannelIndex.Delete(channel.Id); err != nil {
		return model.NewAppError("Bleveengine.DeleteChannel", "bleveengine.delete_channel.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) IndexUser(user *model.User, teamsIds, channelsIds []string) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	blvUser := BLVUserFromUserAndTeams(user, teamsIds, channelsIds)
	if err := b.UserIndex.Index(blvUser.Id, blvUser); err != nil {
		return model.NewAppError("Bleveengine.IndexUser", "bleveengine.index_user.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError) {
	if restrictedToChannels != nil && len(restrictedToChannels) == 0 {
		return []string{}, []string{}, nil
	}

	// users in channel
	var queries []query.Query
	if term != "" {
		termQ := bleve.NewPrefixQuery(strings.ToLower(term))
		if options.AllowFullNames {
			termQ.SetField("SuggestionsWithFullname")
		} else {
			termQ.SetField("SuggestionsWithoutFullname")
		}
		queries = append(queries, termQ)
	}

	channelIdQ := bleve.NewTermQuery(channelId)
	channelIdQ.SetField("ChannelsIds")
	queries = append(queries, channelIdQ)

	query := bleve.NewConjunctionQuery(queries...)

	uchanSearch := bleve.NewSearchRequest(query)
	uchanSearch.Size = options.Limit
	uchan, err := b.UserIndex.Search(uchanSearch)
	if err != nil {
		return nil, nil, model.NewAppError("Bleveengine.SearchUsersInChannel", "bleveengine.search_users_in_channel.uchan.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// users not in channel
	boolQ := bleve.NewBooleanQuery()

	if term != "" {
		termQ := bleve.NewPrefixQuery(strings.ToLower(term))
		if options.AllowFullNames {
			termQ.SetField("SuggestionsWithFullname")
		} else {
			termQ.SetField("SuggestionsWithoutFullname")
		}
		boolQ.AddMust(termQ)
	}

	teamIdQ := bleve.NewTermQuery(teamId)
	teamIdQ.SetField("TeamsIds")
	boolQ.AddMust(teamIdQ)

	outsideChannelIdQ := bleve.NewTermQuery(channelId)
	outsideChannelIdQ.SetField("ChannelsIds")
	boolQ.AddMustNot(outsideChannelIdQ)

	if len(restrictedToChannels) > 0 {
		restrictedChannelsQ := bleve.NewDisjunctionQuery()
		for _, channelId := range restrictedToChannels {
			restrictedChannelQ := bleve.NewTermQuery(channelId)
			restrictedChannelsQ.AddQuery(restrictedChannelQ)
		}
		boolQ.AddMust(restrictedChannelsQ)
	}

	nuchanSearch := bleve.NewSearchRequest(boolQ)
	nuchanSearch.Size = options.Limit
	nuchan, err := b.UserIndex.Search(nuchanSearch)
	if err != nil {
		return nil, nil, model.NewAppError("Bleveengine.SearchUsersInChannel", "bleveengine.search_users_in_channel.nuchan.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	uchanIds := []string{}
	for _, result := range uchan.Hits {
		uchanIds = append(uchanIds, result.ID)
	}

	nuchanIds := []string{}
	for _, result := range nuchan.Hits {
		nuchanIds = append(nuchanIds, result.ID)
	}

	return uchanIds, nuchanIds, nil
}

func (b *BleveEngine) SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError) {
	if restrictedToChannels != nil && len(restrictedToChannels) == 0 {
		return []string{}, nil
	}

	var rootQ query.Query
	if term == "" && teamId == "" && restrictedToChannels == nil {
		rootQ = bleve.NewMatchAllQuery()
	} else {
		boolQ := bleve.NewBooleanQuery()

		if term != "" {
			termQ := bleve.NewPrefixQuery(strings.ToLower(term))
			if options.AllowFullNames {
				termQ.SetField("SuggestionsWithFullname")
			} else {
				termQ.SetField("SuggestionsWithoutFullname")
			}
			boolQ.AddMust(termQ)
		}

		if len(restrictedToChannels) > 0 {
			// restricted channels are already filtered by team, so we
			// can search only those matches
			restrictedChannelsQ := []query.Query{}
			for _, channelId := range restrictedToChannels {
				channelIdQ := bleve.NewTermQuery(channelId)
				channelIdQ.SetField("ChannelsIds")
				restrictedChannelsQ = append(restrictedChannelsQ, channelIdQ)
			}
			boolQ.AddMust(bleve.NewDisjunctionQuery(restrictedChannelsQ...))
		} else {
			// this means that we only need to restrict by team
			if teamId != "" {
				teamIdQ := bleve.NewTermQuery(teamId)
				teamIdQ.SetField("TeamsIds")
				boolQ.AddMust(teamIdQ)
			}
		}

		rootQ = boolQ
	}

	search := bleve.NewSearchRequest(rootQ)
	search.Size = options.Limit
	results, err := b.UserIndex.Search(search)
	if err != nil {
		return nil, model.NewAppError("Bleveengine.SearchUsersInTeam", "bleveengine.search_users_in_team.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	usersIds := []string{}
	for _, r := range results.Hits {
		usersIds = append(usersIds, r.ID)
	}

	return usersIds, nil
}

func (b *BleveEngine) DeleteUser(user *model.User) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	if err := b.UserIndex.Delete(user.Id); err != nil {
		return model.NewAppError("Bleveengine.DeleteUser", "bleveengine.delete_user.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) IndexFile(file *model.FileInfo, channelId string) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	blvFile := BLVFileFromFileInfo(file, channelId)
	if err := b.FileIndex.Index(blvFile.Id, blvFile); err != nil {
		return model.NewAppError("Bleveengine.IndexFile", "bleveengine.index_file.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) SearchFiles(channels model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, *model.AppError) {
	channelQueries := []query.Query{}
	for _, channel := range channels {
		channelIdQ := bleve.NewTermQuery(channel.Id)
		channelIdQ.SetField("ChannelId")
		channelQueries = append(channelQueries, channelIdQ)
	}
	channelDisjunctionQ := bleve.NewDisjunctionQuery(channelQueries...)

	var termQueries []query.Query
	var notTermQueries []query.Query
	var filters []query.Query
	var notFilters []query.Query

	for i, params := range searchParams {
		var termOperator query.MatchQueryOperator = query.MatchQueryOperatorAnd
		if searchParams[0].OrTerms {
			termOperator = query.MatchQueryOperatorOr
		}

		// Date, channels and FromUsers filters come in all
		// searchParams iteration, and as they are global to the
		// query, we only need to process them once
		if i == 0 {
			if len(params.InChannels) > 0 {
				inChannels := []query.Query{}
				for _, channelId := range params.InChannels {
					channelQ := bleve.NewTermQuery(channelId)
					channelQ.SetField("ChannelId")
					inChannels = append(inChannels, channelQ)
				}
				filters = append(filters, bleve.NewDisjunctionQuery(inChannels...))
			}

			if len(params.ExcludedChannels) > 0 {
				excludedChannels := []query.Query{}
				for _, channelId := range params.ExcludedChannels {
					channelQ := bleve.NewTermQuery(channelId)
					channelQ.SetField("ChannelId")
					excludedChannels = append(excludedChannels, channelQ)
				}
				notFilters = append(notFilters, bleve.NewDisjunctionQuery(excludedChannels...))
			}

			if len(params.FromUsers) > 0 {
				fromUsers := []query.Query{}
				for _, userId := range params.FromUsers {
					userQ := bleve.NewTermQuery(userId)
					userQ.SetField("CreatorId")
					fromUsers = append(fromUsers, userQ)
				}
				filters = append(filters, bleve.NewDisjunctionQuery(fromUsers...))
			}

			if len(params.ExcludedUsers) > 0 {
				excludedUsers := []query.Query{}
				for _, userId := range params.ExcludedUsers {
					userQ := bleve.NewTermQuery(userId)
					userQ.SetField("CreatorId")
					excludedUsers = append(excludedUsers, userQ)
				}
				notFilters = append(notFilters, bleve.NewDisjunctionQuery(excludedUsers...))
			}

			if len(params.Extensions) > 0 {
				extensions := []query.Query{}
				for _, extension := range params.Extensions {
					extensionQ := bleve.NewTermQuery(extension)
					extensionQ.SetField("Extension")
					extensions = append(extensions, extensionQ)
				}
				filters = append(filters, bleve.NewDisjunctionQuery(extensions...))
			}

			if len(params.ExcludedExtensions) > 0 {
				excludedExtensions := []query.Query{}
				for _, extension := range params.ExcludedExtensions {
					extensionQ := bleve.NewTermQuery(extension)
					extensionQ.SetField("Extension")
					excludedExtensions = append(excludedExtensions, extensionQ)
				}
				notFilters = append(notFilters, bleve.NewDisjunctionQuery(excludedExtensions...))
			}

			if params.OnDate != "" {
				before, after := params.GetOnDateMillis()
				beforeFloat64 := float64(before)
				afterFloat64 := float64(after)
				onDateQ := bleve.NewNumericRangeQuery(&beforeFloat64, &afterFloat64)
				onDateQ.SetField("CreateAt")
				filters = append(filters, onDateQ)
			} else {
				if params.AfterDate != "" || params.BeforeDate != "" {
					var min, max *float64
					if params.AfterDate != "" {
						minf := float64(params.GetAfterDateMillis())
						min = &minf
					}

					if params.BeforeDate != "" {
						maxf := float64(params.GetBeforeDateMillis())
						max = &maxf
					}

					dateQ := bleve.NewNumericRangeQuery(min, max)
					dateQ.SetField("CreateAt")
					filters = append(filters, dateQ)
				}

				if params.ExcludedAfterDate != "" {
					minf := float64(params.GetExcludedAfterDateMillis())
					dateQ := bleve.NewNumericRangeQuery(&minf, nil)
					dateQ.SetField("CreateAt")
					notFilters = append(notFilters, dateQ)
				}

				if params.ExcludedBeforeDate != "" {
					maxf := float64(params.GetExcludedBeforeDateMillis())
					dateQ := bleve.NewNumericRangeQuery(nil, &maxf)
					dateQ.SetField("CreateAt")
					notFilters = append(notFilters, dateQ)
				}

				if params.ExcludedDate != "" {
					before, after := params.GetExcludedDateMillis()
					beforef := float64(before)
					afterf := float64(after)
					onDateQ := bleve.NewNumericRangeQuery(&beforef, &afterf)
					onDateQ.SetField("CreateAt")
					notFilters = append(notFilters, onDateQ)
				}
			}
		}

		if params.Terms != "" {
			terms := []string{}

			// Since we will put wildcard on the rest of the terms,
			// we will get exactPhraseTerms first and then remove the matching terms
			exactPhraseTerms := exactPhraseRegExpForFileSearch.FindAllString(params.Terms, -1)
			params.Terms = exactPhraseRegExpForFileSearch.ReplaceAllLiteralString(params.Terms, "")

			wildcardAddedTerms := strings.Fields(params.Terms)

			// A wildcard is attached to the end of every word
			// regardless of whether or not a wildcard exists
			for index, term := range wildcardAddedTerms {
				if !strings.HasPrefix(term, "*") {
					wildcardAddedTerms[index] = wildcardRegExpForFileSearch.ReplaceAllLiteralString(term, "*")
				}
			}

			parsedTerms := append(wildcardAddedTerms, exactPhraseTerms...)

			for _, term := range parsedTerms {
				if strings.HasSuffix(term, "*") {
					nameQ := bleve.NewWildcardQuery(term)
					nameQ.SetField("Name")
					contentQ := bleve.NewWildcardQuery(term)
					contentQ.SetField("Content")
					termQueries = append(termQueries, bleve.NewDisjunctionQuery(nameQ, contentQ))
				} else {
					terms = append(terms, term)
				}
			}

			if len(terms) > 0 {
				nameQ := bleve.NewMatchQuery(strings.Join(terms, " "))
				nameQ.SetField("Name")
				nameQ.SetOperator(termOperator)
				contentQ := bleve.NewMatchQuery(strings.Join(terms, " "))
				contentQ.SetField("Content")
				contentQ.SetOperator(termOperator)
				termQueries = append(termQueries, bleve.NewDisjunctionQuery(nameQ, contentQ))
			}
		}

		if params.ExcludedTerms != "" {
			nameQ := bleve.NewMatchQuery(params.ExcludedTerms)
			nameQ.SetField("Name")
			nameQ.SetOperator(termOperator)
			contentQ := bleve.NewMatchQuery(params.ExcludedTerms)
			contentQ.SetField("Content")
			contentQ.SetOperator(termOperator)
			notTermQueries = append(notTermQueries, bleve.NewDisjunctionQuery(nameQ, contentQ))
		}
	}

	allTermsQ := bleve.NewBooleanQuery()
	allTermsQ.AddMustNot(notTermQueries...)
	if searchParams[0].OrTerms {
		allTermsQ.AddShould(termQueries...)
	} else {
		allTermsQ.AddMust(termQueries...)
	}

	query := bleve.NewBooleanQuery()
	query.AddMust(channelDisjunctionQ)

	if len(termQueries) > 0 || len(notTermQueries) > 0 {
		query.AddMust(allTermsQ)
	}

	if len(filters) > 0 {
		query.AddMust(bleve.NewConjunctionQuery(filters...))
	}
	if len(notFilters) > 0 {
		query.AddMustNot(notFilters...)
	}

	search := bleve.NewSearchRequestOptions(query, perPage, page*perPage, false)
	search.SortBy([]string{"-CreateAt"})
	results, err := b.FileIndex.Search(search)
	if err != nil {
		return nil, model.NewAppError("Bleveengine.SearchFiles", "bleveengine.search_files.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fileIds := []string{}

	for _, r := range results.Hits {
		fileIds = append(fileIds, r.ID)
	}

	return fileIds, nil
}

func (b *BleveEngine) DeleteFile(fileID string) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	if err := b.FileIndex.Delete(fileID); err != nil {
		return model.NewAppError("Bleveengine.DeleteFile", "bleveengine.delete_file.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (b *BleveEngine) deleteFiles(searchRequest *bleve.SearchRequest, batchSize int) (int64, error) {
	resultsCount := int64(0)

	for {
		// As we are deleting the files after fetching them, we need to keep
		// From fixed always to 0
		searchRequest.From = 0
		searchRequest.Size = batchSize
		results, err := b.FileIndex.Search(searchRequest)
		if err != nil {
			return -1, err
		}
		batch := b.FileIndex.NewBatch()
		for _, file := range results.Hits {
			batch.Delete(file.ID)
		}
		if err := b.FileIndex.Batch(batch); err != nil {
			return -1, err
		}
		resultsCount += int64(results.Hits.Len())
		if results.Hits.Len() < batchSize {
			break
		}
	}

	return resultsCount, nil
}

func (b *BleveEngine) DeleteUserFiles(userID string) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	query := bleve.NewTermQuery(userID)
	query.SetField("CreatorId")
	search := bleve.NewSearchRequest(query)
	deleted, err := b.deleteFiles(search, DeleteFilesBatchSize)
	if err != nil {
		return model.NewAppError("Bleveengine.DeleteUserFiles",
			"bleveengine.delete_user_files.error", nil,
			err.Error(), http.StatusInternalServerError)
	}

	mlog.Info("Files for user deleted", mlog.String("user_id", userID), mlog.Int64("deleted", deleted))

	return nil
}

func (b *BleveEngine) DeletePostFiles(postID string) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	query := bleve.NewTermQuery(postID)
	query.SetField("PostId")
	search := bleve.NewSearchRequest(query)
	deleted, err := b.deleteFiles(search, DeleteFilesBatchSize)
	if err != nil {
		return model.NewAppError("Bleveengine.DeletePostFiles",
			"bleveengine.delete_post_files.error", nil,
			err.Error(), http.StatusInternalServerError)
	}

	mlog.Info("Files for post deleted", mlog.String("post_id", postID), mlog.Int64("deleted", deleted))

	return nil
}

func (b *BleveEngine) DeleteFilesBatch(endTime, limit int64) *model.AppError {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	endTimeFloat := float64(endTime)
	query := bleve.NewNumericRangeQuery(nil, &endTimeFloat)
	query.SetField("CreateAt")
	search := bleve.NewSearchRequestOptions(query, int(limit), 0, false)
	search.SortBy([]string{"-CreateAt"})

	deleted, err := b.deleteFiles(search, DeleteFilesBatchSize)
	if err != nil {
		return model.NewAppError("Bleveengine.DeleteFilesBatch",
			"bleveengine.delete_files_batch.error", nil,
			err.Error(), http.StatusInternalServerError)
	}

	mlog.Info("Files in batch deleted", mlog.Int64("endTime", endTime), mlog.Int64("limit", limit), mlog.Int64("deleted", deleted))

	return nil
}
