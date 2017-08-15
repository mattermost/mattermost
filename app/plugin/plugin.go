// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

type Plugin interface {
	Initialize(API)
	Hooks
}
