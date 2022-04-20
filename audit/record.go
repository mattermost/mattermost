// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

// Meta represents metadata that can be added to a audit record as name/value pairs.
type Meta map[string]interface{}

// FuncMetaTypeConv defines a function that can convert meta data types into something
// that serializes well for audit records.
type FuncMetaTypeConv func(val interface{}) (newVal interface{}, converted bool)

type EventObject struct {
	Id       string `json:"id"`
	Metadata string `json:"data"`
}

type EventMetadataObject struct {
	Id       string      `json:"id"`
	Metadata interface{} `json:"metadata"`
}
type EventOrigin struct {
	Id        string                 `json:"id"`
	PriorData map[string]interface{} `json:"prior_data"`
}

type EventResult struct {
	Id         string      `json:"id"`
	ChangeData interface{} `json:"change_data"`
	PostData   interface{} `json:"post_data"`
}

type EventData struct {
	Change           interface{} `json:"new_data"`
	PriorState       interface{} `json:"prior_state"`
	ResultingState   interface{} `json:"resulting_state"`
	ResultObjectType string      `json:"result_object_type"`
}

type Auditable interface {
	AuditableObject() interface{}
}

// Record provides a consistent set of fields used for all audit logging.
type Record struct {
	APIPath   string    `json:"api_path"`
	EventName string    `json:"event_name"`
	EventData EventData `json:"event_data"`
	Error     string    `json:"error"`
	Status    string    `json:"status"`
	UserID    string    `json:"user_id"`
	SessionID string    `json:"session_id"`
	Client    string    `json:"client"`
	IPAddress string    `json:"ip_address"`
	Meta      Meta      `json:"meta"`
	metaConv  []FuncMetaTypeConv
}

// Success marks the audit record status as successful.
func (rec *Record) Success() {
	rec.Status = Success
}

// Great success marks the audit record status as failed.
func (rec *Record) Fail() {
	rec.Status = Fail
}

func (rec *Record) AddEventData(data EventData) {
	rec.EventData = data
}

// AddMeta adds a single name/value pair to this audit record's metadata.
func (rec *Record) AddMeta(name string, val interface{}) {
	if rec.Meta == nil {
		rec.Meta = Meta{}
	}

	// possibly convert val to something better suited for serializing
	// via zero or more conversion functions.
	var converted bool
	for _, conv := range rec.metaConv {
		val, converted = conv(val)
		if converted {
			break
		}
	}

	rec.Meta[name] = val
}

func (rec *Record) AddMetadata(newObject interface{},
	priorObject interface{},
	resultObject Auditable,
	resultObjectType string) {

	//var priorAuditable interface{}
	//var resultAuditable interface{}

	//switch priorObject.(type) {
	//case model.User:
	//	user := priorObject.(model.User)
	//	rec.UserID = user.Id
	//	priorAuditable = user.AuditableUser()
	//default:
	//	priorAuditable = priorObject
	//}

	//switch resultObject.(type) {
	//case model.User:
	//	user := resultObject.(model.User)
	//	rec.UserID = user.Id
	//	resultAuditable = user.AuditableUser()
	//default:
	//	resultAuditable = resultObject
	//}

	eventData := EventData{
		Change:           newObject,
		PriorState:       priorObject,
		ResultingState:   resultObject.AuditableObject(),
		ResultObjectType: resultObjectType,
	}
	rec.EventData = eventData
}

// AddMetaTypeConverter adds a function capable of converting meta field types
// into something more suitable for serialization.
func (rec *Record) AddMetaTypeConverter(f FuncMetaTypeConv) {
	rec.metaConv = append(rec.metaConv, f)
}
