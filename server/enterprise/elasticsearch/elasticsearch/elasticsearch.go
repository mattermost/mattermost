// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"

	elastic "github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/typedapi/core/deletebyquery"
	"github.com/elastic/go-elasticsearch/v8/typedapi/core/search"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types/enums/highlighterencoder"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types/enums/operator"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types/enums/sortorder"
)

const elasticsearchMaxVersion = 8

var (
	purgeIndexListAllowedIndexes = []string{common.IndexBaseChannels}
)

type ElasticsearchInterfaceImpl struct {
	client      *elastic.TypedClient
	mutex       sync.RWMutex
	ready       int32
	version     int
	fullVersion string
	plugins     []string

	bulkProcessor *Bulk
	Platform      *platform.PlatformService
}

func getJSONOrErrorStr(obj any) string {
	b, err := json.Marshal(obj)
	if err != nil {
		return err.Error()
	}
	return string(b)
}

func (*ElasticsearchInterfaceImpl) UpdateConfig(cfg *model.Config) {
	// Not needed, it use the `Server` stored internally to get always the last version
}

func (*ElasticsearchInterfaceImpl) GetName() string {
	return "elasticsearch"
}

func (es *ElasticsearchInterfaceImpl) IsEnabled() bool {
	return *es.Platform.Config().ElasticsearchSettings.EnableIndexing
}

func (es *ElasticsearchInterfaceImpl) IsActive() bool {
	return *es.Platform.Config().ElasticsearchSettings.EnableIndexing && atomic.LoadInt32(&es.ready) == 1
}

func (es *ElasticsearchInterfaceImpl) IsIndexingEnabled() bool {
	return *es.Platform.Config().ElasticsearchSettings.EnableIndexing
}

func (es *ElasticsearchInterfaceImpl) IsSearchEnabled() bool {
	return *es.Platform.Config().ElasticsearchSettings.EnableSearching
}

func (es *ElasticsearchInterfaceImpl) IsAutocompletionEnabled() bool {
	return *es.Platform.Config().ElasticsearchSettings.EnableAutocomplete
}

func (es *ElasticsearchInterfaceImpl) IsIndexingSync() bool {
	return *es.Platform.Config().ElasticsearchSettings.LiveIndexingBatchSize <= 1
}

func (es *ElasticsearchInterfaceImpl) Start() *model.AppError {
	if license := es.Platform.License(); license == nil || !*license.Features.Elasticsearch || !*es.Platform.Config().ElasticsearchSettings.EnableIndexing {
		return nil
	}

	es.mutex.Lock()
	defer es.mutex.Unlock()

	if atomic.LoadInt32(&es.ready) != 0 {
		// Elasticsearch is already started. We don't return an error
		// because "Test Connection" already re-initializes the client. So this
		// can be a valid scenario.
		return nil
	}

	var appErr *model.AppError
	if es.client, appErr = createTypedClient(es.Platform.Log(), es.Platform.Config(), es.Platform.FileBackend(), true); appErr != nil {
		return appErr
	}

	version, major, appErr := checkMaxVersion(es.client, es.Platform.Config())
	if appErr != nil {
		return appErr
	}

	// Since we are only retrieving plugins for the Support Packet generation, it doesn't make sense to kill the process if we get an error
	// Instead, we will log it and move forward
	resp, err := es.client.API.Cat.Plugins().Do(context.Background())
	if err != nil {
		es.Platform.Log().Warn("Error retrieving elasticsearch plugins", mlog.Err(err))
	} else {
		for _, p := range resp {
			es.plugins = append(es.plugins, *p.Component)
		}
	}

	es.version = major
	es.fullVersion = version

	ctx := context.Background()

	if *es.Platform.Config().ElasticsearchSettings.LiveIndexingBatchSize > 1 {
		es.bulkProcessor = NewBulk(es.Platform.Config().ElasticsearchSettings,
			es.Platform.Log(),
			es.client)
	}

	// Set up posts index template.
	_, err = es.client.API.Indices.PutIndexTemplate(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBasePosts).
		Request(common.GetPostTemplate(es.Platform.Config())).
		Do(ctx)
	if err != nil {
		return model.NewAppError("Elasticsearch.start", "ent.elasticsearch.create_template_posts_if_not_exists.template_create_failed", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	// Set up channels index template.
	_, err = es.client.API.Indices.PutIndexTemplate(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseChannels).
		Request(common.GetChannelTemplate(es.Platform.Config())).
		Do(ctx)
	if err != nil {
		return model.NewAppError("Elasticsearch.start", "ent.elasticsearch.create_template_channels_if_not_exists.template_create_failed", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	// Set up users index template.
	_, err = es.client.API.Indices.PutIndexTemplate(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseUsers).
		Request(common.GetUserTemplate(es.Platform.Config())).
		Do(ctx)
	if err != nil {
		return model.NewAppError("Elasticsearch.start", "ent.elasticsearch.create_template_users_if_not_exists.template_create_failed", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	// Set up files index template.
	_, err = es.client.API.Indices.PutIndexTemplate(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles).
		Request(common.GetFileInfoTemplate(es.Platform.Config())).
		Do(ctx)
	if err != nil {
		return model.NewAppError("Elasticsearch.start", "ent.elasticsearch.create_template_file_info_if_not_exists.template_create_failed", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	atomic.StoreInt32(&es.ready, 1)

	return nil
}

func (es *ElasticsearchInterfaceImpl) Stop() *model.AppError {
	es.mutex.Lock()
	defer es.mutex.Unlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.start", "ent.elasticsearch.stop.already_stopped.app_error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	es.client = nil
	// Flushing any pending requests
	if es.bulkProcessor != nil {
		if err := es.bulkProcessor.Stop(); err != nil {
			es.Platform.Log().Warn("Error stopping bulk processor", mlog.Err(err))
		}
		es.bulkProcessor = nil
	}

	atomic.StoreInt32(&es.ready, 0)

	return nil
}

func (es *ElasticsearchInterfaceImpl) GetVersion() int {
	return es.version
}

func (es *ElasticsearchInterfaceImpl) GetFullVersion() string {
	return es.fullVersion
}

func (es *ElasticsearchInterfaceImpl) GetPlugins() []string {
	return es.plugins
}

func (es *ElasticsearchInterfaceImpl) IndexPost(post *model.Post, teamId string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.IndexPost", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	indexName := common.BuildPostIndexName(*es.Platform.Config().ElasticsearchSettings.AggregatePostsAfterDays,
		*es.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts, *es.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts_MONTH, time.Now(), post.CreateAt)

	searchPost, err := common.ESPostFromPost(post, teamId)
	if err != nil {
		return model.NewAppError("Elasticsearch.IndexPost", "ent.elasticsearch.index_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if es.bulkProcessor != nil {
		err = es.bulkProcessor.IndexOp(types.IndexOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(searchPost.Id),
		}, searchPost)
		if err != nil {
			return model.NewAppError("Elasticsearch.IndexPost", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		_, err = es.client.Index(indexName).
			Id(post.Id).
			Document(searchPost).
			Do(ctx)
	}
	if err != nil {
		return model.NewAppError("Elasticsearch.IndexPost", "ent.elasticsearch.index_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	metrics := es.Platform.Metrics()
	if metrics != nil {
		metrics.IncrementPostIndexCounter()
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) getPostIndexNames() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	indexes, err := es.client.API.Indices.Get("_all").Do(ctx)
	if err != nil {
		return nil, err
	}
	postIndexes := make([]string, 0)
	for name := range indexes {
		if strings.HasPrefix(name, *es.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts) {
			postIndexes = append(postIndexes, name)
		}
	}
	return postIndexes, nil
}

func (es *ElasticsearchInterfaceImpl) SearchPosts(channels model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError) {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return []string{}, nil, model.NewAppError("Elasticsearch.SearchPosts", "ent.elasticsearch.search_posts.disabled", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	var channelIds []string
	for _, channel := range channels {
		channelIds = append(channelIds, channel.Id)
	}

	var termQueries, notTermQueries, highlightQueries []types.Query
	var filters, notFilters []types.Query
	for i, params := range searchParams {
		newTerms := []string{}
		for _, term := range strings.Split(params.Terms, " ") {
			if searchengine.EmailRegex.MatchString(term) {
				term = `"` + term + `"`
			}
			newTerms = append(newTerms, term)
		}

		params.Terms = strings.Join(newTerms, " ")

		termOperator := operator.And
		if searchParams[0].OrTerms {
			termOperator = operator.Or
		}

		// Date, channels and FromUsers filters come in all
		// searchParams iteration, and as they are global to the
		// query, we only need to process them once
		if i == 0 {
			if len(params.InChannels) > 0 {
				filters = append(filters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"channel_id": params.InChannels}},
				})
			}

			if len(params.ExcludedChannels) > 0 {
				notFilters = append(notFilters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"channel_id": params.ExcludedChannels}},
				})
			}

			if len(params.FromUsers) > 0 {
				filters = append(filters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"user_id": params.FromUsers}},
				})
			}

			if len(params.ExcludedUsers) > 0 {
				notFilters = append(notFilters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"user_id": params.ExcludedUsers}},
				})
			}

			if params.OnDate != "" {
				before, after := params.GetOnDateMillis()
				filters = append(filters, types.Query{
					Range: map[string]types.RangeQuery{
						"create_at": types.NumberRangeQuery{
							Gte: model.NewPointer(types.Float64(before)),
							Lte: model.NewPointer(types.Float64(after)),
						},
					},
				})
			} else {
				if params.AfterDate != "" || params.BeforeDate != "" {
					nrQuery := types.NumberRangeQuery{}
					if params.AfterDate != "" {
						nrQuery.Gte = model.NewPointer(types.Float64(params.GetAfterDateMillis()))
					}

					if params.BeforeDate != "" {
						nrQuery.Lte = model.NewPointer(types.Float64(params.GetBeforeDateMillis()))
					}

					query := types.Query{
						Range: map[string]types.RangeQuery{
							"create_at": nrQuery,
						},
					}
					filters = append(filters, query)
				}

				if params.ExcludedAfterDate != "" || params.ExcludedBeforeDate != "" || params.ExcludedDate != "" {
					if params.ExcludedDate != "" {
						before, after := params.GetExcludedDateMillis()
						notFilters = append(notFilters, types.Query{
							Range: map[string]types.RangeQuery{
								"create_at": types.NumberRangeQuery{
									Gte: model.NewPointer(types.Float64(before)),
									Lte: model.NewPointer(types.Float64(after)),
								},
							},
						})
					}

					if params.ExcludedAfterDate != "" {
						notFilters = append(notFilters, types.Query{
							Range: map[string]types.RangeQuery{
								"create_at": types.NumberRangeQuery{
									Gte: model.NewPointer(types.Float64(params.GetExcludedAfterDateMillis())),
								},
							},
						})
					}

					if params.ExcludedBeforeDate != "" {
						notFilters = append(notFilters, types.Query{
							Range: map[string]types.RangeQuery{
								"create_at": types.NumberRangeQuery{
									Lte: model.NewPointer(types.Float64(params.GetExcludedBeforeDateMillis())),
								},
							},
						})
					}
				}
			}
		}

		if params.IsHashtag {
			if params.Terms != "" {
				query := types.Query{
					SimpleQueryString: &types.SimpleQueryStringQuery{
						Query:           params.Terms,
						Fields:          []string{"hashtags"},
						DefaultOperator: &termOperator,
					},
				}
				termQueries = append(termQueries, query)
				highlightQueries = append(highlightQueries, query)
			} else if params.ExcludedTerms != "" {
				query := types.Query{
					SimpleQueryString: &types.SimpleQueryStringQuery{
						Query:           params.ExcludedTerms,
						Fields:          []string{"hashtags"},
						DefaultOperator: &termOperator,
					},
				}
				notTermQueries = append(notTermQueries, query)
			}
		} else {
			if params.Terms != "" {
				elements := []types.Query{
					{
						SimpleQueryString: &types.SimpleQueryStringQuery{
							Query:           params.Terms,
							Fields:          []string{"message"},
							DefaultOperator: &termOperator,
						},
					}, {
						SimpleQueryString: &types.SimpleQueryStringQuery{
							Query:           params.Terms,
							Fields:          []string{"attachments"},
							DefaultOperator: &termOperator,
						},
					}, {
						Term: map[string]types.TermQuery{
							"urls": {Value: params.Terms},
						},
					},
				}
				query := types.Query{
					Bool: &types.BoolQuery{Should: append([]types.Query(nil), elements...)},
				}

				termQueries = append(termQueries, query)

				hashtagTerms := []string{}
				for _, term := range strings.Split(params.Terms, " ") {
					hashtagTerms = append(hashtagTerms, "#"+term)
				}

				hashtagQuery := types.Query{
					SimpleQueryString: &types.SimpleQueryStringQuery{
						Query:           strings.Join(hashtagTerms, " "),
						Fields:          []string{"hashtags"},
						DefaultOperator: &termOperator,
					},
				}
				highlightQuery := types.Query{
					Bool: &types.BoolQuery{Should: append(elements, hashtagQuery)},
				}

				highlightQueries = append(highlightQueries, highlightQuery)
			}

			if params.ExcludedTerms != "" {
				query := types.Query{
					Bool: &types.BoolQuery{Should: []types.Query{
						{
							SimpleQueryString: &types.SimpleQueryStringQuery{
								Query:           params.ExcludedTerms,
								Fields:          []string{"message"},
								DefaultOperator: &termOperator,
							},
						}, {
							SimpleQueryString: &types.SimpleQueryStringQuery{
								Query:           params.ExcludedTerms,
								Fields:          []string{"attachments"},
								DefaultOperator: &termOperator,
							},
						}, {
							Term: map[string]types.TermQuery{
								"urls": {Value: params.ExcludedTerms},
							},
						},
					}},
				}

				notTermQueries = append(notTermQueries, query)
			}
		}
	}

	allTermsQuery := &types.BoolQuery{
		MustNot: append([]types.Query(nil), notTermQueries...),
	}
	if searchParams[0].OrTerms {
		allTermsQuery.Should = append([]types.Query(nil), termQueries...)
	} else {
		allTermsQuery.Must = append([]types.Query(nil), termQueries...)
	}

	fullHighlightsQuery := &types.BoolQuery{
		Filter:  append([]types.Query(nil), filters...),
		MustNot: append([]types.Query(nil), notFilters...),
	}

	if searchParams[0].OrTerms {
		fullHighlightsQuery.Should = append([]types.Query(nil), highlightQueries...)
	} else {
		fullHighlightsQuery.Must = append([]types.Query(nil), highlightQueries...)
	}

	filters = append(filters,
		types.Query{
			Terms: &types.TermsQuery{
				TermsQuery: map[string]types.TermsQueryField{"channel_id": channelIds},
			},
		},
		types.Query{
			Bool: &types.BoolQuery{
				Should: []types.Query{
					{
						Term: map[string]types.TermQuery{"type": {Value: "default"}},
					}, {
						Term: map[string]types.TermQuery{"type": {Value: "slack_attachment"}},
					},
				},
			},
		},
	)

	highlight := &types.Highlight{
		HighlightQuery: &types.Query{
			Bool: fullHighlightsQuery,
		},
		Fields: map[string]types.HighlightField{
			"message":     {},
			"attachments": {},
			"url":         {},
			"hashtag":     {},
		},
		Encoder: &highlighterencoder.Html,
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter:  append([]types.Query(nil), filters...),
			Must:    []types.Query{{Bool: allTermsQuery}},
			MustNot: append([]types.Query(nil), notFilters...),
		},
	}

	search := es.client.Search().
		Index(common.SearchIndexName(es.Platform.Config().ElasticsearchSettings, common.IndexBasePosts+"*")).
		Request(&search.Request{
			Query:     query,
			Highlight: highlight,
		}).
		Sort(types.SortOptions{SortOptions: map[string]types.FieldSort{
			"create_at": {Order: &sortorder.Desc},
		}}).
		From(page * perPage).
		Size(perPage)

	searchResult, err := search.Do(ctx)
	if err != nil {
		errorStr := "err=" + err.Error()
		if *es.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return []string{}, nil, model.NewAppError("Elasticsearch.SearchPosts", "ent.elasticsearch.search_posts.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	postIds := make([]string, len(searchResult.Hits.Hits))
	matches := make(model.PostSearchMatches, len(searchResult.Hits.Hits))

	for i, hit := range searchResult.Hits.Hits {
		var post common.ESPost
		err := json.Unmarshal(hit.Source_, &post)
		if err != nil {
			return postIds, matches, model.NewAppError("Elasticsearch.SearchPosts", "ent.elasticsearch.search_posts.unmarshall_post_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		postIds[i] = post.Id

		matchesForPost, err := common.GetMatchesForHit(hit.Highlight)
		if err != nil {
			return postIds, matches, model.NewAppError("Elasticsearch.SearchPosts", "ent.elasticsearch.search_posts.parse_matches_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		matches[post.Id] = matchesForPost
	}

	return postIds, matches, nil
}

func (es *ElasticsearchInterfaceImpl) DeletePost(post *model.Post) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DeletePost", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	// This is racy with index aggregation, but since the posts are verified in the database when returning search
	// results, there's no risk of deleted posts getting sent back to the user in response to a search query, and even
	// then the race is very unlikely because it would only occur when someone deletes a post that's due to be
	// aggregated but hasn't been yet, which makes the time window small and the post likelihood very low.
	indexName := common.BuildPostIndexName(*es.Platform.Config().ElasticsearchSettings.AggregatePostsAfterDays,
		*es.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts, *es.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts_MONTH, time.Now(), post.CreateAt)

	if err := es.deletePost(indexName, post.Id); err != nil {
		return err
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) DeleteChannelPosts(rctx request.CTX, channelID string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DeleteChannelPosts", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	postIndexes, err := es.getPostIndexNames()
	if err != nil {
		return model.NewAppError("Elasticsearch.DeleteChannelPosts", "ent.elasticsearch.delete_channel_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Term: map[string]types.TermQuery{"channel_id": {Value: channelID}},
			}},
		},
	}
	deleteQuery := es.client.DeleteByQuery(strings.Join(postIndexes, ",")).
		Request(&deletebyquery.Request{
			Query: query,
		})
	response, err := deleteQuery.Do(ctx)
	if err != nil {
		return model.NewAppError("Elasticsearch.DeleteChannelPosts", "ent.elasticsearch.delete_channel_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("Posts for channel deleted", mlog.String("channel_id", channelID), mlog.Int("deleted", *response.Deleted))

	return nil
}

func (es *ElasticsearchInterfaceImpl) DeleteUserPosts(rctx request.CTX, userID string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DeleteUserPosts", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	postIndexes, err := es.getPostIndexNames()
	if err != nil {
		return model.NewAppError("Elasticsearch.DeleteUserPosts", "ent.elasticsearch.delete_user_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Term: map[string]types.TermQuery{"user_id": {Value: userID}},
			}},
		},
	}

	deleteQuery := es.client.DeleteByQuery(strings.Join(postIndexes, ",")).
		Request(&deletebyquery.Request{
			Query: query,
		})

	response, err := deleteQuery.Do(ctx)
	if err != nil {
		return model.NewAppError("Elasticsearch.DeleteUserPosts", "ent.elasticsearch.delete_user_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("Posts for user deleted", mlog.String("user_id", userID), mlog.Int("deleted", *response.Deleted))

	return nil
}

func (es *ElasticsearchInterfaceImpl) deletePost(indexName, postID string) *model.AppError {
	var err error
	if es.bulkProcessor != nil {
		err = es.bulkProcessor.DeleteOp(types.DeleteOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(postID),
		})
		if err != nil {
			return model.NewAppError("Elasticsearch.DeletePost", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()
		_, err = es.client.Delete(indexName, postID).Do(ctx)
	}
	if err != nil {
		return model.NewAppError("Elasticsearch.DeletePost", "ent.elasticsearch.delete_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (es *ElasticsearchInterfaceImpl) IndexChannel(rctx request.CTX, channel *model.Channel, userIDs, teamMemberIDs []string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.IndexChannel", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	indexName := *es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseChannels

	searchChannel := common.ESChannelFromChannel(channel, userIDs, teamMemberIDs)

	var err error
	if es.bulkProcessor != nil {
		err = es.bulkProcessor.IndexOp(types.IndexOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(searchChannel.Id),
		}, searchChannel)
		if err != nil {
			return model.NewAppError("Elasticsearch.IndexChannel", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()
		_, err = es.client.Index(indexName).
			Id(searchChannel.Id).
			Document(searchChannel).
			Do(ctx)
	}
	if err != nil {
		return model.NewAppError("Elasticsearch.IndexChannel", "ent.elasticsearch.index_channel.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	metrics := es.Platform.Metrics()
	if metrics != nil {
		metrics.IncrementChannelIndexCounter()
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) SearchChannels(teamId, userID string, term string, isGuest, includeDeleted bool) ([]string, *model.AppError) {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return []string{}, model.NewAppError("Elasticsearch.SearchChannels", "ent.elasticsearch.search_channels.disabled", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	boolNotPrivate := types.Query{
		Bool: &types.BoolQuery{
			MustNot: []types.Query{{
				Term: map[string]types.TermQuery{"type": {Value: model.ChannelTypePrivate}},
			}},
		},
	}

	userQ := types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Term: map[string]types.TermQuery{"user_ids": {Value: userID}},
			}},
			Must: []types.Query{{
				Term: map[string]types.TermQuery{"type": {Value: model.ChannelTypePrivate}},
			}},
		},
	}

	query := &types.BoolQuery{}

	if teamId != "" {
		query.Filter = append(query.Filter, types.Query{Term: map[string]types.TermQuery{"team_id": {Value: teamId}}})
	} else {
		query.Filter = append(query.Filter, types.Query{Term: map[string]types.TermQuery{"team_member_ids": {Value: userID}}})
	}

	if !isGuest {
		query.Filter = append(query.Filter, types.Query{
			Bool: &types.BoolQuery{
				Should: []types.Query{
					boolNotPrivate, userQ,
				},
				Must: []types.Query{{
					Prefix: map[string]types.PrefixQuery{
						"name_suggestions": {Value: strings.ToLower(term)},
					},
				}},
				MinimumShouldMatch: 1,
			},
		})
	} else {
		query.Filter = append(query.Filter, types.Query{
			Bool: &types.BoolQuery{
				Must: []types.Query{
					boolNotPrivate, {
						Prefix: map[string]types.PrefixQuery{
							"name_suggestions": {Value: strings.ToLower(term)},
						},
					}},
			},
		})
	}

	if !includeDeleted {
		query.Filter = append(query.Filter, types.Query{
			Term: map[string]types.TermQuery{
				"delete_at": {Value: 0},
			},
		})
	}

	search := es.client.Search().
		Index(common.SearchIndexName(es.Platform.Config().ElasticsearchSettings, common.IndexBaseChannels)).
		Request(&search.Request{
			Query: &types.Query{Bool: query},
		}).
		Size(model.ChannelSearchDefaultLimit)

	searchResult, err := search.Do(ctx)

	if err != nil {
		errorStr := "err=" + err.Error()
		if *es.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return nil, model.NewAppError("Elasticsearch.SearchChannels", "ent.elasticsearch.search_channels.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	channelIds := []string{}
	for _, hit := range searchResult.Hits.Hits {
		var channel common.ESChannel
		err := json.Unmarshal(hit.Source_, &channel)
		if err != nil {
			return nil, model.NewAppError("Elasticsearch.SearchChannels", "ent.elasticsearch.search_channels.unmarshall_channel_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		channelIds = append(channelIds, channel.Id)
	}

	return channelIds, nil
}

func (es *ElasticsearchInterfaceImpl) DeleteChannel(channel *model.Channel) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DeleteChannel", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	var err error
	if es.bulkProcessor != nil {
		err = es.bulkProcessor.DeleteOp(types.DeleteOperation{
			Index_: model.NewPointer(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseChannels),
			Id_:    model.NewPointer(channel.Id),
		})
		if err != nil {
			return model.NewAppError("Elasticsearch.IndexPost", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		_, err = es.client.Delete(*es.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBaseChannels, channel.Id).
			Do(ctx)
	}
	if err != nil {
		return model.NewAppError("Elasticsearch.DeleteChannel", "ent.elasticsearch.delete_channel.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) IndexUser(rctx request.CTX, user *model.User, teamsIds, channelsIds []string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.IndexUser", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	indexName := *es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseUsers

	searchUser := common.ESUserFromUserAndTeams(user, teamsIds, channelsIds)

	var err error
	if es.bulkProcessor != nil {
		err = es.bulkProcessor.IndexOp(types.IndexOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(searchUser.Id),
		}, searchUser)
		if err != nil {
			return model.NewAppError("Elasticsearch.IndexPost", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		_, err = es.client.Index(indexName).
			Id(searchUser.Id).
			Document(searchUser).
			Do(ctx)
	}
	if err != nil {
		return model.NewAppError("Elasticsearch.IndexUser", "ent.elasticsearch.index_user.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	metrics := es.Platform.Metrics()
	if metrics != nil {
		metrics.IncrementUserIndexCounter()
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) autocompleteUsers(contextCategory string, categoryIds []string, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return nil, model.NewAppError("Elasticsearch.autocompleteUsers", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.BoolQuery{}

	if term != "" {
		var suggestionField string
		if options.AllowFullNames {
			suggestionField = "suggestions_with_fullname"
		} else {
			suggestionField = "suggestions_without_fullname"
		}
		query.Must = append(query.Must, types.Query{
			Prefix: map[string]types.PrefixQuery{
				suggestionField: {Value: strings.ToLower(term)},
			},
		})
	}

	if len(categoryIds) > 0 {
		var iCategoryIds []string
		for _, id := range categoryIds {
			if id != "" {
				iCategoryIds = append(iCategoryIds, id)
			}
		}
		if len(iCategoryIds) > 0 {
			query.Filter = append(query.Filter, types.Query{
				Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{contextCategory: iCategoryIds}},
			})
		}
	}

	if !options.AllowInactive {
		query.Filter = append(query.Filter, types.Query{
			Bool: &types.BoolQuery{
				Should: []types.Query{
					{
						Range: map[string]types.RangeQuery{
							"delete_at": types.DateRangeQuery{
								Lte: model.NewPointer("0"),
							},
						},
					}, {
						Bool: &types.BoolQuery{
							MustNot: []types.Query{{
								Exists: &types.ExistsQuery{Field: "delete_at"},
							}},
						},
					},
				},
			},
		})
	}

	if options.Role != "" {
		query.Filter = append(query.Filter, types.Query{
			Term: map[string]types.TermQuery{
				"roles": {Value: options.Role},
			},
		})
	}

	search := es.client.Search().
		Index(common.SearchIndexName(es.Platform.Config().ElasticsearchSettings, common.IndexBaseUsers)).
		Request(&search.Request{
			Query: &types.Query{Bool: query},
		}).
		Size(options.Limit)

	searchResults, err := search.Do(ctx)

	if err != nil {
		errorStr := "err=" + err.Error()
		if *es.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return nil, model.NewAppError("Elasticsearch.autocompleteUsers", "ent.elasticsearch.search_users.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	users := []common.ESUser{}
	for _, hit := range searchResults.Hits.Hits {
		var user common.ESUser
		err := json.Unmarshal(hit.Source_, &user)
		if err != nil {
			return nil, model.NewAppError("Elasticsearch.autocompleteUsers", "ent.elasticsearch.search_users.unmarshall_user_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		users = append(users, user)
	}

	return users, nil
}

func (es *ElasticsearchInterfaceImpl) autocompleteUsersInChannel(channelId, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	return es.autocompleteUsers("channel_id", []string{channelId}, term, options)
}

func (es *ElasticsearchInterfaceImpl) autocompleteUsersInChannels(channelIds []string, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	return es.autocompleteUsers("channel_id", channelIds, term, options)
}

func (es *ElasticsearchInterfaceImpl) autocompleteUsersInTeam(teamId, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	return es.autocompleteUsers("team_id", []string{teamId}, term, options)
}

func (es *ElasticsearchInterfaceImpl) autocompleteUsersNotInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return nil, model.NewAppError("Elasticsearch.autocompleteUsersNotInChannel", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	filterMust := []types.Query{{Term: map[string]types.TermQuery{
		"team_id": {Value: teamId},
	}}}
	if len(restrictedToChannels) > 0 {
		filterMust = append(filterMust, types.Query{
			Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"channel_id": restrictedToChannels}},
		})
	}

	query := &types.BoolQuery{
		Filter: []types.Query{{
			Bool: &types.BoolQuery{
				Must: filterMust,
			},
		}},
		MustNot: []types.Query{{
			Term: map[string]types.TermQuery{
				"channel_id": {Value: channelId},
			},
		}},
	}

	if term != "" {
		var suggestionField string
		if options.AllowFullNames {
			suggestionField = "suggestions_with_fullname"
		} else {
			suggestionField = "suggestions_without_fullname"
		}
		query.Must = append(query.Must, types.Query{
			Prefix: map[string]types.PrefixQuery{
				suggestionField: {Value: strings.ToLower(term)},
			},
		})
	}

	if !options.AllowInactive {
		notExistField := types.Query{
			Bool: &types.BoolQuery{
				MustNot: []types.Query{{
					Exists: &types.ExistsQuery{Field: "delete_at"},
				}},
			},
		}
		deleteRangeQuery := types.Query{
			Range: map[string]types.RangeQuery{
				"delete_at": types.DateRangeQuery{
					Lte: model.NewPointer("0"),
				},
			},
		}
		inactiveQuery := types.Query{
			Bool: &types.BoolQuery{
				Should: []types.Query{deleteRangeQuery, notExistField},
			},
		}
		query.Filter = append(query.Filter, inactiveQuery)
	}

	if options.Role != "" {
		query.Filter = append(query.Filter, types.Query{
			Term: map[string]types.TermQuery{
				"roles": {Value: options.Role},
			},
		})
	}

	search := es.client.Search().
		Index(common.SearchIndexName(es.Platform.Config().ElasticsearchSettings, common.IndexBaseUsers)).
		Request(&search.Request{
			Query: &types.Query{Bool: query},
		}).
		Size(options.Limit)

	searchResults, err := search.Do(ctx)
	if err != nil {
		errorStr := "err=" + err.Error()
		if *es.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return nil, model.NewAppError("Elasticsearch.autocompleteUsersNotInChannel", "ent.elasticsearch.search_users.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	users := []common.ESUser{}
	for _, hit := range searchResults.Hits.Hits {
		var user common.ESUser
		err := json.Unmarshal(hit.Source_, &user)
		if err != nil {
			return nil, model.NewAppError("Elasticsearch.autocompleteUsersNotInChannel", "ent.elasticsearch.search_users.unmarshall_user_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		users = append(users, user)
	}

	return users, nil
}

func (es *ElasticsearchInterfaceImpl) SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError) {
	if restrictedToChannels != nil && len(restrictedToChannels) == 0 {
		return []string{}, []string{}, nil
	}

	uchan, err := es.autocompleteUsersInChannel(channelId, term, options)
	if err != nil {
		return nil, nil, err
	}

	var nuchan []common.ESUser
	nuchan, err = es.autocompleteUsersNotInChannel(teamId, channelId, restrictedToChannels, term, options)
	if err != nil {
		return nil, nil, err
	}

	uchanIds := []string{}
	for _, user := range uchan {
		uchanIds = append(uchanIds, user.Id)
	}
	nuchanIds := []string{}
	for _, user := range nuchan {
		nuchanIds = append(nuchanIds, user.Id)
	}

	return uchanIds, nuchanIds, nil
}

func (es *ElasticsearchInterfaceImpl) SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError) {
	if restrictedToChannels != nil && len(restrictedToChannels) == 0 {
		return []string{}, nil
	}

	var users []common.ESUser
	var err *model.AppError
	if restrictedToChannels == nil {
		users, err = es.autocompleteUsersInTeam(teamId, term, options)
	} else {
		users, err = es.autocompleteUsersInChannels(restrictedToChannels, term, options)
	}
	if err != nil {
		return nil, err
	}

	usersIds := []string{}
	if len(users) >= options.Limit {
		users = users[:options.Limit]
	}

	for _, user := range users {
		usersIds = append(usersIds, user.Id)
	}

	return usersIds, nil
}

func (es *ElasticsearchInterfaceImpl) DeleteUser(user *model.User) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DeleteUser", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	var err error
	if es.bulkProcessor != nil {
		err = es.bulkProcessor.DeleteOp(types.DeleteOperation{
			Index_: model.NewPointer(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseUsers),
			Id_:    model.NewPointer(user.Id),
		})
		if err != nil {
			return model.NewAppError("Elasticsearch.DeleteUser", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		_, err = es.client.Delete(*es.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBaseUsers, user.Id).
			Do(ctx)
	}
	if err != nil {
		return model.NewAppError("Elasticsearch.DeleteUser", "ent.elasticsearch.delete_user.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) TestConfig(rctx request.CTX, cfg *model.Config) *model.AppError {
	if license := es.Platform.License(); license == nil || !*license.Features.Elasticsearch {
		return model.NewAppError("Elasticsearch.TestConfig", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
	}

	if !*cfg.ElasticsearchSettings.EnableIndexing {
		return model.NewAppError("Elasticsearch.TestConfig", "ent.elasticsearch.test_config.indexing_disabled.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusNotImplemented)
	}

	client, appErr := createTypedClient(rctx.Logger(), cfg, es.Platform.FileBackend(), true)
	if appErr != nil {
		return appErr
	}

	_, _, appErr = checkMaxVersion(client, cfg)
	if appErr != nil {
		return appErr
	}

	// Resetting the state.
	if atomic.CompareAndSwapInt32(&es.ready, 0, 1) {
		// Re-assign the client.
		// This is necessary in case elasticsearch was started
		// after server start.
		es.mutex.Lock()
		es.client = client
		es.mutex.Unlock()
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) PurgeIndexes(rctx request.CTX) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if license := es.Platform.License(); license == nil || !*license.Features.Elasticsearch {
		return model.NewAppError("Elasticsearch.PurgeIndexes", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
	}

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.PurgeIndexes", "ent.elasticsearch.generic.disabled", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	indexPrefix := *es.Platform.Config().ElasticsearchSettings.IndexPrefix
	indexesToDelete := indexPrefix + "*"

	if ignorePurgeIndexes := *es.Platform.Config().ElasticsearchSettings.IgnoredPurgeIndexes; ignorePurgeIndexes != "" {
		// we are checking if provided indexes exist. If an index doesn't exist,
		// elasticsearch returns an error while trying to purge it even we intend to
		// ignore it.
		for _, ignorePurgeIndex := range strings.Split(ignorePurgeIndexes, ",") {
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
			defer cancel()

			_, err := es.client.Indices.Get(ignorePurgeIndex).Do(ctx)
			if err != nil {
				rctx.Logger().Warn("Elasticsearch index get error", mlog.String("index", ignorePurgeIndex), mlog.Err(err))
				continue
			}
			indexesToDelete += ",-" + strings.TrimSpace(ignorePurgeIndex)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	_, err := es.client.Indices.Delete(indexesToDelete).Do(ctx)
	if err != nil {
		rctx.Logger().Error("Elastic Search PurgeIndexes Error", mlog.Err(err))
		return model.NewAppError("Elasticsearch.PurgeIndexes", "ent.elasticsearch.purge_index.delete_failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// PurgeIndexList purges a list of specified indexes.
// For now it only allows purging the channels index as thats all that's needed,
// but the code is written in generic fashion to allow it to purge any index.
// It needs more logic around post indexes as their name isn't the same, but rather follow a pattern
// containing the date as well.
func (es *ElasticsearchInterfaceImpl) PurgeIndexList(rctx request.CTX, indexes []string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if license := es.Platform.License(); license == nil || !*license.Features.Elasticsearch {
		return model.NewAppError("Elasticsearch.PurgeIndexList", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
	}

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.PurgeIndexList", "ent.elasticsearch.generic.disabled", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	indexPrefix := *es.Platform.Config().ElasticsearchSettings.IndexPrefix
	indexToDeleteMap := map[string]bool{}
	for _, index := range indexes {
		isKnownIndex := false
		for _, allowedIndex := range purgeIndexListAllowedIndexes {
			if index == allowedIndex {
				isKnownIndex = true
				break
			}
		}

		if !isKnownIndex {
			return model.NewAppError("Elasticsearch.PurgeIndexList", "ent.elasticsearch.purge_indexes.unknown_index", map[string]any{"unknown_index": index}, "", http.StatusBadRequest)
		}

		indexToDeleteMap[indexPrefix+index] = true
	}

	if ign := *es.Platform.Config().ElasticsearchSettings.IgnoredPurgeIndexes; ign != "" {
		// make sure we're not purging any index configured to be ignored
		for _, ix := range strings.Split(ign, ",") {
			delete(indexToDeleteMap, ix)
		}
	}

	indexToDelete := []string{}
	for key := range indexToDeleteMap {
		indexToDelete = append(indexToDelete, key)
	}

	if len(indexToDelete) > 0 {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()
		_, err := es.client.Indices.Delete(strings.Join(indexToDelete, ",")).Do(ctx)
		if err != nil {
			elasticErr, ok := err.(*types.ElasticsearchError)
			if !ok || elasticErr.Status != http.StatusNotFound {
				rctx.Logger().Error("Elastic Search PurgeIndex Error", mlog.Err(err))
				return model.NewAppError("Elasticsearch.PurgeIndexList", "ent.elasticsearch.purge_index.delete_failed", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) RefreshIndexes(rctx request.CTX) *model.AppError {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()
	_, err := es.client.Indices.Refresh().Do(ctx)
	if err != nil {
		rctx.Logger().Error("Elastic Search RefreshIndexes Error", mlog.Err(err))
		return model.NewAppError("Elasticsearch.RefreshIndexes", "ent.elasticsearch.refresh_indexes.refresh_failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (es *ElasticsearchInterfaceImpl) DataRetentionDeleteIndexes(rctx request.CTX, cutoff time.Time) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if license := es.Platform.License(); license == nil || !*license.Features.Elasticsearch {
		return model.NewAppError("Elasticsearch.DataRetentionDeleteIndexes", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
	}

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DataRetentionDeleteIndexes", "ent.elasticsearch.generic.disabled", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	ctx := context.Background()
	dateFormat := *es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBasePosts + "_2006_01_02"
	postIndexesResult, err := es.client.Indices.Get(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBasePosts + "_*").Do(ctx)
	if err != nil {
		return model.NewAppError("ElasticSearch.DataRetentionDeleteIndexes", "ent.elasticsearch.data_retention_delete_indexes.get_indexes.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
	}
	for index := range postIndexesResult {
		if indexDate, err := time.Parse(dateFormat, index); err != nil {
			rctx.Logger().Warn("Failed to parse date from posts index. Ignoring index.", mlog.String("index", index))
		} else {
			if indexDate.Before(cutoff) || indexDate.Equal(cutoff) {
				if _, err := es.client.Indices.Delete(index).Do(ctx); err != nil {
					return model.NewAppError("ElasticSearch.DataRetentionDeleteIndexes", "ent.elasticsearch.data_retention_delete_indexes.delete_index.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
				}
			}
		}
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) IndexFile(file *model.FileInfo, channelId string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.IndexFile", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	indexName := *es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles

	searchFile := common.ESFileFromFileInfo(file, channelId)

	var err error
	if es.bulkProcessor != nil {
		err = es.bulkProcessor.IndexOp(types.IndexOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(searchFile.Id),
		}, searchFile)
		if err != nil {
			return model.NewAppError("Elasticsearch.IndexFile", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		_, err = es.client.Index(indexName).
			Id(file.Id).
			Document(searchFile).
			Do(ctx)
	}
	if err != nil {
		return model.NewAppError("Elasticsearch.IndexFile", "ent.elasticsearch.index_file.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if metrics := es.Platform.Metrics(); metrics != nil {
		metrics.IncrementFileIndexCounter()
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) SearchFiles(channels model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, *model.AppError) {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return []string{}, model.NewAppError("Elasticsearch.SearchPosts", "ent.elasticsearch.search_files.disabled", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	var channelIds []string
	for _, channel := range channels {
		channelIds = append(channelIds, channel.Id)
	}

	var termQueries, notTermQueries []types.Query
	var filters, notFilters []types.Query
	for i, params := range searchParams {
		newTerms := []string{}
		for _, term := range strings.Split(params.Terms, " ") {
			if searchengine.EmailRegex.MatchString(term) {
				term = `"` + term + `"`
			}
			newTerms = append(newTerms, term)
		}

		params.Terms = strings.Join(newTerms, " ")

		termOperator := operator.And
		if searchParams[0].OrTerms {
			termOperator = operator.Or
		}

		// Date, channels and FromUsers filters come in all
		// searchParams iteration, and as they are global to the
		// query, we only need to process them once
		if i == 0 {
			if len(params.InChannels) > 0 {
				filters = append(filters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"channel_id": params.InChannels}},
				})
			}

			if len(params.ExcludedChannels) > 0 {
				notFilters = append(notFilters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"channel_id": params.ExcludedChannels}},
				})
			}

			if len(params.FromUsers) > 0 {
				filters = append(filters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"creator_id": params.FromUsers}},
				})
			}

			if len(params.ExcludedUsers) > 0 {
				notFilters = append(notFilters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"creator_id": params.ExcludedUsers}},
				})
			}

			if len(params.Extensions) > 0 {
				filters = append(filters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"extension": params.Extensions}},
				})
			}

			if len(params.ExcludedExtensions) > 0 {
				notFilters = append(notFilters, types.Query{
					Terms: &types.TermsQuery{TermsQuery: map[string]types.TermsQueryField{"extension": params.ExcludedExtensions}},
				})
			}

			if params.OnDate != "" {
				before, after := params.GetOnDateMillis()
				filters = append(filters, types.Query{
					Range: map[string]types.RangeQuery{
						"create_at": types.NumberRangeQuery{
							Gte: model.NewPointer(types.Float64(before)),
							Lte: model.NewPointer(types.Float64(after)),
						},
					},
				})
			} else {
				if params.AfterDate != "" || params.BeforeDate != "" {
					nrQuery := types.NumberRangeQuery{}
					if params.AfterDate != "" {
						nrQuery.Gte = model.NewPointer(types.Float64(params.GetAfterDateMillis()))
					}

					if params.BeforeDate != "" {
						nrQuery.Lte = model.NewPointer(types.Float64(params.GetBeforeDateMillis()))
					}
					query := types.Query{
						Range: map[string]types.RangeQuery{
							"create_at": nrQuery,
						},
					}
					filters = append(filters, query)
				}

				if params.ExcludedAfterDate != "" || params.ExcludedBeforeDate != "" || params.ExcludedDate != "" {
					if params.ExcludedDate != "" {
						before, after := params.GetExcludedDateMillis()
						notFilters = append(notFilters, types.Query{
							Range: map[string]types.RangeQuery{
								"create_at": types.NumberRangeQuery{
									Gte: model.NewPointer(types.Float64(before)),
									Lte: model.NewPointer(types.Float64(after)),
								},
							},
						})
					}

					if params.ExcludedAfterDate != "" {
						notFilters = append(notFilters, types.Query{
							Range: map[string]types.RangeQuery{
								"create_at": types.NumberRangeQuery{
									Gte: model.NewPointer(types.Float64(params.GetExcludedAfterDateMillis())),
								},
							},
						})
					}

					if params.ExcludedBeforeDate != "" {
						notFilters = append(notFilters, types.Query{
							Range: map[string]types.RangeQuery{
								"create_at": types.NumberRangeQuery{
									Lte: model.NewPointer(types.Float64(params.GetExcludedBeforeDateMillis())),
								},
							},
						})
					}
				}
			}
		}

		if params.Terms != "" {
			elements := []types.Query{
				{
					SimpleQueryString: &types.SimpleQueryStringQuery{
						Query:           params.Terms,
						Fields:          []string{"content"},
						DefaultOperator: &termOperator,
					},
				}, {
					SimpleQueryString: &types.SimpleQueryStringQuery{
						Query:           params.Terms,
						Fields:          []string{"name"},
						DefaultOperator: &termOperator,
					},
				},
			}
			query := types.Query{
				Bool: &types.BoolQuery{Should: append([]types.Query(nil), elements...)},
			}
			termQueries = append(termQueries, query)
		}

		if params.ExcludedTerms != "" {
			elements := []types.Query{
				{
					SimpleQueryString: &types.SimpleQueryStringQuery{
						Query:           params.ExcludedTerms,
						Fields:          []string{"content"},
						DefaultOperator: &termOperator,
					},
				}, {
					SimpleQueryString: &types.SimpleQueryStringQuery{
						Query:           params.ExcludedTerms,
						Fields:          []string{"name"},
						DefaultOperator: &termOperator,
					},
				},
			}
			query := types.Query{
				Bool: &types.BoolQuery{Should: append([]types.Query(nil), elements...)},
			}
			notTermQueries = append(notTermQueries, query)
		}
	}

	allTermsQuery := &types.BoolQuery{
		MustNot: append([]types.Query(nil), notTermQueries...),
	}
	if searchParams[0].OrTerms {
		allTermsQuery.Should = append([]types.Query(nil), termQueries...)
	} else {
		allTermsQuery.Must = append([]types.Query(nil), termQueries...)
	}

	filters = append(filters,
		types.Query{
			Terms: &types.TermsQuery{
				TermsQuery: map[string]types.TermsQueryField{"channel_id": channelIds},
			},
		},
	)

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter:  append([]types.Query(nil), filters...),
			Must:    []types.Query{{Bool: allTermsQuery}},
			MustNot: append([]types.Query(nil), notFilters...),
		},
	}

	search := es.client.Search().
		Index(common.SearchIndexName(es.Platform.Config().ElasticsearchSettings, common.IndexBaseFiles)).
		Request(&search.Request{
			Query: query,
		}).
		Sort(types.SortOptions{SortOptions: map[string]types.FieldSort{
			"create_at": {Order: &sortorder.Desc},
		}}).
		From(page * perPage).
		Size(perPage)

	searchResult, err := search.Do(ctx)
	if err != nil {
		errorStr := "err=" + err.Error()
		if *es.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return []string{}, model.NewAppError("Elasticsearch.SearchFiles", "ent.elasticsearch.search_files.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	fileIds := make([]string, len(searchResult.Hits.Hits))

	for i, hit := range searchResult.Hits.Hits {
		var file common.ESFile
		if err := json.Unmarshal(hit.Source_, &file); err != nil {
			return fileIds, model.NewAppError("Elasticsearch.SearchFiles", "ent.elasticsearch.search_files.unmarshall_file_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		fileIds[i] = file.Id
	}

	return fileIds, nil
}

func (es *ElasticsearchInterfaceImpl) DeleteFile(fileID string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DeleteFile", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	var err error
	if es.bulkProcessor != nil {
		err = es.bulkProcessor.DeleteOp(types.DeleteOperation{
			Index_: model.NewPointer(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles),
			Id_:    model.NewPointer(fileID),
		})
		if err != nil {
			return model.NewAppError("Elasticsearch.DeleteFile", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		_, err = es.client.Delete(*es.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBaseFiles, fileID).
			Do(ctx)
	}
	if err != nil {
		return model.NewAppError("Elasticsearch.DeleteFile", "ent.elasticsearch.delete_file.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (es *ElasticsearchInterfaceImpl) DeleteUserFiles(rctx request.CTX, userID string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DeleteFilesBatch", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Term: map[string]types.TermQuery{"creator_id": {Value: userID}},
			}},
		},
	}

	deleteQuery := es.client.DeleteByQuery(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles).
		Request(&deletebyquery.Request{
			Query: query,
		})
	response, err := deleteQuery.Do(ctx)
	if err != nil {
		return model.NewAppError("Elasticsearch.DeleteUserFiles", "ent.elasticsearch.delete_user_files.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("User files deleted", mlog.String("user_id", userID), mlog.Int("deleted", *response.Deleted))

	return nil
}

func (es *ElasticsearchInterfaceImpl) DeletePostFiles(rctx request.CTX, postID string) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DeleteFilesBatch", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Term: map[string]types.TermQuery{"post_id": {Value: postID}},
			}},
		},
	}
	deleteQuery := es.client.DeleteByQuery(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles).
		Request(&deletebyquery.Request{
			Query: query,
		})
	response, err := deleteQuery.Do(ctx)
	if err != nil {
		return model.NewAppError("Elasticsearch.DeletePostFiles", "ent.elasticsearch.delete_post_files.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("Post files deleted", mlog.String("post_id", postID), mlog.Int("deleted", *response.Deleted))

	return nil
}

func (es *ElasticsearchInterfaceImpl) DeleteFilesBatch(rctx request.CTX, endTime, limit int64) *model.AppError {
	es.mutex.RLock()
	defer es.mutex.RUnlock()

	if atomic.LoadInt32(&es.ready) == 0 {
		return model.NewAppError("Elasticsearch.DeleteFilesBatch", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*es.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Range: map[string]types.RangeQuery{
					"create_at": types.NumberRangeQuery{
						Lte: model.NewPointer(types.Float64(endTime)),
					},
				},
			}},
		},
	}

	deleteQuery := es.client.DeleteByQuery(*es.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles).
		Request(&deletebyquery.Request{
			Query: query,
		}).
		// Note that max_docs is slightly different than size.
		// Size will just limit the number of elements returned, which is not
		// what we want. We want to limit the number of elements to be deleted.
		MaxDocs(limit)
	response, err := deleteQuery.Do(ctx)
	if err != nil {
		return model.NewAppError("Elasticsearch.DeleteUserPosts", "ent.elasticsearch.delete_user_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("Files batch deleted", mlog.Int("end_time", endTime), mlog.Int("limit", limit), mlog.Int("deleted", *response.Deleted))

	return nil
}

func checkMaxVersion(client *elastic.TypedClient, cfg *model.Config) (string, int, *model.AppError) {
	resp, err := client.API.Core.Info().Do(context.Background())
	if err != nil {
		return "", 0, model.NewAppError("Elasticsearch.checkMaxVersion", "ent.elasticsearch.start.get_server_version.app_error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	major, _, _, esErr := common.GetVersionComponents(resp.Version.Int)
	if esErr != nil {
		return "", 0, model.NewAppError("Elasticsearch.checkMaxVersion", "ent.elasticsearch.start.parse_server_version.app_error", map[string]any{"Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	if major > elasticsearchMaxVersion {
		return "", 0, model.NewAppError("Elasticsearch.checkMaxVersion", "ent.elasticsearch.max_version.app_error", map[string]any{"Version": major, "MaxVersion": elasticsearchMaxVersion, "Backend": model.ElasticsearchSettingsESBackend}, "", http.StatusBadRequest)
	}
	return resp.Version.Int, major, nil
}
