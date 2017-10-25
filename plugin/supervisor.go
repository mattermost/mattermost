// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

// Supervisor provides the interface for an object that controls the execution of a plugin.
type Supervisor interface {
	Start() error
	Stop() error
	Hooks() Hooks
}
