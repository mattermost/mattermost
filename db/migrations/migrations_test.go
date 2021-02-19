// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"io/ioutil"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/stretchr/testify/require"
)

func TestMakeMigrationsHasBeenApplied(t *testing.T) {
	for _, assetName := range AssetNames() {
		asset, err := Asset(assetName)
		require.NoError(t, err)
		fileData, err := ioutil.ReadFile(assetName)
		require.NoError(t, err)

		assert.Equal(t, string(fileData), string(asset), "It looks like that some migrations files have not been added to bindata. Please run `make migrations`")
	}
}
