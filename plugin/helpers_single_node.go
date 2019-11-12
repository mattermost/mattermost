// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import "fmt"

// RunOnSingleNode is a wrapper function which should guarantee that only one plugin instance can run a function associated with the given id at a time
// The id parameter is an identifier that uses for synchronization must be unique between each function.
func (p *HelpersImpl) RunOnSingleNode(id string, f func()) (bool, error) {
	err := p.ensureServerVersion("5.12.0")
	if err != nil {
		return false, err
	}

	id = fmt.Sprintf("runOnSingleNodeLock:%s", id)

	updated, appErr := p.API.KVCompareAndSet(id, nil, []byte("lock"))
	if appErr != nil {
		return false, appErr
	}
	if !updated {
		return false, nil
	}

	f()

	appErr = p.API.KVDelete(id)
	if appErr != nil {
		return true, appErr
	}
	return true, nil
}
