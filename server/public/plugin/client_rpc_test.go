// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"bytes"
	"encoding/gob"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
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
