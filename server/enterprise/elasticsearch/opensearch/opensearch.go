// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"bytes"
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

	"github.com/elastic/go-elasticsearch/v8/typedapi/core/deletebyquery"
	"github.com/elastic/go-elasticsearch/v8/typedapi/core/search"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types/enums/highlighterencoder"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types/enums/operator"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types/enums/sortorder"
	"github.com/opensearch-project/opensearch-go/v4"
	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
)

const opensearchMaxVersion = 2

var (
	purgeIndexListAllowedIndexes = []string{common.IndexBaseChannels}
)

type OpensearchInterfaceImpl struct {
	client      *opensearchapi.Client
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

func (*OpensearchInterfaceImpl) UpdateConfig(cfg *model.Config) {
	// Not needed, it uses the `Server` stored internally to get always the last version
}

func (*OpensearchInterfaceImpl) GetName() string {
	return "opensearch"
}

func (os *OpensearchInterfaceImpl) IsEnabled() bool {
	return *os.Platform.Config().ElasticsearchSettings.EnableIndexing
}

func (os *OpensearchInterfaceImpl) IsActive() bool {
	return *os.Platform.Config().ElasticsearchSettings.EnableIndexing && atomic.LoadInt32(&os.ready) == 1
}

func (os *OpensearchInterfaceImpl) IsIndexingEnabled() bool {
	return *os.Platform.Config().ElasticsearchSettings.EnableIndexing
}

func (os *OpensearchInterfaceImpl) IsSearchEnabled() bool {
	return *os.Platform.Config().ElasticsearchSettings.EnableSearching
}

func (os *OpensearchInterfaceImpl) IsAutocompletionEnabled() bool {
	return *os.Platform.Config().ElasticsearchSettings.EnableAutocomplete
}

func (os *OpensearchInterfaceImpl) IsIndexingSync() bool {
	return *os.Platform.Config().ElasticsearchSettings.LiveIndexingBatchSize <= 1
}

func (os *OpensearchInterfaceImpl) Start() *model.AppError {
	if license := os.Platform.License(); license == nil || !*license.Features.Elasticsearch || !*os.Platform.Config().ElasticsearchSettings.EnableIndexing {
		return nil
	}

	os.mutex.Lock()
	defer os.mutex.Unlock()

	if atomic.LoadInt32(&os.ready) != 0 {
		// Elasticsearch is already started. We don't return an error
		// because "Test Connection" already re-initializes the client. So this
		// can be a valid scenario.
		return nil
	}

	var appErr *model.AppError
	if os.client, appErr = createClient(os.Platform.Log(), os.Platform.Config(), os.Platform.FileBackend(), true); appErr != nil {
		return appErr
	}

	version, major, appErr := checkMaxVersion(os.client)
	if appErr != nil {
		return appErr
	}

	// Since we are only retrieving plugins for the Support Packet generation, it doesn't make sense to kill the process if we get an error
	// Instead, we will log it and move forward
	resp, err := os.client.Cat.Plugins(context.Background(), nil)
	if err != nil {
		os.Platform.Log().Warn("Error retrieving opensearch plugins", mlog.Err(err))
	} else {
		for _, p := range resp.Plugins {
			os.plugins = append(os.plugins, p.Component)
		}
	}

	os.version = major
	os.fullVersion = version

	ctx := context.Background()

	if *os.Platform.Config().ElasticsearchSettings.LiveIndexingBatchSize > 1 {
		os.bulkProcessor = NewBulk(os.Platform.Config().ElasticsearchSettings,
			os.Platform.Log(),
			os.client)
	}

	// Set up posts index template.
	templateBuf, err := json.Marshal(common.GetPostTemplate(os.Platform.Config()))
	if err != nil {
		return model.NewAppError("Opensearch.start", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	_, err = os.client.IndexTemplate.Create(ctx, opensearchapi.IndexTemplateCreateReq{
		IndexTemplate: *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBasePosts,
		Body:          bytes.NewReader(templateBuf),
	})
	if err != nil {
		return model.NewAppError("Opensearch.start", "ent.elasticsearch.create_template_posts_if_not_exists.template_create_failed", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	// Set up channels index template.
	templateBuf, err = json.Marshal(common.GetChannelTemplate(os.Platform.Config()))
	if err != nil {
		return model.NewAppError("Opensearch.start", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	_, err = os.client.IndexTemplate.Create(ctx, opensearchapi.IndexTemplateCreateReq{
		IndexTemplate: *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseChannels,
		Body:          bytes.NewReader(templateBuf),
	})
	if err != nil {
		return model.NewAppError("Opensearch.start", "ent.elasticsearch.create_template_channels_if_not_exists.template_create_failed", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	// Set up users index template.
	templateBuf, err = json.Marshal(common.GetUserTemplate(os.Platform.Config()))
	if err != nil {
		return model.NewAppError("Opensearch.start", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	_, err = os.client.IndexTemplate.Create(ctx, opensearchapi.IndexTemplateCreateReq{
		IndexTemplate: *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseUsers,
		Body:          bytes.NewReader(templateBuf),
	})
	if err != nil {
		return model.NewAppError("Opensearch.start", "ent.elasticsearch.create_template_users_if_not_exists.template_create_failed", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	// Set up files index template.
	templateBuf, err = json.Marshal(common.GetFileInfoTemplate(os.Platform.Config()))
	if err != nil {
		return model.NewAppError("Opensearch.start", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	_, err = os.client.IndexTemplate.Create(ctx, opensearchapi.IndexTemplateCreateReq{
		IndexTemplate: *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles,
		Body:          bytes.NewReader(templateBuf),
	})
	if err != nil {
		return model.NewAppError("Opensearch.start", "ent.elasticsearch.create_template_file_info_if_not_exists.template_create_failed", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	atomic.StoreInt32(&os.ready, 1)

	return nil
}

func (os *OpensearchInterfaceImpl) Stop() *model.AppError {
	os.mutex.Lock()
	defer os.mutex.Unlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.start", "ent.elasticsearch.stop.already_stopped.app_error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	// Flushing any pending requests
	if os.bulkProcessor != nil {
		if err := os.bulkProcessor.Stop(); err != nil {
			os.Platform.Log().Warn("Error stopping bulk processor", mlog.Err(err))
		}
		os.bulkProcessor = nil
	}

	os.client = nil
	atomic.StoreInt32(&os.ready, 0)

	return nil
}

func (os *OpensearchInterfaceImpl) GetVersion() int {
	return os.version
}

func (os *OpensearchInterfaceImpl) GetFullVersion() string {
	return os.fullVersion
}

func (os *OpensearchInterfaceImpl) GetPlugins() []string {
	return os.plugins
}

func (os *OpensearchInterfaceImpl) IndexPost(post *model.Post, teamId string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.IndexPost", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	indexName := common.BuildPostIndexName(*os.Platform.Config().ElasticsearchSettings.AggregatePostsAfterDays,
		*os.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts, *os.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts_MONTH, time.Now(), post.CreateAt)

	searchPost, err := common.ESPostFromPost(post, teamId)
	if err != nil {
		return model.NewAppError("Opensearch.IndexPost", "ent.elasticsearch.index_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var postBuf []byte
	if os.bulkProcessor != nil {
		err = os.bulkProcessor.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(searchPost.Id),
		}, searchPost)
		if err != nil {
			return model.NewAppError("Opensearch.IndexPost", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		postBuf, err = json.Marshal(searchPost)
		if err != nil {
			return model.NewAppError("Opensearch.start", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		_, err = os.client.Index(ctx, opensearchapi.IndexReq{
			Index:      indexName,
			DocumentID: post.Id,
			Body:       bytes.NewReader(postBuf),
		})
	}
	if err != nil {
		return model.NewAppError("Opensearch.IndexPost", "ent.elasticsearch.index_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	metrics := os.Platform.Metrics()
	if metrics != nil {
		metrics.IncrementPostIndexCounter()
	}

	return nil
}

func (os *OpensearchInterfaceImpl) getPostIndexNames() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	indexes, err := os.client.Indices.Get(ctx, opensearchapi.IndicesGetReq{
		Indices: []string{"_all"},
	})
	if err != nil {
		return nil, err
	}
	postIndexes := make([]string, 0)
	for name := range indexes.Indices {
		if strings.HasPrefix(name, *os.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts) {
			postIndexes = append(postIndexes, name)
		}
	}
	return postIndexes, nil
}

func (os *OpensearchInterfaceImpl) SearchPosts(channels model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError) {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return []string{}, nil, model.NewAppError("Opensearch.SearchPosts", "ent.elasticsearch.search_posts.disabled", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
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

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter:  append([]types.Query(nil), filters...),
			Must:    []types.Query{{Bool: allTermsQuery}},
			MustNot: append([]types.Query(nil), notFilters...),
		},
	}

	searchBuf, err := json.Marshal(search.Request{
		Query:     query,
		Highlight: highlight,
		Sort: []types.SortCombinations{types.SortOptions{
			SortOptions: map[string]types.FieldSort{"create_at": {Order: &sortorder.Desc}},
		}},
	})
	if err != nil {
		return []string{}, nil, model.NewAppError("Opensearch.SearchPosts", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// We need to declare the response structs because
	// OS client doesn't have the highlight field in the struct.
	type SearchHit struct {
		Index     string              `json:"_index"`
		ID        string              `json:"_id"`
		Score     float32             `json:"_score"`
		Source    json.RawMessage     `json:"_source"`
		Fields    json.RawMessage     `json:"fields"`
		Type      string              `json:"_type"` // Deprecated field
		Sort      []any               `json:"sort"`
		Highlight map[string][]string `json:"highlight,omitempty"`
	}

	type searchResp struct {
		Took    int  `json:"took"`
		Timeout bool `json:"timed_out"`
		Hits    struct {
			Total struct {
				Value    int    `json:"value"`
				Relation string `json:"relation"`
			} `json:"total"`
			MaxScore float32     `json:"max_score"`
			Hits     []SearchHit `json:"hits"`
		} `json:"hits"`
		Errors bool `json:"errors"`
	}

	var searchResult searchResp
	_, err = os.client.Client.Do(ctx, &opensearchapi.SearchReq{
		Indices: []string{common.SearchIndexName(os.Platform.Config().ElasticsearchSettings, common.IndexBasePosts+"*")},
		Body:    bytes.NewReader(searchBuf),
		Params: opensearchapi.SearchParams{
			From: model.NewPointer(page * perPage),
			Size: model.NewPointer(perPage),
		},
	}, &searchResult)
	if err != nil {
		errorStr := "err=" + err.Error()
		if *os.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return []string{}, nil, model.NewAppError("Opensearch.SearchPosts", "ent.elasticsearch.search_posts.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	postIds := make([]string, len(searchResult.Hits.Hits))
	matches := make(model.PostSearchMatches, len(searchResult.Hits.Hits))

	for i, hit := range searchResult.Hits.Hits {
		var post common.ESPost
		err := json.Unmarshal(hit.Source, &post)
		if err != nil {
			return postIds, matches, model.NewAppError("Opensearch.SearchPosts", "ent.elasticsearch.search_posts.unmarshall_post_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		postIds[i] = post.Id

		matchesForPost, err := common.GetMatchesForHit(hit.Highlight)
		if err != nil {
			return postIds, matches, model.NewAppError("Opensearch.SearchPosts", "ent.elasticsearch.search_posts.parse_matches_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		matches[post.Id] = matchesForPost
	}

	return postIds, matches, nil
}

func (os *OpensearchInterfaceImpl) DeletePost(post *model.Post) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DeletePost", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	// This is racy with index aggregation, but since the posts are verified in the database when returning search
	// results, there's no risk of deleted posts getting sent back to the user in response to a search query, and even
	// then the race is very unlikely because it would only occur when someone deletes a post that's due to be
	// aggregated but hasn't been yet, which makes the time window small and the post likelihood very low.
	indexName := common.BuildPostIndexName(*os.Platform.Config().ElasticsearchSettings.AggregatePostsAfterDays,
		*os.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts, *os.Platform.Config().ElasticsearchSettings.IndexPrefix+common.IndexBasePosts_MONTH, time.Now(), post.CreateAt)

	if err := os.deletePost(indexName, post.Id); err != nil {
		return err
	}

	return nil
}

func (os *OpensearchInterfaceImpl) DeleteChannelPosts(rctx request.CTX, channelID string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DeleteChannelPosts", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	postIndexes, err := os.getPostIndexNames()
	if err != nil {
		return model.NewAppError("Opensearch.DeleteChannelPosts", "ent.elasticsearch.delete_channel_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Term: map[string]types.TermQuery{"channel_id": {Value: channelID}},
			}},
		},
	}
	queryBuf, err := json.Marshal(deletebyquery.Request{
		Query: query,
	})
	if err != nil {
		return model.NewAppError("Opensearch.SearchPosts", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	response, err := os.client.Document.DeleteByQuery(ctx, opensearchapi.DocumentDeleteByQueryReq{
		Indices: postIndexes,
		Body:    bytes.NewReader(queryBuf),
	})
	if err != nil {
		return model.NewAppError("Opensearch.DeleteChannelPosts", "ent.elasticsearch.delete_channel_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("Posts for channel deleted", mlog.String("channel_id", channelID), mlog.Int("deleted", response.Deleted))

	return nil
}

func (os *OpensearchInterfaceImpl) DeleteUserPosts(rctx request.CTX, userID string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DeleteUserPosts", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	postIndexes, err := os.getPostIndexNames()
	if err != nil {
		return model.NewAppError("Opensearch.DeleteUserPosts", "ent.elasticsearch.delete_user_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Term: map[string]types.TermQuery{"user_id": {Value: userID}},
			}},
		},
	}

	queryBuf, err := json.Marshal(deletebyquery.Request{
		Query: query,
	})
	if err != nil {
		return model.NewAppError("Opensearch.SearchPosts", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	response, err := os.client.Document.DeleteByQuery(ctx, opensearchapi.DocumentDeleteByQueryReq{
		Indices: postIndexes,
		Body:    bytes.NewReader(queryBuf),
	})
	if err != nil {
		return model.NewAppError("Opensearch.DeleteUserPosts", "ent.elasticsearch.delete_user_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("Posts for user deleted", mlog.String("user_id", userID), mlog.Int("deleted", response.Deleted))

	return nil
}

func (os *OpensearchInterfaceImpl) deletePost(indexName, postID string) *model.AppError {
	var err error
	if os.bulkProcessor != nil {
		err = os.bulkProcessor.DeleteOp(&types.DeleteOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(postID),
		})
		if err != nil {
			return model.NewAppError("Opensearch.IndexPost", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()
		_, err = os.client.Document.Delete(ctx, opensearchapi.DocumentDeleteReq{
			Index:      indexName,
			DocumentID: postID,
		})
	}
	if err != nil {
		return model.NewAppError("Opensearch.DeletePost", "ent.elasticsearch.delete_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (os *OpensearchInterfaceImpl) IndexChannel(rctx request.CTX, channel *model.Channel, userIDs, teamMemberIDs []string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.IndexChannel", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	indexName := *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseChannels

	searchChannel := common.ESChannelFromChannel(channel, userIDs, teamMemberIDs)

	var err error
	var buf []byte
	if os.bulkProcessor != nil {
		err = os.bulkProcessor.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(searchChannel.Id),
		}, searchChannel)
		if err != nil {
			return model.NewAppError("Opensearch.IndexChannel", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()
		buf, err = json.Marshal(searchChannel)
		if err != nil {
			return model.NewAppError("Opensearch.IndexChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		_, err = os.client.Index(ctx, opensearchapi.IndexReq{
			Index:      indexName,
			DocumentID: searchChannel.Id,
			Body:       bytes.NewReader(buf),
		})
	}
	if err != nil {
		return model.NewAppError("Opensearch.IndexChannel", "ent.elasticsearch.index_channel.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	metrics := os.Platform.Metrics()
	if metrics != nil {
		metrics.IncrementChannelIndexCounter()
	}

	return nil
}

func (os *OpensearchInterfaceImpl) SearchChannels(teamId, userID string, term string, isGuest, includeDeleted bool) ([]string, *model.AppError) {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return []string{}, model.NewAppError("Opensearch.SearchChannels", "ent.elasticsearch.search_channels.disabled", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
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

	buf, err := json.Marshal(search.Request{
		Query: &types.Query{Bool: query},
	})
	if err != nil {
		return []string{}, model.NewAppError("Opensearch.SearchChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	searchResult, err := os.client.Search(ctx, &opensearchapi.SearchReq{
		Indices: []string{common.SearchIndexName(os.Platform.Config().ElasticsearchSettings, common.IndexBaseChannels)},
		Body:    bytes.NewReader(buf),
		Params: opensearchapi.SearchParams{
			Size: model.NewPointer(model.ChannelSearchDefaultLimit),
		},
	})
	if err != nil {
		errorStr := "err=" + err.Error()
		if *os.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return nil, model.NewAppError("Opensearch.SearchChannels", "ent.elasticsearch.search_channels.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	channelIds := []string{}
	for _, hit := range searchResult.Hits.Hits {
		var channel common.ESChannel
		err := json.Unmarshal(hit.Source, &channel)
		if err != nil {
			return nil, model.NewAppError("Opensearch.SearchChannels", "ent.elasticsearch.search_channels.unmarshall_channel_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		channelIds = append(channelIds, channel.Id)
	}

	return channelIds, nil
}

func (os *OpensearchInterfaceImpl) DeleteChannel(channel *model.Channel) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DeleteChannel", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	var err error
	if os.bulkProcessor != nil {
		err = os.bulkProcessor.DeleteOp(&types.DeleteOperation{
			Index_: model.NewPointer(*os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseChannels),
			Id_:    model.NewPointer(channel.Id),
		})
		if err != nil {
			return model.NewAppError("Opensearch.IndexPost", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		_, err = os.client.Document.Delete(ctx, opensearchapi.DocumentDeleteReq{
			Index:      *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseChannels,
			DocumentID: channel.Id,
		})
	}
	if err != nil {
		return model.NewAppError("Opensearch.DeleteChannel", "ent.elasticsearch.delete_channel.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (os *OpensearchInterfaceImpl) IndexUser(rctx request.CTX, user *model.User, teamsIds, channelsIds []string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.IndexUser", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	indexName := *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseUsers

	searchUser := common.ESUserFromUserAndTeams(user, teamsIds, channelsIds)

	var err error
	var buf []byte
	if os.bulkProcessor != nil {
		err = os.bulkProcessor.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(searchUser.Id),
		}, searchUser)
		if err != nil {
			return model.NewAppError("Opensearch.IndexUser", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		buf, err = json.Marshal(searchUser)
		if err != nil {
			return model.NewAppError("Opensearch.IndexUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		_, err = os.client.Index(ctx, opensearchapi.IndexReq{
			Index:      indexName,
			DocumentID: searchUser.Id,
			Body:       bytes.NewReader(buf),
		})
	}
	if err != nil {
		return model.NewAppError("Opensearch.IndexUser", "ent.elasticsearch.index_user.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	metrics := os.Platform.Metrics()
	if metrics != nil {
		metrics.IncrementUserIndexCounter()
	}

	return nil
}

func (os *OpensearchInterfaceImpl) autocompleteUsers(contextCategory string, categoryIds []string, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return nil, model.NewAppError("Opensearch.autocompleteUsers", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
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

	buf, err := json.Marshal(search.Request{
		Query: &types.Query{Bool: query},
	})
	if err != nil {
		return nil, model.NewAppError("Opensearch.autocompleteUsers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	searchResults, err := os.client.Search(ctx, &opensearchapi.SearchReq{
		Indices: []string{common.SearchIndexName(os.Platform.Config().ElasticsearchSettings, common.IndexBaseUsers)},
		Body:    bytes.NewReader(buf),
		Params: opensearchapi.SearchParams{
			Size: model.NewPointer(options.Limit),
		},
	})

	if err != nil {
		errorStr := "err=" + err.Error()
		if *os.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return nil, model.NewAppError("Opensearch.autocompleteUsers", "ent.elasticsearch.search_users.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	users := []common.ESUser{}
	for _, hit := range searchResults.Hits.Hits {
		var user common.ESUser
		err := json.Unmarshal(hit.Source, &user)
		if err != nil {
			return nil, model.NewAppError("Opensearch.autocompleteUsers", "ent.elasticsearch.search_users.unmarshall_user_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		users = append(users, user)
	}

	return users, nil
}

func (os *OpensearchInterfaceImpl) autocompleteUsersInChannel(channelId, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	return os.autocompleteUsers("channel_id", []string{channelId}, term, options)
}

func (os *OpensearchInterfaceImpl) autocompleteUsersInChannels(channelIds []string, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	return os.autocompleteUsers("channel_id", channelIds, term, options)
}

func (os *OpensearchInterfaceImpl) autocompleteUsersInTeam(teamId, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	return os.autocompleteUsers("team_id", []string{teamId}, term, options)
}

func (os *OpensearchInterfaceImpl) autocompleteUsersNotInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]common.ESUser, *model.AppError) {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return nil, model.NewAppError("Opensearch.autocompleteUsersNotInChannel", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
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

	buf, err := json.Marshal(search.Request{
		Query: &types.Query{Bool: query},
	})
	if err != nil {
		return nil, model.NewAppError("Opensearch.autocompleteUsersNotInChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	searchResults, err := os.client.Search(ctx, &opensearchapi.SearchReq{
		Indices: []string{common.SearchIndexName(os.Platform.Config().ElasticsearchSettings, common.IndexBaseUsers)},
		Body:    bytes.NewReader(buf),
		Params: opensearchapi.SearchParams{
			Size: model.NewPointer(options.Limit),
		},
	})
	if err != nil {
		errorStr := "err=" + err.Error()
		if *os.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return nil, model.NewAppError("Opensearch.autocompleteUsersNotInChannel", "ent.elasticsearch.search_users.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	users := []common.ESUser{}
	for _, hit := range searchResults.Hits.Hits {
		var user common.ESUser
		err := json.Unmarshal(hit.Source, &user)
		if err != nil {
			return nil, model.NewAppError("Opensearch.autocompleteUsersNotInChannel", "ent.elasticsearch.search_users.unmarshall_user_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		users = append(users, user)
	}

	return users, nil
}

func (os *OpensearchInterfaceImpl) SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError) {
	if restrictedToChannels != nil && len(restrictedToChannels) == 0 {
		return []string{}, []string{}, nil
	}

	uchan, err := os.autocompleteUsersInChannel(channelId, term, options)
	if err != nil {
		return nil, nil, err
	}

	var nuchan []common.ESUser
	nuchan, err = os.autocompleteUsersNotInChannel(teamId, channelId, restrictedToChannels, term, options)
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

func (os *OpensearchInterfaceImpl) SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError) {
	if restrictedToChannels != nil && len(restrictedToChannels) == 0 {
		return []string{}, nil
	}

	var users []common.ESUser
	var err *model.AppError
	if restrictedToChannels == nil {
		users, err = os.autocompleteUsersInTeam(teamId, term, options)
	} else {
		users, err = os.autocompleteUsersInChannels(restrictedToChannels, term, options)
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

func (os *OpensearchInterfaceImpl) DeleteUser(user *model.User) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DeleteUser", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	var err error
	if os.bulkProcessor != nil {
		err = os.bulkProcessor.DeleteOp(&types.DeleteOperation{
			Index_: model.NewPointer(*os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseUsers),
			Id_:    model.NewPointer(user.Id),
		})
		if err != nil {
			return model.NewAppError("Opensearch.DeleteUser", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		_, err = os.client.Document.Delete(ctx, opensearchapi.DocumentDeleteReq{
			Index:      *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseUsers,
			DocumentID: user.Id,
		})
	}
	if err != nil {
		return model.NewAppError("Opensearch.DeleteUser", "ent.elasticsearch.delete_user.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (os *OpensearchInterfaceImpl) TestConfig(rctx request.CTX, cfg *model.Config) *model.AppError {
	if license := os.Platform.License(); license == nil || !*license.Features.Elasticsearch {
		return model.NewAppError("Opensearch.TestConfig", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
	}

	if !*cfg.ElasticsearchSettings.EnableIndexing {
		return model.NewAppError("Opensearch.TestConfig", "ent.elasticsearch.test_config.indexing_disabled.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusNotImplemented)
	}

	client, appErr := createClient(rctx.Logger(), cfg, os.Platform.FileBackend(), true)
	if appErr != nil {
		return appErr
	}

	_, _, appErr = checkMaxVersion(client)
	if appErr != nil {
		return appErr
	}

	// Resetting the state.
	if atomic.CompareAndSwapInt32(&os.ready, 0, 1) {
		// Re-assign the client.
		// This is necessary in case opensearch was started
		// after server start.
		os.mutex.Lock()
		os.client = client
		os.mutex.Unlock()
	}

	return nil
}

func (os *OpensearchInterfaceImpl) PurgeIndexes(rctx request.CTX) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if license := os.Platform.License(); license == nil || !*license.Features.Elasticsearch {
		return model.NewAppError("Opensearch.PurgeIndexes", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
	}

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.PurgeIndexes", "ent.elasticsearch.generic.disabled", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	indexPrefix := *os.Platform.Config().ElasticsearchSettings.IndexPrefix
	indexesToDelete := []string{indexPrefix + "*"}

	if ignorePurgeIndexes := *os.Platform.Config().ElasticsearchSettings.IgnoredPurgeIndexes; ignorePurgeIndexes != "" {
		// we are checking if provided indexes exist. If an index doesn't exist,
		// opensearch returns an error while trying to purge it even we intend to
		// ignore it.
		for _, ignorePurgeIndex := range strings.Split(ignorePurgeIndexes, ",") {
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
			defer cancel()

			_, err := os.client.Indices.Get(ctx, opensearchapi.IndicesGetReq{
				Indices: []string{ignorePurgeIndex},
			})
			if err != nil {
				rctx.Logger().Warn("Opensearch index get error", mlog.String("index", ignorePurgeIndex), mlog.Err(err))
				continue
			}
			indexesToDelete = append(indexesToDelete, "-"+strings.TrimSpace(ignorePurgeIndex))
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	_, err := os.client.Indices.Delete(ctx, opensearchapi.IndicesDeleteReq{
		Indices: indexesToDelete,
	})
	if err != nil {
		rctx.Logger().Error("Opensearch PurgeIndexes Error", mlog.Err(err))
		return model.NewAppError("Opensearch.PurgeIndexes", "ent.elasticsearch.purge_index.delete_failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// PurgeIndexList purges a list of specified indexes.
// For now it only allows purging the channels index as thats all that's needed,
// but the code is written in generic fashion to allow it to purge any index.
// It needs more logic around post indexes as their name isn't the same, but rather follow a pattern
// containing the date as well.
func (os *OpensearchInterfaceImpl) PurgeIndexList(rctx request.CTX, indexes []string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if license := os.Platform.License(); license == nil || !*license.Features.Elasticsearch {
		return model.NewAppError("Opensearch.PurgeIndexList", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
	}

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.PurgeIndexList", "ent.elasticsearch.generic.disabled", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	indexPrefix := *os.Platform.Config().ElasticsearchSettings.IndexPrefix
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
			return model.NewAppError("Opensearch.PurgeIndexList", "ent.elasticsearch.purge_indexes.unknown_index", map[string]any{"unknown_index": index}, "", http.StatusBadRequest)
		}

		indexToDeleteMap[indexPrefix+index] = true
	}

	if ign := *os.Platform.Config().ElasticsearchSettings.IgnoredPurgeIndexes; ign != "" {
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
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()
		_, err := os.client.Indices.Delete(ctx, opensearchapi.IndicesDeleteReq{
			Indices: indexToDelete,
		})
		if err != nil {
			openErr, ok := err.(*opensearch.StructError)
			if !ok || openErr.Status != http.StatusNotFound {
				rctx.Logger().Error("Opensearch PurgeIndex Error", mlog.Err(err))
				return model.NewAppError("Opensearch.PurgeIndexList", "ent.elasticsearch.purge_index.delete_failed", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	return nil
}

func (os *OpensearchInterfaceImpl) RefreshIndexes(rctx request.CTX) *model.AppError {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()
	_, err := os.client.Indices.Refresh(ctx, nil)
	if err != nil {
		rctx.Logger().Error("Opensearch RefreshIndexes Error", mlog.Err(err))
		return model.NewAppError("Opensearch.RefreshIndexes", "ent.elasticsearch.refresh_indexes.refresh_failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (os *OpensearchInterfaceImpl) DataRetentionDeleteIndexes(rctx request.CTX, cutoff time.Time) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if license := os.Platform.License(); license == nil || !*license.Features.Elasticsearch {
		return model.NewAppError("Opensearch.DataRetentionDeleteIndexes", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
	}

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DataRetentionDeleteIndexes", "ent.elasticsearch.generic.disabled", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	ctx := context.Background()
	dateFormat := *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBasePosts + "_2006_01_02"
	postIndexesResult, err := os.client.Indices.Get(ctx, opensearchapi.IndicesGetReq{
		Indices: []string{*os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBasePosts + "_*"},
	})
	if err != nil {
		return model.NewAppError("Opensearch.DataRetentionDeleteIndexes", "ent.elasticsearch.data_retention_delete_indexes.get_indexes.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}
	for index := range postIndexesResult.Indices {
		if indexDate, err := time.Parse(dateFormat, index); err != nil {
			rctx.Logger().Warn("Failed to parse date from posts index. Ignoring index.", mlog.String("index", index))
		} else {
			if indexDate.Before(cutoff) || indexDate.Equal(cutoff) {
				if _, err := os.client.Indices.Delete(ctx, opensearchapi.IndicesDeleteReq{
					Indices: []string{index},
				}); err != nil {
					return model.NewAppError("Opensearch.DataRetentionDeleteIndexes", "ent.elasticsearch.data_retention_delete_indexes.delete_index.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
				}
			}
		}
	}

	return nil
}

func (os *OpensearchInterfaceImpl) IndexFile(file *model.FileInfo, channelId string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.IndexFile", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	indexName := *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles

	searchFile := common.ESFileFromFileInfo(file, channelId)

	var err error
	var fileBuf []byte
	if os.bulkProcessor != nil {
		err = os.bulkProcessor.IndexOp(&types.IndexOperation{
			Index_: model.NewPointer(indexName),
			Id_:    model.NewPointer(searchFile.Id),
		}, searchFile)
		if err != nil {
			return model.NewAppError("Opensearch.IndexFile", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		fileBuf, err = json.Marshal(searchFile)
		if err != nil {
			return model.NewAppError("Opensearch.SearchPosts", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		_, err = os.client.Index(ctx, opensearchapi.IndexReq{
			Index:      indexName,
			DocumentID: file.Id,
			Body:       bytes.NewReader(fileBuf),
		})
	}
	if err != nil {
		return model.NewAppError("Opensearch.IndexFile", "ent.elasticsearch.index_file.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if metrics := os.Platform.Metrics(); metrics != nil {
		metrics.IncrementFileIndexCounter()
	}

	return nil
}

func (os *OpensearchInterfaceImpl) SearchFiles(channels model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, *model.AppError) {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return []string{}, model.NewAppError("Opensearch.SearchPosts", "ent.elasticsearch.search_files.disabled", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
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

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter:  append([]types.Query(nil), filters...),
			Must:    []types.Query{{Bool: allTermsQuery}},
			MustNot: append([]types.Query(nil), notFilters...),
		},
	}

	searchBuf, err := json.Marshal(search.Request{
		Query: query,
		Sort: []types.SortCombinations{types.SortOptions{
			SortOptions: map[string]types.FieldSort{"create_at": {Order: &sortorder.Desc}},
		}},
	})
	if err != nil {
		return []string{}, model.NewAppError("Opensearch.SearchFiles", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	searchResult, err := os.client.Search(ctx, &opensearchapi.SearchReq{
		Indices: []string{common.SearchIndexName(os.Platform.Config().ElasticsearchSettings, common.IndexBaseFiles)},
		Body:    bytes.NewReader(searchBuf),
		Params: opensearchapi.SearchParams{
			From: model.NewPointer(page * perPage),
			Size: model.NewPointer(perPage),
		},
	})
	if err != nil {
		errorStr := "err=" + err.Error()
		if *os.Platform.Config().ElasticsearchSettings.Trace == "error" {
			errorStr = "Query=" + getJSONOrErrorStr(query) + ", " + errorStr
		}
		return []string{}, model.NewAppError("Opensearch.SearchFiles", "ent.elasticsearch.search_files.search_failed", nil, errorStr, http.StatusInternalServerError)
	}

	fileIds := make([]string, len(searchResult.Hits.Hits))

	for i, hit := range searchResult.Hits.Hits {
		var file common.ESFile
		if err := json.Unmarshal(hit.Source, &file); err != nil {
			return fileIds, model.NewAppError("Opensearch.SearchFiles", "ent.elasticsearch.search_files.unmarshall_file_failed", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		fileIds[i] = file.Id
	}

	return fileIds, nil
}

func (os *OpensearchInterfaceImpl) DeleteFile(fileID string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DeleteFile", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	var err error
	if os.bulkProcessor != nil {
		err = os.bulkProcessor.DeleteOp(&types.DeleteOperation{
			Index_: model.NewPointer(*os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles),
			Id_:    model.NewPointer(fileID),
		})
		if err != nil {
			return model.NewAppError("Opensearch.DeleteFile", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
		defer cancel()

		_, err = os.client.Document.Delete(ctx, opensearchapi.DocumentDeleteReq{
			Index:      *os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles,
			DocumentID: fileID,
		})
	}
	if err != nil {
		return model.NewAppError("Opensearch.DeleteFile", "ent.elasticsearch.delete_file.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (os *OpensearchInterfaceImpl) DeleteUserFiles(rctx request.CTX, userID string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DeleteFilesBatch", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Term: map[string]types.TermQuery{"creator_id": {Value: userID}},
			}},
		},
	}

	queryBuf, err := json.Marshal(deletebyquery.Request{
		Query: query,
	})
	if err != nil {
		return model.NewAppError("Opensearch.DeleteUserFiles", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	response, err := os.client.Document.DeleteByQuery(ctx, opensearchapi.DocumentDeleteByQueryReq{
		Indices: []string{*os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles},
		Body:    bytes.NewReader(queryBuf),
	})
	if err != nil {
		return model.NewAppError("Opensearch.DeleteUserFiles", "ent.elasticsearch.delete_user_files.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("User files deleted", mlog.String("user_id", userID), mlog.Int("deleted", response.Deleted))

	return nil
}

func (os *OpensearchInterfaceImpl) DeletePostFiles(rctx request.CTX, postID string) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DeleteFilesBatch", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	query := &types.Query{
		Bool: &types.BoolQuery{
			Filter: []types.Query{{
				Term: map[string]types.TermQuery{"post_id": {Value: postID}},
			}},
		},
	}
	queryBuf, err := json.Marshal(deletebyquery.Request{
		Query: query,
	})
	if err != nil {
		return model.NewAppError("Opensearch.DeletePostFiles", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	response, err := os.client.Document.DeleteByQuery(ctx, opensearchapi.DocumentDeleteByQueryReq{
		Indices: []string{*os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles},
		Body:    bytes.NewReader(queryBuf),
	})
	if err != nil {
		return model.NewAppError("Opensearch.DeletePostFiles", "ent.elasticsearch.delete_post_files.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("Post files deleted", mlog.String("post_id", postID), mlog.Int("deleted", response.Deleted))

	return nil
}

func (os *OpensearchInterfaceImpl) DeleteFilesBatch(rctx request.CTX, endTime, limit int64) *model.AppError {
	os.mutex.RLock()
	defer os.mutex.RUnlock()

	if atomic.LoadInt32(&os.ready) == 0 {
		return model.NewAppError("Opensearch.DeleteFilesBatch", "ent.elasticsearch.not_started.error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*os.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
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

	queryBuf, err := json.Marshal(deletebyquery.Request{
		Query: query,
	})
	if err != nil {
		return model.NewAppError("Opensearch.DeleteUserFiles", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	response, err := os.client.Document.DeleteByQuery(ctx, opensearchapi.DocumentDeleteByQueryReq{
		Indices: []string{*os.Platform.Config().ElasticsearchSettings.IndexPrefix + common.IndexBaseFiles},
		Body:    bytes.NewReader(queryBuf),
		Params: opensearchapi.DocumentDeleteByQueryParams{
			// Note that max_docs is slightly different than size.
			// Size will just limit the number of elements returned, which is not
			// what we want. We want to limit the number of elements to be deleted.
			MaxDocs: model.NewPointer(int(limit)),
		},
	})
	if err != nil {
		return model.NewAppError("Opensearch.DeleteUserPosts", "ent.elasticsearch.delete_user_posts.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	rctx.Logger().Info("Files batch deleted", mlog.Int("end_time", endTime), mlog.Int("limit", limit), mlog.Int("deleted", response.Deleted))

	return nil
}

func checkMaxVersion(client *opensearchapi.Client) (string, int, *model.AppError) {
	resp, err := client.Info(context.Background(), nil)
	if err != nil {
		return "", 0, model.NewAppError("Opensearch.checkMaxVersion", "ent.elasticsearch.start.get_server_version.app_error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	major, _, _, esErr := common.GetVersionComponents(resp.Version.Number)
	if esErr != nil {
		return "", 0, model.NewAppError("Opensearch.checkMaxVersion", "ent.elasticsearch.start.parse_server_version.app_error", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	if major > opensearchMaxVersion {
		return "", 0, model.NewAppError("Opensearch.checkMaxVersion", "ent.elasticsearch.max_version.app_error", map[string]any{"Version": major, "MaxVersion": opensearchMaxVersion, "Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusBadRequest)
	}
	return resp.Version.Number, major, nil
}
