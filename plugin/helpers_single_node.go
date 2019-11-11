// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import "errors"

// RunOnSingleNode is a wrapper function which should guarantee that only one plugin instance can run a function associated with the given id at a time
// The id parameter is an identifier that uses for synchronization must be unique between each function.
func (p *HelpersImpl) RunOnSingleNode(id string, f func()) (bool, error) {
	updated, err := p.KVCompareAndSetJSON(id, nil, true)
	if err != nil {
		return false, err
	} else if !updated {
		return false, nil
	}

	f()

	success, err := p.KVCompareAndDeleteJSON(id, true)
	if err != nil {
		return true, err
	} else if !success {
		return true, errors.New("unable to unlock lock mechanism")
	}
	return true, nil
}
