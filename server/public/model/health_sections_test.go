// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSectionErrorsThreeStates(t *testing.T) {
	sectionErrs := SectionErrors{
		SectionServerSoftware: nil,
		SectionLDAPProbe:      errors.New("ldap timeout"),
	}

	err, ok := sectionErrs[SectionSearchProbe]
	require.False(t, ok)
	require.NoError(t, err)

	err, ok = sectionErrs[SectionServerSoftware]
	require.True(t, ok)
	require.NoError(t, err)

	err, ok = sectionErrs[SectionLDAPProbe]
	require.True(t, ok)
	require.EqualError(t, err, "ldap timeout")
}

func TestSectionErrorsFailClosedWithinSection(t *testing.T) {
	diagnostics := &SupportPacketDiagnostics{}
	diagnostics.Server.OpenFileDescriptors = 5000
	diagnostics.Server.MaxFileDescriptors = 0

	node := NodeDiagnostics{
		Diagnostics: diagnostics,
		Errors: SectionErrors{
			SectionServerFDs: errors.New("max file descriptors read failed"),
		},
	}

	_, ok := node.Errors[SectionServerFDs]
	require.True(t, ok)
	require.EqualError(t, node.Errors[SectionServerFDs], "max file descriptors read failed")
	assert.EqualValues(t, 5000, node.Diagnostics.Server.OpenFileDescriptors)
	assert.EqualValues(t, 0, node.Diagnostics.Server.MaxFileDescriptors)
}

func TestNodeAndWorkspaceSectionsDoNotOverlap(t *testing.T) {
	nodeNames := make(map[string]struct{}, len(AllNodeSections()))
	for _, section := range AllNodeSections() {
		nodeNames[string(section)] = struct{}{}
	}

	for _, section := range AllWorkspaceSections() {
		_, exists := nodeNames[string(section)]
		require.False(t, exists, "section %q exists in node and workspace namespaces", section)
	}
}

func TestNodeAccessorSectionConstantsCoveredByAllNodeSections(t *testing.T) {
	nodeSectionsByName := map[string]struct{}{
		"SectionLicense":          {},
		"SectionServerSoftware":   {},
		"SectionServerHost":       {},
		"SectionServerFDs":        {},
		"SectionConfigSource":     {},
		"SectionDatabaseIdentity": {},
		"SectionDatabasePool":     {},
		"SectionDatabaseStats":    {},
		"SectionWebsocket":        {},
		"SectionCluster":          {},
		"SectionSearchEngine":     {},
		"SectionFilestoreDisk":    {},
		"SectionFilestoreConn":    {},
		"SectionLDAPProbe":        {},
		"SectionSAMLProbe":        {},
		"SectionSearchProbe":      {},
		"SectionSMTPProbe":        {},
		"SectionOAuthProbes":      {},
		"SectionPushProbe":        {},
	}

	sectionsInAll := make(map[NodeSection]struct{}, len(AllNodeSections()))
	for _, section := range AllNodeSections() {
		sectionsInAll[section] = struct{}{}
	}

	root := filepath.Join("..", "..", "platform", "shared", "healthcheck")
	if _, err := os.Stat(root); errors.Is(err, os.ErrNotExist) {
		return
	}
	require.NoError(t, filepath.WalkDir(root, func(path string, d os.DirEntry, walkErr error) error {
		require.NoError(t, walkErr)
		if d.IsDir() || filepath.Ext(path) != ".go" {
			return nil
		}

		body, err := os.ReadFile(path)
		require.NoError(t, err)

		matches := regexp.MustCompile(`model\.(Section[A-Za-z0-9_]+)`).FindAllSubmatch(body, -1)
		for _, match := range matches {
			name := string(match[1])
			_, known := nodeSectionsByName[name]
			require.True(t, known, "unexpected section constant %s in %s", name, path)

			nodeSection := NodeSection(constantNameToValue(name))
			_, covered := sectionsInAll[nodeSection]
			require.True(t, covered, "constant %s (%s) missing from AllNodeSections", name, nodeSection)
		}
		return nil
	}))
}

func constantNameToValue(name string) string {
	switch name {
	case "SectionLicense":
		return string(SectionLicense)
	case "SectionServerSoftware":
		return string(SectionServerSoftware)
	case "SectionServerHost":
		return string(SectionServerHost)
	case "SectionServerFDs":
		return string(SectionServerFDs)
	case "SectionConfigSource":
		return string(SectionConfigSource)
	case "SectionDatabaseIdentity":
		return string(SectionDatabaseIdentity)
	case "SectionDatabasePool":
		return string(SectionDatabasePool)
	case "SectionDatabaseStats":
		return string(SectionDatabaseStats)
	case "SectionWebsocket":
		return string(SectionWebsocket)
	case "SectionCluster":
		return string(SectionCluster)
	case "SectionSearchEngine":
		return string(SectionSearchEngine)
	case "SectionFilestoreDisk":
		return string(SectionFilestoreDisk)
	case "SectionFilestoreConn":
		return string(SectionFilestoreConn)
	case "SectionLDAPProbe":
		return string(SectionLDAPProbe)
	case "SectionSAMLProbe":
		return string(SectionSAMLProbe)
	case "SectionSearchProbe":
		return string(SectionSearchProbe)
	case "SectionSMTPProbe":
		return string(SectionSMTPProbe)
	case "SectionOAuthProbes":
		return string(SectionOAuthProbes)
	case "SectionPushProbe":
		return string(SectionPushProbe)
	default:
		return ""
	}
}
