// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContextMaster(t *testing.T) {
	ctx := context.Background()

	m := WithMaster(ctx)
	assert.True(t, hasMaster(m))
}
