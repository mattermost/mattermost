// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

// APILayer represents the application layer emitting an audit record.
type APILayer string

const (
	Rest APILayer = "rest"
	App  APILayer = "app"
)

// Record provides a consistent set of fields used for all audit logging.
type Record struct {
	ID        string
	CreateAt  int64
	APILayer  APILayer
	APIPath   string
	Event     string
	UserID    string
	SessionID string
	Client    string
	IPAddress string
	Meta      map[string]interface{}
}
