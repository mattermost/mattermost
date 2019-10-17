package analytics

import "time"

var _ Message = (*Alias)(nil)

// This type represents object sent in a alias call as described in
// https://segment.com/docs/libraries/http/#alias
type Alias struct {
	// This field is exported for serialization purposes and shouldn't be set by
	// the application, its value is always overwritten by the library.
	Type string `json:"type,omitempty"`

	MessageId    string       `json:"messageId,omitempty"`
	PreviousId   string       `json:"previousId"`
	UserId       string       `json:"userId"`
	Timestamp    time.Time    `json:"timestamp,omitempty"`
	Context      *Context     `json:"context,omitempty"`
	Integrations Integrations `json:"integrations,omitempty"`
}

func (msg Alias) internal() {
	panic(unimplementedError)
}

func (msg Alias) Validate() error {
	if len(msg.UserId) == 0 {
		return FieldError{
			Type:  "analytics.Alias",
			Name:  "UserId",
			Value: msg.UserId,
		}
	}

	if len(msg.PreviousId) == 0 {
		return FieldError{
			Type:  "analytics.Alias",
			Name:  "PreviousId",
			Value: msg.PreviousId,
		}
	}

	return nil
}
