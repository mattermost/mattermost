// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (s *PluginService) registerCollectionAndTopic(pluginID, collectionType, topicType string) error {
	// we have a race condition due to multiple plugins calling this method
	s.collectionAndTopicTypesMut.Lock()
	defer s.collectionAndTopicTypesMut.Unlock()

	// check if collectionType was already registered by other plugin
	existingPluginID, ok := s.collectionTypes[collectionType]
	if ok && existingPluginID != pluginID {
		return model.NewAppError("registerCollectionAndTopic", "app.collection.add_collection.exists.app_error", nil, "", http.StatusBadRequest)
	}

	// check if topicType was already registered to other collection
	existingCollectionType, ok := s.topicTypes[topicType]
	if ok && existingCollectionType != collectionType {
		return model.NewAppError("registerCollectionAndTopic", "app.collection.add_topic.exists.app_error", nil, "", http.StatusBadRequest)
	}

	s.collectionTypes[collectionType] = pluginID
	s.topicTypes[topicType] = collectionType

	s.platform.Log().Info("registered collection and topic type", mlog.String("plugin_id", pluginID), mlog.String("collection_type", collectionType), mlog.String("topic_type", topicType))
	return nil
}
