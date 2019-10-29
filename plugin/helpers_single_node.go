// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
)


// RunOnSingleNode is a wrapper function which makes function f run only once on a single node.
// The id parameter is an identifier that uses for synchronization must be unique between each function.
func (p *HelpersImpl) RunOnSingleNode(id string, f func()) (bool, error) {
	id = fmt.Sprintf("%s_%s", id, p.API.GetDiagnosticId())

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
