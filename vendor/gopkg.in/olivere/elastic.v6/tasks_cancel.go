// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/olivere/elastic/uritemplates"
)

// TasksCancelService can cancel long-running tasks.
// It is supported as of Elasticsearch 2.3.0.
//
// See http://www.elastic.co/guide/en/elasticsearch/reference/5.2/tasks-cancel.html
// for details.
type TasksCancelService struct {
	client       *Client
	pretty       bool
	taskId       string
	actions      []string
	nodeId       []string
	parentTaskId string
}

// NewTasksCancelService creates a new TasksCancelService.
func NewTasksCancelService(client *Client) *TasksCancelService {
	return &TasksCancelService{
		client: client,
	}
}

// TaskId specifies the task to cancel. Notice that the caller is responsible
// for using the correct format, i.e. node_id:task_number, as specified in
// the REST API.
func (s *TasksCancelService) TaskId(taskId string) *TasksCancelService {
	s.taskId = taskId
	return s
}

// TaskIdFromNodeAndId specifies the task to cancel. Set id to -1 for all tasks.
func (s *TasksCancelService) TaskIdFromNodeAndId(nodeId string, id int64) *TasksCancelService {
	// See https://github.com/elastic/elasticsearch/blob/6.7/server/src/main/java/org/elasticsearch/tasks/TaskId.java#L107-L118
	if id != -1 {
		s.taskId = fmt.Sprintf("%s:%d", nodeId, id)
	}
	return s
}

// Actions is a list of actions that should be cancelled. Leave empty to cancel all.
func (s *TasksCancelService) Actions(actions ...string) *TasksCancelService {
	s.actions = append(s.actions, actions...)
	return s
}

// NodeId is a list of node IDs or names to limit the returned information;
// use `_local` to return information from the node you're connecting to,
// leave empty to get information from all nodes.
func (s *TasksCancelService) NodeId(nodeId ...string) *TasksCancelService {
	s.nodeId = append(s.nodeId, nodeId...)
	return s
}

// ParentTaskId specifies to cancel tasks with specified parent task id.
// Notice that the caller is responsible for using the correct format,
// i.e. node_id:task_number, as specified in the REST API.
func (s *TasksCancelService) ParentTaskId(parentTaskId string) *TasksCancelService {
	s.parentTaskId = parentTaskId
	return s
}

// ParentTaskIdFromNodeAndId specifies to cancel tasks with specified parent task id.
func (s *TasksCancelService) ParentTaskIdFromNodeAndId(nodeId string, id int64) *TasksCancelService {
	// See https://github.com/elastic/elasticsearch/blob/6.7/server/src/main/java/org/elasticsearch/tasks/TaskId.java#L107-L118
	if id != -1 {
		s.parentTaskId = fmt.Sprintf("%s:%d", nodeId, id)
	}
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *TasksCancelService) Pretty(pretty bool) *TasksCancelService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *TasksCancelService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string
	if s.taskId != "" {
		path, err = uritemplates.Expand("/_tasks/{task_id}/_cancel", map[string]string{
			"task_id": s.taskId,
		})
	} else {
		path = "/_tasks/_cancel"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "true")
	}
	if len(s.actions) > 0 {
		params.Set("actions", strings.Join(s.actions, ","))
	}
	if len(s.nodeId) > 0 {
		params.Set("node_id", strings.Join(s.nodeId, ","))
	}
	if s.parentTaskId != "" {
		params.Set("parent_task_id", s.parentTaskId)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *TasksCancelService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *TasksCancelService) Do(ctx context.Context) (*TasksListResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, PerformRequestOptions{
		Method: "POST",
		Path:   path,
		Params: params,
	})
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(TasksListResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}
