// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

type ConditionExprV1TestCase struct {
	Name       string          `json:"name"`
	Fields     []PropertyField `json:"fields"`
	Values     []PropertyValue `json:"values"`
	Condition  ConditionExprV1 `json:"condition"`
	ShouldPass bool            `json:"shouldPass"`
}

func TestConditionJSONTestCases(t *testing.T) {
	// Read the JSON file
	jsonPath := filepath.Join("..", "..", "testdata", "condition-test-cases.json")
	jsonData, err := os.ReadFile(jsonPath)
	require.NoError(t, err, "Failed to read JSON test cases file")

	var testCases []ConditionExprV1TestCase
	err = json.Unmarshal(jsonData, &testCases)
	require.NoError(t, err, "Failed to unmarshal JSON test cases")

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			result := tc.Condition.Evaluate(tc.Fields, tc.Values)
			if tc.ShouldPass {
				require.True(t, result, "Expected condition to pass but it failed")
			} else {
				require.False(t, result, "Expected condition to fail but it passed")
			}
		})
	}
}
