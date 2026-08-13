// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConnCreateTimeout(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	*th.App.Config().SqlSettings.QueryTimeout = 0

	d := NewDriverImpl(th.Server)
	_, err := d.Conn(true)
	require.Error(t, err)
}

func TestShutdownPluginConns(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	d := NewDriverImpl(th.Server)
	_, err := d.ConnWithPluginID(true, "plugin1")
	require.NoError(t, err)
	_, err = d.ConnWithPluginID(true, "plugin2")
	require.NoError(t, err)
	_, err = d.ConnWithPluginID(true, "plugin1")
	require.NoError(t, err)

	require.Len(t, d.connMap, 3)
	d.ShutdownConns("plugin1")
	require.Len(t, d.connMap, 1)
	d.ShutdownConns("plugin2")
	require.Len(t, d.connMap, 0)
}
