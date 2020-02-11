// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

type Mutex interface {
	Lock()
	Unlock()
}

type MutexProvider interface {
	NewMutex(name string) Mutex
}
