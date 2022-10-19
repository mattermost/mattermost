// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func (a *App) registerCollectionAndTopic(pluginID, collectionType, topicType string) error {
	// we have a race condition due to multiple plugins calling this method
	a.ch.collectionMut.Lock()
	defer a.ch.collectionMut.Unlock()

	// check if collectionType was already registered by other plugin
	if pluginIDForCollection, found := getKeyWithValue(a.ch.collectionTypes, collectionType); found && pluginIDForCollection != pluginID {
		return model.NewAppError("registerCollectionAndTopic", "app.collection.add_collection.exists.app_error", nil, "", http.StatusBadRequest)
	}

	// check if topicType was already registered to other collection
	for collectionTypeForTopic, topicTypes := range a.ch.topicTypes {
		if utils.StringInSlice(topicType, topicTypes) && collectionTypeForTopic != collectionType {
			return model.NewAppError("registerCollectionAndTopic", "app.collection.add_topic.exists.app_error", nil, "", http.StatusBadRequest)
		}
	}

	collectionTypesForPlugin, ok := a.ch.collectionTypes[pluginID]
	if ok && !utils.StringInSlice(collectionType, collectionTypesForPlugin) {
		collectionTypesForPlugin = append(collectionTypesForPlugin, collectionType)
		a.ch.collectionTypes[pluginID] = collectionTypesForPlugin
	} else if !ok {
		a.ch.collectionTypes[pluginID] = []string{collectionType}
	}

	if topicTypes, ok := a.ch.topicTypes[collectionType]; ok {
		topicTypes = append(topicTypes, topicType)
		a.ch.topicTypes[collectionType] = topicTypes
	} else {
		a.ch.topicTypes[collectionType] = []string{topicType}
	}

	return nil
}

func getKeyWithValue(m map[string][]string, value string) (string, bool) {
	for key, arr := range m {
		if utils.StringInSlice(value, arr) {
			return key, true
		}
	}
	return "", false
}
