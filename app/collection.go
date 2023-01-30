// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (a *App) RegisterCollectionAndTopic(pluginID, collectionType, topicType string) error {
	// we have a race condition due to multiple plugins calling this method
	a.ch.collectionAndTopicTypesMut.Lock()
	defer a.ch.collectionAndTopicTypesMut.Unlock()

	// check if collectionType was already registered by other plugin
	existingPluginID, ok := a.ch.collectionTypes[collectionType]
	if ok && existingPluginID != pluginID {
		return model.NewAppError("registerCollectionAndTopic", "app.collection.add_collection.exists.app_error", nil, "", http.StatusBadRequest)
	}

	// check if topicType was already registered to other collection
	existingCollectionType, ok := a.ch.topicTypes[topicType]
	if ok && existingCollectionType != collectionType {
		return model.NewAppError("registerCollectionAndTopic", "app.collection.add_topic.exists.app_error", nil, "", http.StatusBadRequest)
	}

	a.ch.collectionTypes[collectionType] = pluginID
	a.ch.topicTypes[topicType] = collectionType

	a.ch.srv.Log().Info("registered collection and topic type", mlog.String("plugin_id", pluginID), mlog.String("collection_type", collectionType), mlog.String("topic_type", topicType))
	return nil
}
