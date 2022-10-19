// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (a *App) registerCollectionAndTopic(pluginID, collectionType, topicType string) error {
	collectionTypeForPlugin, ok := a.ch.collectionTypes[pluginID]
	if ok && collectionTypeForPlugin != collectionType {
		return model.NewAppError("registerCollectionAndTopic", "app.collection.add_collection.exists.app_error", nil, "", http.StatusBadRequest)
	} else if !ok {
		a.ch.collectionTypes[pluginID] = collectionType
	}

	for _, ts := range a.ch.topicTypes {
		if containsSlice(ts, topicType) {
			return model.NewAppError("registerCollectionAndTopic", "app.collection.add_topic.exists.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if ts, ok := a.ch.topicTypes[collectionType]; !ok {
		a.ch.topicTypes[collectionType] = []string{topicType}
	} else {
		ts = append(ts, topicType)
		a.ch.topicTypes[collectionType] = ts
	}

	return nil
}

func containsSlice(elems []string, elem string) bool {
	for _, e := range elems {
		if e == elem {
			return true
		}
	}
	return false
}
