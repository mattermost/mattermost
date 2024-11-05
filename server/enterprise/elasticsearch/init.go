// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/elasticsearch"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/opensearch"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	ejobs "github.com/mattermost/mattermost/server/v8/einterfaces/jobs"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

func init() {
	platform.RegisterElasticsearchInterface(func(s *platform.PlatformService) searchengine.SearchEngineInterface {
		if *s.Config().ElasticsearchSettings.Backend == model.ElasticsearchSettingsESBackend {
			return &elasticsearch.ElasticsearchInterfaceImpl{Platform: s}
		}
		return &opensearch.OpensearchInterfaceImpl{Platform: s}
	})
	app.RegisterJobsElasticsearchIndexerInterface(func(s *app.Server) ejobs.IndexerJobInterface {
		if *s.Config().ElasticsearchSettings.Backend == model.ElasticsearchSettingsESBackend {
			return &elasticsearch.ElasticsearchIndexerInterfaceImpl{Server: s}
		}
		return &opensearch.OpensearchIndexerInterfaceImpl{Server: s}
	})
	app.RegisterJobsElasticsearchAggregatorInterface(func(s *app.Server) ejobs.ElasticsearchAggregatorInterface {
		if *s.Config().ElasticsearchSettings.Backend == model.ElasticsearchSettingsESBackend {
			return &elasticsearch.ElasticsearchAggregatorInterfaceImpl{Server: s}
		}
		return &opensearch.OpensearchAggregatorInterfaceImpl{Server: s}
	})
}
