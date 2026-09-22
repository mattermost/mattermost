// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "testing"

func TestMemoryStore(t *testing.T) {
	t.Parallel()

	TestFindingStore(t, NewMemoryStore)
}
