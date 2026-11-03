// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build unix

package model

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestAdvancedLoggingJSONCertPathIsNotRead(t *testing.T) {
	for name, audit := range map[string]bool{"log settings": false, "audit settings": true} {
		t.Run(name, func(t *testing.T) {
			fifo := filepath.Join(t.TempDir(), "cert.fifo")
			require.NoError(t, syscall.Mkfifo(fifo, 0600))

			raw := advancedLoggingTargetJSON(t, "syslog", audit, map[string]any{
				"host":     "127.0.0.1",
				"port":     closedTCPPort(t),
				"tls":      true,
				"cert":     fifo,
				"insecure": true,
			})

			returned := make(chan struct{})
			go func() {
				_ = validateAdvancedLoggingJSON(audit, raw)
				close(returned)
			}()

			select {
			case <-returned:
			case <-time.After(2 * time.Second):
				// Unblock the reader so the test process can exit.
				writer, err := os.OpenFile(fifo, os.O_WRONLY, 0)
				if err == nil {
					_ = writer.Close()
				}
				select {
				case <-returned:
				case <-time.After(2 * time.Second):
				}
				require.FailNow(t, "returns within the time bound")
			}
		})
	}
}
