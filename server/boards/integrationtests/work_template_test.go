package integrationtests

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// This test is there to guarantee that the board templates needed for
// the work template are present in the default templates.
// If this fails, you might need to sync with the channels team.
func TestGetTemplatesForWorkTemplate(t *testing.T) {
	// map[name]trackingTemplateId
	knownInWorkTemplates := map[string]string{
		"Company Goals & OKRs":   "7ba22ccfdfac391d63dea5c4b8cde0de",
		"Competitive Analysis":   "06f4bff367a7c2126fab2380c9dec23c",
		"Content Calendar":       "c75fbd659d2258b5183af2236d176ab4",
		"Meeting Agenda ":        "54fcf9c610f0ac5e4c522c0657c90602",
		"Personal Goals ":        "7f32dc8d2ae008cfe56554e9363505cc",
		"Personal Tasls ":        "dfb70c146a4584b8a21837477c7b5431",
		"Project Tasks ":         "a4ec399ab4f2088b1051c3cdf1dde4c3",
		"Roadmap ":               "b728c6ca730e2cfc229741c5a4712b65",
		"Sales Pipeline CRM":     "ecc250bb7dff0fe02247f1110f097544",
		"Sprint Planner ":        "99b74e26d2f5d0a9b346d43c0a7bfb09",
		"Team Retrospective":     "e4f03181c4ced8edd4d53d33d569a086",
		"User Research Sessions": "6c345c7f50f6833f78b7d0f08ce450a3",
	}
	th := SetupTestHelper(t).InitBasic()
	defer th.TearDown()

	err := th.Server.App().InitTemplates()
	require.NoError(t, err, "InitTemplates should not fail")

	rBoards, resp := th.Client.GetTemplatesForTeam("0")
	th.CheckOK(resp)
	require.NotNil(t, rBoards)

	trackingTemplateIDs := []string{}
	for _, board := range rBoards {
		property, _ := board.GetPropertyString("trackingTemplateId")
		if property != "" {
			trackingTemplateIDs = append(trackingTemplateIDs, property)
		}
	}

	// make sure all known templates are in trackingTemplateIds
	for name, ttID := range knownInWorkTemplates {
		found := false
		for _, trackingTemplateID := range trackingTemplateIDs {
			if trackingTemplateID == ttID {
				found = true
				break
			}
		}
		require.True(t, found, "trackingTemplateId %s for %s not found", ttID, name)
	}
}
