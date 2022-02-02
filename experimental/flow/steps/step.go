package steps

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

type Step interface {
	Attachment(pluginURL string) Attachment
	Name() string
	IsEmpty() bool
}

type Attachment struct {
	SlackAttachment *model.SlackAttachment
	Actions         []Action
}

type Action struct {
	model.PostAction
	OnClick func(userID string) (int, Attachment)
	Dialog  *Dialog
}

func (a *Attachment) ToSlackAttachment() *model.SlackAttachment {
	ret := *a.SlackAttachment
	ret.Actions = make([]*model.PostAction, len(a.Actions))

	for i := 0; i < len(a.Actions); i++ {
		postAction := a.Actions[i].PostAction
		ret.Actions[i] = &postAction
	}

	return &ret
}
