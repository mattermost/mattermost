// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import "sync"

type MutexProvider interface {
	NewMutex(name string) sync.Locker
}
