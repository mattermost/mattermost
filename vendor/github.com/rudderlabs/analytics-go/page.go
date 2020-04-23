package analytics

import "time"

var _ Message = (*Page)(nil)

// This type represents object sent in a page call as described in
// https://segment.com/docs/libraries/http/#page
type Page struct {
	// This field is exported for serialization purposes and shouldn't be set by
	// the application, its value is always overwritten by the library.
	Type string `json:"type,omitempty"`

	MessageId    string       `json:"messageId,omitempty"`
	AnonymousId  string       `json:"anonymousId,omitempty"`
	UserId       string       `json:"userId,omitempty"`
	Name         string       `json:"name,omitempty"`
	Timestamp    time.Time    `json:"timestamp,omitempty"`
	Context      *Context     `json:"context,omitempty"`
	Properties   Properties   `json:"properties,omitempty"`
	Integrations Integrations `json:"integrations,omitempty"`
}

func (msg Page) internal() {
	panic(unimplementedError)
}

func (msg Page) Validate() error {
	if len(msg.UserId) == 0 && len(msg.AnonymousId) == 0 {
		return FieldError{
			Type:  "analytics.Page",
			Name:  "UserId",
			Value: msg.UserId,
		}
	}

	return nil
}
