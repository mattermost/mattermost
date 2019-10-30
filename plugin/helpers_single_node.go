// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

// RunOnSingleNode is a wrapper function which makes function f run on a single node only and only once
// The id parameter is an identifier that uses for synchronization must be unique between each function.
func (p *HelpersImpl) RunOnSingleNode(id string, f func()) (bool, error) {
	updated, err := p.KVCompareAndSetJSON(id, nil, true)
	if err != nil {
		return false, err
	}

	if !updated {
		return false, nil
	}
	f()
	return true, nil
}
