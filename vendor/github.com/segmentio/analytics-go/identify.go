package analytics

import "time"

var _ Message = (*Identify)(nil)

// This type represents object sent in an identify call as described in
// https://segment.com/docs/libraries/http/#identify
type Identify struct {
	// This field is exported for serialization purposes and shouldn't be set by
	// the application, its value is always overwritten by the library.
	Type string `json:"type,omitempty"`

	MessageId    string       `json:"messageId,omitempty"`
	AnonymousId  string       `json:"anonymousId,omitempty"`
	UserId       string       `json:"userId,omitempty"`
	Timestamp    time.Time    `json:"timestamp,omitempty"`
	Context      *Context     `json:"context,omitempty"`
	Traits       Traits       `json:"traits,omitempty"`
	Integrations Integrations `json:"integrations,omitempty"`
}

func (msg Identify) internal() {
	panic(unimplementedError)
}

func (msg Identify) Validate() error {
	if len(msg.UserId) == 0 && len(msg.AnonymousId) == 0 {
		return FieldError{
			Type:  "analytics.Identify",
			Name:  "UserId",
			Value: msg.UserId,
		}
	}

	return nil
}
