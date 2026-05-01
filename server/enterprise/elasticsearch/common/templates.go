// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"strconv"

	"github.com/elastic/go-elasticsearch/v8/typedapi/indices/putindextemplate"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func addQueryProperty(mappings *types.TypeMapping, propertyName string, analyzer string) {
	// property name must be a text property due to default mappings
	if textProp, ok := mappings.Properties[propertyName].(types.TextProperty); ok {
		if textProp.Fields == nil {
			textProp.Fields = make(map[string]types.Property)
		}

		textProp.Fields[analyzer] = types.TextProperty{
			Analyzer: model.NewPointer("mm_" + analyzer),
			Type:     "text",
		}

		mappings.Properties[propertyName] = textProp
	}
}

func WithNoriAnalyzer() func(template *types.IndexTemplateMapping) {
	return func(template *types.IndexTemplateMapping) {
		mlog.Info("using nori analyzer")

		addQueryProperty(template.Mappings, "message", "nori")
		addQueryProperty(template.Mappings, "attachments", "nori")

		template.Settings.Analysis.Tokenizer["nori_tokenizer"] = map[string]any{
			"type":            "nori_tokenizer",
			"decompound_mode": "mixed",
		}

		template.Settings.Analysis.Analyzer["mm_nori"] = map[string]any{
			"char_filter": []string{
				"leading_underscores",
				"trailing_underscores",
			},
			"tokenizer": "nori_tokenizer",
			"filter": []string{
				"nori_readingform",
				"nori_part_of_speech",
				"lowercase",
			},
		}
	}
}

func WithKuromojiAnalyzer() func(template *types.IndexTemplateMapping) {
	return func(template *types.IndexTemplateMapping) {
		mlog.Info("using kuromoji analyzer")

		addQueryProperty(template.Mappings, "message", "kuromoji")
		addQueryProperty(template.Mappings, "attachments", "kuromoji")

		template.Settings.Analysis.Tokenizer["kuromoji_tokenizer"] = map[string]any{
			"type": "kuromoji_tokenizer",
			"mode": "search",
		}

		template.Settings.Analysis.Analyzer["mm_kuromoji"] = map[string]any{
			"char_filter": []string{
				"leading_underscores",
				"trailing_underscores",
			},
			"tokenizer": "kuromoji_tokenizer",
			"filter": []string{
				"kuromoji_baseform",
				"kuromoji_part_of_speech",
				"ja_stop",
				"kuromoji_stemmer",
				"lowercase",
			},
		}
	}
}

func WithSmartCNAnalyzer() func(template *types.IndexTemplateMapping) {
	return func(template *types.IndexTemplateMapping) {
		mlog.Info("using smartcn analyzer")

		addQueryProperty(template.Mappings, "message", "smartcn")
		addQueryProperty(template.Mappings, "attachments", "smartcn")

		template.Settings.Analysis.Analyzer["mm_smartcn"] = map[string]any{
			"char_filter": []string{
				"leading_underscores",
				"trailing_underscores",
			},
			"tokenizer": "smartcn_tokenizer",
			"filter": []string{
				"smartcn_stop",
				"lowercase",
			},
		}
	}
}

func GetPostTemplate(cfg *model.Config, opts ...func(*types.IndexTemplateMapping)) *putindextemplate.Request {
	template := &types.IndexTemplateMapping{
		Settings: &types.IndexSettings{
			Index: &types.IndexSettings{
				NumberOfShards:   model.NewPointer(strconv.Itoa(*cfg.ElasticsearchSettings.PostIndexShards)),
				NumberOfReplicas: model.NewPointer(strconv.Itoa(*cfg.ElasticsearchSettings.PostIndexReplicas)),
			},
			Analysis: &types.IndexSettingsAnalysis{
				Tokenizer: map[string]types.Tokenizer{},
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
				Normalizer: map[string]types.Normalizer{
					"mm_hashtag": map[string]any{
						"type":        "custom",
						"char_filter": []string{},
						"filter":      []string{"lowercase", "icu_normalizer"},
					},
				},
			},
		},
		Mappings: &types.TypeMapping{
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
				"channel_type": types.KeywordProperty{
					Type: "keyword",
				},
			},
		},
	}

	for _, opt := range opts {
		opt(template)
	}

	return &putindextemplate.Request{
		IndexPatterns: []string{*cfg.ElasticsearchSettings.IndexPrefix + IndexBasePosts + "*"},
		Template:      template,
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
					NumberOfShards:   model.NewPointer(strconv.Itoa(*cfg.ElasticsearchSettings.PostIndexShards)),
					NumberOfReplicas: model.NewPointer(strconv.Itoa(*cfg.ElasticsearchSettings.PostIndexReplicas)),
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
					NumberOfShards:   model.NewPointer(strconv.Itoa(*cfg.ElasticsearchSettings.ChannelIndexShards)),
					NumberOfReplicas: model.NewPointer(strconv.Itoa(*cfg.ElasticsearchSettings.ChannelIndexReplicas)),
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
					NumberOfShards:   model.NewPointer(strconv.Itoa(*cfg.ElasticsearchSettings.UserIndexShards)),
					NumberOfReplicas: model.NewPointer(strconv.Itoa(*cfg.ElasticsearchSettings.UserIndexReplicas)),
				},
			},
			Mappings: mappings,
		},
	}
}
