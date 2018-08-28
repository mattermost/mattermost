// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

// Context passes through metadata about the request or hook event.
//
// It is currently a placeholder while the implementation details are sorted out.
type Context struct {
	SessionId string
}
