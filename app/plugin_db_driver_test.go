// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConnCreateTimeout(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	*th.App.Config().SqlSettings.QueryTimeout = 0

	d := NewDriverImpl(th.Server)
	_, err := d.Conn(true)
	require.Error(t, err)
}

