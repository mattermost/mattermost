// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
)

func TestWriteMarker(t *testing.T) {
	t.Run("no marker is a standard write", func(t *testing.T) {
		assert.Equal(t, WriteMarker{}, WriteMarkerFromContext(request.TestContext(t)))
	})
}
