// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	mainStoreTypes = initStores(false)

	status := m.Run()

	for _, st := range mainStoreTypes {
		_ = st.Store.Shutdown()
		_ = st.Logger.Shutdown()
	}

	os.Exit(status)
}
