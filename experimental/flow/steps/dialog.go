package steps

import "github.com/mattermost/mattermost-server/v6/model"

type Dialog struct {
	Dialog         model.Dialog
	OnDialogSubmit func(userID string, submission map[string]interface{}) (int, *Attachment, string, map[string]string)
	OnCancel       func(userID string) (int, *Attachment)
}
