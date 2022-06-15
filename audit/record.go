// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

// Record provides a consistent set of fields used for all audit logging.
type Record struct {
	EventName string                 `json:"event_name"`
	Status    string                 `json:"status"`
	EventData EventData              `json:"event"`
	Actor     EventActor             `json:"actor"`
	Meta      map[string]interface{} `json:"meta"`
	Error     EventError          model/gr   `json:"error,omitempty"`
}

// EventData -- The new audit log schema proposes that all audit log events include
// the EventData struct.
type EventData struct {
	Parameters  map[string]interface{} `json:"parameters"`      // Payload and parameters being processed as part of the request
	PriorState  map[string]interface{} `json:"prior_state"`     // Prior state of the object being modified, nil if no prior state
	ResultState map[string]interface{} `json:"resulting_state"` // Resulting object after creating or modifying it
	ObjectType  string                 `json:"object_type"`     // String representation of the object type. eg. "post"
}

type EventActor struct {
	UserId    string `json:"user_id"`
	SessionId string `json:"session_id"`
	Client    string `json:"client"`
	IpAddress string `json:"ip_address"`
}

type EventMeta struct {
	ApiPath   string `json:"api_path"`
	ClusterId string `json:"cluster_id"`
}

type EventError struct {
	Description string `json:"description,omitempty"`
	Code        int    `json:"status_code,omitempty"`
}

// Auditable for sensitive object classes, consider implementing Auditable and include whatever the
// AuditableObject returns. For example: it's likely OK to write a user object to the
// audit logs, but not the user password in cleartext or hashed form
type Auditable interface {
	Auditable() map[string]interface{}
}

// Success marks the audit record status as successful.
func (rec *Record) Success() {
	rec.Status = Success
}

// Fail marks the audit record status as failed.
func (rec *Record) Fail() {
	rec.Status = Fail
}

func (rec *Record) AddEventParameter(key string, val interface{}) {
	rec.EventData.Parameters[key] = val
}
func (rec *Record) AddEventPriorState(object Auditable) {
	rec.EventData.PriorState = object.Auditable()
}

func (rec *Record) AddEventResultState(object Auditable) {
	rec.EventData.ResultState = object.Auditable()
}

func (rec *Record) AddEventObjectType(objectType string) {
	rec.EventData.ObjectType = objectType
}

func (rec *Record) AddMeta(name string, val interface{}) {
	rec.Meta[name] = val
}

func (rec *Record) AddErrorCode(code int) {
	rec.Error.Code = code
}

func (rec *Record) AddErrorDesc(description string) {
	rec.Error.Description = description
}
