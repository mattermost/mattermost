package analytics

import "time"

var _ Message = (*Group)(nil)

// This type represents object sent in a group call as described in
// https://segment.com/docs/libraries/http/#group
type Group struct {
	// This field is exported for serialization purposes and shouldn't be set by
	// the application, its value is always overwritten by the library.
	Type string `json:"type,omitempty"`

	MessageId    string       `json:"messageId,omitempty"`
	AnonymousId  string       `json:"anonymousId,omitempty"`
	UserId       string       `json:"userId,omitempty"`
	GroupId      string       `json:"groupId"`
	Timestamp    time.Time    `json:"timestamp,omitempty"`
	Context      *Context     `json:"context,omitempty"`
	Traits       Traits       `json:"traits,omitempty"`
	Integrations Integrations `json:"integrations,omitempty"`
}

func (msg Group) internal() {
	panic(unimplementedError)
}

func (msg Group) Validate() error {
	if len(msg.GroupId) == 0 {
		return FieldError{
			Type:  "analytics.Group",
			Name:  "GroupId",
			Value: msg.GroupId,
		}
	}

	if len(msg.UserId) == 0 && len(msg.AnonymousId) == 0 {
		return FieldError{
			Type:  "analytics.Group",
			Name:  "UserId",
			Value: msg.UserId,
		}
	}

	return nil
}
