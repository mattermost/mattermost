// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/shared/eventbus"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitEvents() {
	// GET /api/v4/events/topics
	api.BaseRoutes.Events.Handle("/topics", api.APISessionRequired(getTopics)).Methods("GET")
	// GET /api/v4/events/topics/<topicId>
	api.BaseRoutes.Events.Handle("/topics/{topic_id}", api.APISessionRequired(getTopic)).Methods("GET")
	// GET /api/v4/events/schemas/<topicId>
	api.BaseRoutes.Events.Handle("/schemas/{topic_id}", api.APISessionRequired(getSchema)).Methods("GET")
}

func getTopics(c *Context, w http.ResponseWriter, r *http.Request) {
	// parameter withSchema is to be parsed
	withSchema, _ := strconv.ParseBool(r.FormValue("withSchema"))

	topics, err := c.App.EventBroker().EventTypes()
	if err != nil {
		c.Err = model.NewAppError("getTopics", "app.broker_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if !withSchema {
		for i := range topics {
			topics[i].Schema = ""
		}
	}

	// calls broker to get a list of topics
	if err := json.NewEncoder(w).Encode(topics); err != nil {
		c.Err = model.NewAppError("getTopics", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
}

func getTopic(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTopicId()
	if c.Err != nil {
		return
	}

	// parameter withSchema is to be parsed
	// parameter topicId
	// parameter withSchema is to be parsed
	withSchema, _ := strconv.ParseBool(r.FormValue("withSchema"))
	topicId := c.Params.TopicId

	topics, err := c.App.EventBroker().EventTypes()
	if err != nil {
		c.Err = model.NewAppError("getTopics", "app.broker_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	topic := getTopicByIdFromTopics(topicId, topics)

	if !withSchema {
		topic.Schema = ""
	}

	// calls broker to get details of topic with id=topicId
	if err := json.NewEncoder(w).Encode(topic); err != nil {
		c.Err = model.NewAppError("getTopics", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
}

func getSchema(c *Context, w http.ResponseWriter, r *http.Request) {
	// calls broker to get a list of topics
	// parameter topicId
	topicId := c.Params.TopicId

	topics, err := c.App.EventBroker().EventTypes()
	if err != nil {
		c.Err = model.NewAppError("getTopics", "app.broker_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	topic := getTopicByIdFromTopics(topicId, topics)

	if _, err := w.Write([]byte(topic.Schema)); err != nil {
		c.Err = model.NewAppError("getTopics", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
}

func getTopicByIdFromTopics(topicId string, topics []*eventbus.EventType) *eventbus.EventType {
	var topic *eventbus.EventType
	for _, t := range topics {
		if t.Topic == topicId {
			topic = t
			break
		}
	}
	return topic
}
