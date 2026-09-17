// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestImportBoundary(t *testing.T) {
	t.Parallel()

	cmd := exec.Command("go", "list", "-f", "{{range .Imports}}{{println .}}{{end}}", ".")
	output, err := cmd.CombinedOutput()
	require.NoError(t, err, string(output))

	allowed := map[string]struct{}{
		"github.com/mattermost/mattermost/server/public/model":       {},
		"github.com/mattermost/mattermost/server/public/shared/mlog": {},
	}

	for _, imported := range strings.Fields(string(output)) {
		if isStdLibImport(imported) {
			continue
		}

		_, ok := allowed[imported]
		require.Truef(t, ok, "unexpected import %q", imported)
	}
}

func isStdLibImport(importPath string) bool {
	return !strings.Contains(importPath, ".")
}
