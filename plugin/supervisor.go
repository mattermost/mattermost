// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

// Supervisor provides the interface for an object that controls the execution of a plugin. This
// type is only relevant to the server, and isn't used by the plugins themselves.
type Supervisor interface {
	Start(API) error
	Wait() error
	Stop() error
	Hooks() Hooks
}
