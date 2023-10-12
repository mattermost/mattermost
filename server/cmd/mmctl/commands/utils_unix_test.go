// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"io/ioutil"
	"net"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCheckValidSocket(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-54264")
	t.Run("should return error if the file is not a socket", func(t *testing.T) {
		f, err := ioutil.TempFile(os.TempDir(), "mmctl_socket_")
		require.NoError(t, err)
		defer os.Remove(f.Name())
		require.NoError(t, os.Chmod(f.Name(), 0600))

		require.Error(t, checkValidSocket(f.Name()))
	})

	t.Run("should return error if the file has not the right permissions", func(t *testing.T) {
		f, err := ioutil.TempFile(os.TempDir(), "mmctl_socket_")
		require.NoError(t, err)
		require.NoError(t, os.Remove(f.Name()))

		s, err := net.Listen("unix", f.Name())
		require.NoError(t, err)
		defer s.Close()
		require.NoError(t, os.Chmod(f.Name(), 0777))

		require.Error(t, checkValidSocket(f.Name()))
	})

	t.Run("should return nil if the file is a socket and has the right permissions", func(t *testing.T) {
		f, err := ioutil.TempFile(os.TempDir(), "mmctl_socket_")
		require.NoError(t, err)
		require.NoError(t, os.Remove(f.Name()))

		s, err := net.Listen("unix", f.Name())
		require.NoError(t, err)
		defer s.Close()
		require.NoError(t, os.Chmod(f.Name(), 0600))

		require.NoError(t, checkValidSocket(f.Name()))
	})
}
