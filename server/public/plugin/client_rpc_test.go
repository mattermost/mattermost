// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"bytes"
	"encoding/gob"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/rpc"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestReceiveSharedChannelAttachmentSyncMsgReturns_GobRoundTrip pins the fix
// for the gob-encoding bug in apiRPCServer.ReceiveSharedChannelAttachmentSyncMsg.
// The hook may return errors wrapped with fmt.Errorf("...%w", err), producing
// values of the unexported type *fmt.wrapError that gob refuses to encode.
// The RPC server must run the error through encodableError before assigning
// it to the returns struct. Without that, the RPC connection breaks and
// every subsequent plugin to server call returns zero values.
func TestReceiveSharedChannelAttachmentSyncMsgReturns_GobRoundTrip(t *testing.T) {
	wrapped := fmt.Errorf("attachment sync failed: %w", errors.New("upstream boom"))

	t.Run("raw wrapped error fails to gob-encode (reproduces the bug)", func(t *testing.T) {
		returns := Z_ReceiveSharedChannelAttachmentSyncMsgReturns{B: wrapped}

		var buf bytes.Buffer
		err := gob.NewEncoder(&buf).Encode(&returns)
		require.Error(t, err, "raw *fmt.wrapError must not be gob-encodable; if this assertion ever fails the bug guarded by encodableError no longer exists")
		require.Contains(t, err.Error(), "fmt.wrapError")
	})

	t.Run("encodableError-wrapped error round-trips through gob", func(t *testing.T) {
		returns := Z_ReceiveSharedChannelAttachmentSyncMsgReturns{B: encodableError(wrapped)}

		var buf bytes.Buffer
		require.NoError(t, gob.NewEncoder(&buf).Encode(&returns))

		var decoded Z_ReceiveSharedChannelAttachmentSyncMsgReturns
		require.NoError(t, gob.NewDecoder(&buf).Decode(&decoded))
		require.Error(t, decoded.B)
		require.Equal(t, wrapped.Error(), decoded.B.Error())
	})
}

// TestKVListWithOptionsRPCErrors pins the AppError status codes that
// pluginapi's ListKeys relies on to decide whether to fall back to KVList.
func TestKVListWithOptionsRPCErrors(t *testing.T) {
	t.Run("server without the method returns StatusNotImplemented", func(t *testing.T) {
		serverConnection, clientConnection := net.Pipe()
		server := rpc.NewServer()
		require.NoError(t, server.RegisterName("Plugin", &legacyRPCServer{}))
		go server.ServeConn(serverConnection)

		client := rpc.NewClient(clientConnection)
		defer client.Close()

		keys, appErr := (&apiRPCClient{client: client}).KVListWithOptions(0, 10, model.PluginKVListOptions{Prefix: "p_"})
		require.Nil(t, keys)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
	})

	t.Run("other RPC failures return StatusInternalServerError", func(t *testing.T) {
		_, clientConnection := net.Pipe()
		client := rpc.NewClient(clientConnection)
		require.NoError(t, client.Close())

		keys, appErr := (&apiRPCClient{client: client}).KVListWithOptions(0, 10, model.PluginKVListOptions{Prefix: "p_"})
		require.Nil(t, keys)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}
