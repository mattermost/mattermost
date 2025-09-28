// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	AuditKeyActor     = "actor"
	AuditKeyAPIPath   = "api_path"
	AuditKeyEvent     = "event"
	AuditKeyEventData = "event_data"
	AuditKeyEventName = "event_name"
	AuditKeyMeta      = "meta"
	AuditKeyError     = "error"
	AuditKeyStatus    = "status"
	AuditKeyUserID    = "user_id"
	AuditKeySessionID = "session_id"
	AuditKeyClient    = "client"
	AuditKeyIPAddress = "ip_address"
	AuditKeyClusterID = "cluster_id"

	AuditStatusSuccess = "success"
	AuditStatusAttempt = "attempt"
	AuditStatusFail    = "fail"
)

// AuditRecord provides a consistent set of fields used for all audit logging.
type AuditRecord struct {
	EventName string          `json:"event_name"`
	Status    string          `json:"status"`
	EventData AuditEventData  `json:"event"`
	Actor     AuditEventActor `json:"actor"`
	Meta      map[string]any  `json:"meta"`
	Error     AuditEventError `json:"error"`
}

// AuditEventData contains all event specific data about the modified entity
type AuditEventData struct {
	Parameters  map[string]any `json:"parameters"`      // Payload and parameters being processed as part of the request
	PriorState  map[string]any `json:"prior_state"`     // Prior state of the object being modified, nil if no prior state
	ResultState map[string]any `json:"resulting_state"` // Resulting object after creating or modifying it
	ObjectType  string         `json:"object_type"`     // String representation of the object type. eg. "post"
}

// AuditEventActor is the subject triggering the event
type AuditEventActor struct {
	UserId        string `json:"user_id"`
	SessionId     string `json:"session_id"`
	Client        string `json:"client"`
	IpAddress     string `json:"ip_address"`
	XForwardedFor string `json:"x_forwarded_for"`
}

// EventMeta is a key-value store to store related information to the event that is not directly related to the modified entity
type EventMeta struct {
	ApiPath   string `json:"api_path"`
	ClusterId string `json:"cluster_id"`
}

// AuditEventError contains error information in case of failure of the event
type AuditEventError struct {
	Description string `json:"description,omitempty"`
	Code        int    `json:"status_code,omitempty"`
}

// Auditable for sensitive object classes, consider implementing Auditable and include whatever the
// AuditableObject returns. For example: it's likely OK to write a user object to the
// audit logs, but not the user password in cleartext or hashed form
type Auditable interface {
	Auditable() map[string]any
}

// Success marks the audit record status as successful.
func (rec *AuditRecord) Success() {
	rec.Status = AuditStatusSuccess
}

// Fail marks the audit record status as failed.
func (rec *AuditRecord) Fail() {
	rec.Status = AuditStatusFail
}

// AddEventParameterToAuditRec adds a parameter, e.g. query or post body, to the event
func AddEventParameterToAuditRec[T string | bool | int | int64 | []string | map[string]string](rec *AuditRecord, key string, val T) {
	if rec.EventData.Parameters == nil {
		rec.EventData.Parameters = make(map[string]any)
	}

	rec.EventData.Parameters[key] = val
}

// AddEventParameterAuditableToAuditRec adds an object that is of type Auditable to the event
func AddEventParameterAuditableToAuditRec(rec *AuditRecord, key string, val Auditable) {
	if rec.EventData.Parameters == nil {
		rec.EventData.Parameters = make(map[string]any)
	}

	rec.EventData.Parameters[key] = val.Auditable()
}

// AddEventParameterAuditableArrayToAuditRec adds an array of objects of type Auditable to the event
func AddEventParameterAuditableArrayToAuditRec[T Auditable](rec *AuditRecord, key string, val []T) {
	if rec.EventData.Parameters == nil {
		rec.EventData.Parameters = make(map[string]any)
	}

	processedAuditables := make([]map[string]any, 0, len(val))
	for _, auditableVal := range val {
		processedAuditables = append(processedAuditables, auditableVal.Auditable())
	}

	rec.EventData.Parameters[key] = processedAuditables
}

// AddEventPriorState adds the prior state of the modified object to the audit record
func (rec *AuditRecord) AddEventPriorState(object Auditable) {
	rec.EventData.PriorState = object.Auditable()
}

// AddEventResultState adds the result state of the modified object to the audit record
func (rec *AuditRecord) AddEventResultState(object Auditable) {
	rec.EventData.ResultState = object.Auditable()
}

// AddEventObjectType adds the object type of the modified object to the audit record
func (rec *AuditRecord) AddEventObjectType(objectType string) {
	rec.EventData.ObjectType = objectType
}

// AddMeta adds a key/value entry to the audit record that can be used for related information not directly related to
// the modified object, e.g. authentication method
func (rec *AuditRecord) AddMeta(name string, val any) {
	rec.Meta[name] = val
}

// AddErrorCode adds the error code for a failed event to the audit record
func (rec *AuditRecord) AddErrorCode(code int) {
	rec.Error.Code = code
}

// AddErrorDesc adds the error description for a failed event to the audit record
func (rec *AuditRecord) AddErrorDesc(description string) {
	rec.Error.Description = description
}

// AddAppError adds an AppError to the audit record
func (rec *AuditRecord) AddAppError(err *AppError) {
	rec.AddErrorCode(err.StatusCode)
	rec.AddErrorDesc(err.Error())
}
