// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchtest

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

const (
	EngineAll           = "all"
	EngineMySql         = "mysql"
	EnginePostgres      = "postgres"
	EngineElasticSearch = "elasticsearch"
	EngineBleve         = "bleve"
)

type SearchTestEngine struct {
	Driver     string
	BeforeTest func(*testing.T, store.Store)
	AfterTest  func(*testing.T, store.Store)
}

type searchTest struct {
	Name        string
	Fn          func(*testing.T, *SearchTestHelper)
	Tags        []string
	Skip        bool
	SkipMessage string
}

func filterTestsByTag(tests []searchTest, tags ...string) []searchTest {
	filteredTests := []searchTest{}
	for _, test := range tests {
		if utils.Contains(test.Tags, EngineAll) {
			filteredTests = append(filteredTests, test)
			continue
		}
		for _, tag := range tags {
			if utils.Contains(test.Tags, tag) {
				filteredTests = append(filteredTests, test)
				break
			}
		}
	}

	return filteredTests
}

func runTestSearch(t *testing.T, testEngine *SearchTestEngine, tests []searchTest, th *SearchTestHelper) {
	if testing.Short() {
		t.Skip("Skipping advanced search test")
		return
	}

	filteredTests := filterTestsByTag(tests, testEngine.Driver)

	for _, test := range filteredTests {

		if test.Skip {
			t.Log("SKIPPED: " + test.Name + ". Reason: " + test.SkipMessage)
			continue
		}

		if testEngine.BeforeTest != nil {
			testEngine.BeforeTest(t, th.Store)
		}
		testName := test.Name
		testFn := test.Fn
		t.Run(testName, func(t *testing.T) { testFn(t, th) })
		if testEngine.AfterTest != nil {
			testEngine.AfterTest(t, th.Store)
		}
	}
}
