// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"strconv"

	"github.com/elastic/go-elasticsearch/v8/typedapi/indices/putindextemplate"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/model"
)

func GetPostTemplate(cfg *model.Config) *putindextemplate.Request {
	mappings := &types.TypeMapping{
		Properties: map[string]types.Property{
			"message": types.TextProperty{
				Analyzer: model.NewPointer("mm_lowercaser"),
				Type:     "text",
			},
			"attachments": types.TextProperty{
				Analyzer: model.NewPointer("mm_lowercaser"),
				Type:     "text",
			},
			"urls": types.TextProperty{
				Analyzer: model.NewPointer("mm_url"),
				Type:     "text",
			},
			"hashtags": types.KeywordProperty{
				Type:       "keyword",
				Normalizer: model.NewPointer("mm_hashtag"),
				Store:      model.NewPointer(true),
			},
		},
	}

	return &putindextemplate.Request{
		IndexPatterns: []string{*cfg.ElasticsearchSettings.IndexPrefix + IndexBasePosts + "*"},
		Template: &types.IndexTemplateMapping{
			Settings: &types.IndexSettings{
				Index: &types.IndexSettings{
					NumberOfShards:   strconv.Itoa(*cfg.ElasticsearchSettings.PostIndexShards),
					NumberOfReplicas: strconv.Itoa(*cfg.ElasticsearchSettings.PostIndexReplicas),
				},
				Analysis: &types.IndexSettingsAnalysis{
					CharFilter: map[string]types.CharFilter{
						"leading_underscores": map[string]any{
							"type":        "pattern_replace",
							"pattern":     `(^|[\s\r\n])_`,
							"replacement": "$1",
						},
						"trailing_underscores": map[string]any{
							"type":        "pattern_replace",
							"pattern":     `_([\s\r\n]|$)`,
							"replacement": "$1",
						},
					},
					Analyzer: map[string]types.Analyzer{
						"mm_lowercaser": map[string]any{
							"tokenizer": "icu_tokenizer",
							"filter": []string{
								"icu_normalizer",
								"mm_snowball",
								"mm_stop",
							},
							"char_filter": []string{
								"leading_underscores",
								"trailing_underscores",
							},
						},
						"mm_url": map[string]any{
							"tokenizer": "pattern",
							"pattern":   "\\W",
							"lowercase": true,
						}},
					Filter: map[string]types.TokenFilter{
						"mm_snowball": map[string]any{
							"type":     "snowball",
							"language": "English",
						},
						"mm_stop": map[string]any{
							"type":      "stop",
							"stopwords": "_english_",
						},
					},
					Normalizer: map[string]types.Normalizer{
						"mm_hashtag": map[string]any{
							"type":        "custom",
							"char_filter": []string{},
							"filter":      []string{"lowercase", "icu_normalizer"},
						},
					},
				},
			},
			Mappings: mappings,
		},
	}
}

func GetFileInfoTemplate(cfg *model.Config) *putindextemplate.Request {
	mappings := &types.TypeMapping{
		Properties: map[string]types.Property{
			"name": types.TextProperty{
				Analyzer: model.NewPointer("mm_lowercaser"),
				Type:     "text",
			},
			"content": types.TextProperty{
				Analyzer: model.NewPointer("mm_lowercaser"),
				Type:     "text",
			},
		},
	}

	return &putindextemplate.Request{
		IndexPatterns: []string{*cfg.ElasticsearchSettings.IndexPrefix + IndexBaseFiles + "*"},
		Template: &types.IndexTemplateMapping{
			Settings: &types.IndexSettings{
				Index: &types.IndexSettings{
					NumberOfShards:   strconv.Itoa(*cfg.ElasticsearchSettings.PostIndexShards),
					NumberOfReplicas: strconv.Itoa(*cfg.ElasticsearchSettings.PostIndexReplicas),
				},
				Analysis: &types.IndexSettingsAnalysis{
					CharFilter: map[string]types.CharFilter{
						"leading_underscores": map[string]any{
							"type":        "pattern_replace",
							"pattern":     `(^|[\s\r\n])_`,
							"replacement": "$1",
						},
						"trailing_underscores": map[string]any{
							"type":        "pattern_replace",
							"pattern":     `_([\s\r\n]|$)`,
							"replacement": "$1",
						},
					},
					Analyzer: map[string]types.Analyzer{
						"mm_lowercaser": map[string]any{
							"tokenizer": "icu_tokenizer",
							"filter": []string{
								"icu_normalizer",
								"mm_snowball",
								"mm_stop",
							},
							"char_filter": []string{
								"leading_underscores",
								"trailing_underscores",
							},
						},
					},
					Filter: map[string]types.TokenFilter{
						"mm_snowball": map[string]any{
							"type":     "snowball",
							"language": "English",
						},
						"mm_stop": map[string]any{
							"type":      "stop",
							"stopwords": "_english_",
						},
					},
				},
			},
			Mappings: mappings,
		},
	}
}

func GetChannelTemplate(cfg *model.Config) *putindextemplate.Request {
	mappings := &types.TypeMapping{
		Properties: map[string]types.Property{
			"name_suggestions": types.KeywordProperty{
				Type: "keyword",
			},
			"team_id": types.KeywordProperty{
				Type: "keyword",
			},
			"user_ids": types.KeywordProperty{
				Type: "keyword",
			},
			"team_member_ids": types.KeywordProperty{
				Type: "keyword",
			},
			"type": types.KeywordProperty{
				Type: "keyword",
			},
			"delete_at": types.LongNumberProperty{
				Type: "long",
			},
		},
	}

	return &putindextemplate.Request{
		IndexPatterns: []string{*cfg.ElasticsearchSettings.IndexPrefix + IndexBaseChannels + "*"},
		Template: &types.IndexTemplateMapping{
			Settings: &types.IndexSettings{
				Index: &types.IndexSettings{
					NumberOfShards:   strconv.Itoa(*cfg.ElasticsearchSettings.ChannelIndexShards),
					NumberOfReplicas: strconv.Itoa(*cfg.ElasticsearchSettings.ChannelIndexReplicas),
				},
			},
			Mappings: mappings,
		},
	}
}

func GetUserTemplate(cfg *model.Config) *putindextemplate.Request {
	mappings := &types.TypeMapping{
		Properties: map[string]types.Property{
			"suggestions_with_fullname": types.KeywordProperty{
				Type: "keyword",
			},
			"suggestions_without_fullname": types.KeywordProperty{
				Type: "keyword",
			},
			"team_id": types.KeywordProperty{
				Type: "keyword",
			},
			"channel_id": types.KeywordProperty{
				Type: "keyword",
			},
			"delete_at": types.LongNumberProperty{
				Type: "long",
			},
			"roles": types.KeywordProperty{
				Type: "keyword",
			},
		},
	}

	return &putindextemplate.Request{
		IndexPatterns: []string{*cfg.ElasticsearchSettings.IndexPrefix + IndexBaseUsers + "*"},
		Template: &types.IndexTemplateMapping{
			Settings: &types.IndexSettings{
				Index: &types.IndexSettings{
					NumberOfShards:   strconv.Itoa(*cfg.ElasticsearchSettings.UserIndexShards),
					NumberOfReplicas: strconv.Itoa(*cfg.ElasticsearchSettings.UserIndexReplicas),
				},
			},
			Mappings: mappings,
		},
	}
}
