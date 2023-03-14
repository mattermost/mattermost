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
	Error     EventError             `json:"error,omitempty"`
}

// EventData contains all event specific data about the modified entity
type EventData struct {
	Parameters  map[string]interface{} `json:"parameters"`      // Payload and parameters being processed as part of the request
	PriorState  map[string]interface{} `json:"prior_state"`     // Prior state of the object being modified, nil if no prior state
	ResultState map[string]interface{} `json:"resulting_state"` // Resulting object after creating or modifying it
	ObjectType  string                 `json:"object_type"`     // String representation of the object type. eg. "post"
}

// EventActor is the subject triggering the event
type EventActor struct {
	UserId    string `json:"user_id"`
	SessionId string `json:"session_id"`
	Client    string `json:"client"`
	IpAddress string `json:"ip_address"`
}

// EventMeta is a key-value store to store related information to the event that is not directly related to the modified entity
type EventMeta struct {
	ApiPath   string `json:"api_path"`
	ClusterId string `json:"cluster_id"`
}

// EventError contains error information in case of failure of the event
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

// AddEventParameter adds a parameter, e.g. query or post body, to the event
func AddEventParameter[T string | bool | int | int64 | []string | map[string]string](rec *Record, key string, val T) {
	if rec.EventData.Parameters == nil {
		rec.EventData.Parameters = make(map[string]interface{})
	}

	rec.EventData.Parameters[key] = val
}

// AddEventParameterAuditable adds an object that is of type Auditable to the event
func AddEventParameterAuditable(rec *Record, key string, val Auditable) {
	if rec.EventData.Parameters == nil {
		rec.EventData.Parameters = make(map[string]interface{})
	}

	rec.EventData.Parameters[key] = val.Auditable()
}

// AddEventParameterAuditableArray adds an array of objects of type Auditable to the event
func AddEventParameterAuditableArray[T Auditable](rec *Record, key string, val []T) {
	if rec.EventData.Parameters == nil {
		rec.EventData.Parameters = make(map[string]interface{})
	}

	processedAuditables := make([]map[string]interface{}, 0, len(val))
	for _, auditableVal := range val {
		processedAuditables = append(processedAuditables, auditableVal.Auditable())
	}

	rec.EventData.Parameters[key] = processedAuditables
}

// AddEventPriorState adds the prior state of the modified object to the audit record
func (rec *Record) AddEventPriorState(object Auditable) {
	rec.EventData.PriorState = object.Auditable()
}

// AddEventResultState adds the result state of the modified object to the audit record
func (rec *Record) AddEventResultState(object Auditable) {
	rec.EventData.ResultState = object.Auditable()
}

// AddEventObjectType adds the object type of the modified object to the audit record
func (rec *Record) AddEventObjectType(objectType string) {
	rec.EventData.ObjectType = objectType
}

// AddMeta adds a key/value entry to the audit record that can be used for related information not directly related to
// the modified object, e.g. authentication method
func (rec *Record) AddMeta(name string, val interface{}) {
	rec.Meta[name] = val
}

// AddErrorCode adds the error code for a failed event to the audit record
func (rec *Record) AddErrorCode(code int) {
	rec.Error.Code = code
}

// AddErrorDesc adds the error description for a failed event to the audit record
func (rec *Record) AddErrorDesc(description string) {
	rec.Error.Description = description
}
