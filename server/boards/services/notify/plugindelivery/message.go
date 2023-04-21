// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugindelivery

import (
	"fmt"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
)

const (
	// TODO: localize these when i18n is available.
	defCommentTemplate     = "@%s mentioned you in a comment on the card [%s](%s) in board [%s](%s)\n> %s"
	defDescriptionTemplate = "@%s mentioned you in the card [%s](%s) in board [%s](%s)\n> %s"
)

func formatMessage(author string, extract string, card string, link string, block *model.Block, boardLink string, board string) string {
	template := defDescriptionTemplate
	if block.Type == model.TypeComment {
		template = defCommentTemplate
	}
	return fmt.Sprintf(template, author, card, link, board, boardLink, extract)
}
