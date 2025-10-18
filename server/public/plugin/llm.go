// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import "github.com/mattermost/mattermost-plugin-ai/llm"

type CompletionRequest struct {
	Posts []llm.Post
}
