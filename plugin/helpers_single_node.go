// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import "fmt"

// RunOnSingleNode implements Helper.RunOnSingleNode
func (p *HelpersImpl) RunOnSingleNode(id string, f func()) (bool, error) {
	err := p.ensureServerVersion("5.12.0")
	if err != nil {
		return false, err
	}

	id = fmt.Sprintf("%s%s", RUN_SINGLE_NODE_KEY_PREFIX, id)
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
