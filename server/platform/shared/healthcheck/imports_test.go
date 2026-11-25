// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The engine, the rules and the packet reader run inside mmctl, so they must not pull in the
// server. The one exception is the config package: AUDIT_LOG_OFF falls back to
// config.IsAuditLoggingActive for packets from servers that do not record their audit logging
// state. Remove it with that fallback.
func TestImportsStayOutOfTheServer(t *testing.T) {
	const server = "github.com/mattermost/mattermost/server/v8"
	const tree = server + "/platform/shared/healthcheck"
	allowed := map[string]bool{server + "/config": true}

	out, err := exec.Command("go", "list", "-f", "{{.ImportPath}}{{range .Imports}} {{.}}{{end}}", "./...").Output()
	require.NoError(t, err)

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	require.Greater(t, len(lines), 1, "expected the rules and packet packages too")
	for _, line := range lines {
		fields := strings.Fields(line)
		for _, imported := range fields[1:] {
			fromServer := imported == server || strings.HasPrefix(imported, server+"/")
			inTree := imported == tree || strings.HasPrefix(imported, tree+"/")
			if fromServer && !inTree && !allowed[imported] {
				assert.Failf(t, "import from the server", "%s imports %s", fields[0], imported)
			}
		}
	}
}
