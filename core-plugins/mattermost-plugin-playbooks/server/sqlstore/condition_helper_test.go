// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestExtractPropertyIDs(t *testing.T) {
	t.Run("simple is condition", func(t *testing.T) {
		condition := app.ConditionExprV1{
			Is: &app.ComparisonCondition{
				FieldID: "severity_id",
				Value:   json.RawMessage(`["critical_id"]`),
			},
		}
		fieldIDs, optionsIDs := condition.ExtractPropertyIDs()
		require.Len(t, fieldIDs, 1)
		require.Contains(t, fieldIDs, "severity_id")
		require.Len(t, optionsIDs, 1)
		require.Contains(t, optionsIDs, "critical_id")
	})

	t.Run("simple isNot condition", func(t *testing.T) {
		condition := app.ConditionExprV1{
			IsNot: &app.ComparisonCondition{
				FieldID: "acknowledged_id",
				Value:   json.RawMessage(`"true"`),
			},
		}
		fieldIDs, optionsIDs := condition.ExtractPropertyIDs()
		require.Len(t, fieldIDs, 1)
		require.Contains(t, fieldIDs, "acknowledged_id")
		require.Len(t, optionsIDs, 0) // text field doesn't extract options
	})

	t.Run("and condition with multiple fields", func(t *testing.T) {
		condition := app.ConditionExprV1{
			And: []app.ConditionExprV1{
				{
					Is: &app.ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &app.ComparisonCondition{
						FieldID: "acknowledged_id",
						Value:   json.RawMessage(`"true"`),
					},
				},
			},
		}
		fieldIDs, _ := condition.ExtractPropertyIDs()
		require.Len(t, fieldIDs, 2)
		require.Contains(t, fieldIDs, "severity_id")
		require.Contains(t, fieldIDs, "acknowledged_id")
	})

	t.Run("or condition with multiple fields", func(t *testing.T) {
		condition := app.ConditionExprV1{
			Or: []app.ConditionExprV1{
				{
					Is: &app.ComparisonCondition{
						FieldID: "status_id",
						Value:   json.RawMessage(`["open_id"]`),
					},
				},
				{
					Is: &app.ComparisonCondition{
						FieldID: "priority_id",
						Value:   json.RawMessage(`["high_priority_id"]`),
					},
				},
			},
		}
		fieldIDs, _ := condition.ExtractPropertyIDs()
		require.Len(t, fieldIDs, 2)
		require.Contains(t, fieldIDs, "status_id")
		require.Contains(t, fieldIDs, "priority_id")
	})

	t.Run("nested conditions with multiple fields", func(t *testing.T) {
		condition := app.ConditionExprV1{
			And: []app.ConditionExprV1{
				{
					Is: &app.ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					Or: []app.ConditionExprV1{
						{
							Is: &app.ComparisonCondition{
								FieldID: "status_id",
								Value:   json.RawMessage(`["open_id"]`),
							},
						},
						{
							IsNot: &app.ComparisonCondition{
								FieldID: "acknowledged_id",
								Value:   json.RawMessage(`"true"`),
							},
						},
					},
				},
			},
		}
		fieldIDs, _ := condition.ExtractPropertyIDs()
		require.Len(t, fieldIDs, 3)
		require.Contains(t, fieldIDs, "severity_id")
		require.Contains(t, fieldIDs, "status_id")
		require.Contains(t, fieldIDs, "acknowledged_id")
	})

	t.Run("duplicate field IDs are deduplicated", func(t *testing.T) {
		condition := app.ConditionExprV1{
			And: []app.ConditionExprV1{
				{
					Is: &app.ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["critical_id"]`),
					},
				},
				{
					IsNot: &app.ComparisonCondition{
						FieldID: "severity_id",
						Value:   json.RawMessage(`["low_id"]`),
					},
				},
			},
		}
		fieldIDs, _ := condition.ExtractPropertyIDs()
		require.Len(t, fieldIDs, 1)
		require.Contains(t, fieldIDs, "severity_id")
	})

	t.Run("empty condition returns empty slice", func(t *testing.T) {
		condition := app.ConditionExprV1{}
		fieldIDs, _ := condition.ExtractPropertyIDs()
		require.Len(t, fieldIDs, 0)
	})

	t.Run("complex nested structure with duplicates", func(t *testing.T) {
		condition := app.ConditionExprV1{
			Or: []app.ConditionExprV1{
				{
					And: []app.ConditionExprV1{
						{
							Is: &app.ComparisonCondition{
								FieldID: "field1",
								Value:   json.RawMessage(`"value1"`),
							},
						},
						{
							IsNot: &app.ComparisonCondition{
								FieldID: "field2",
								Value:   json.RawMessage(`"value2"`),
							},
						},
					},
				},
				{
					Is: &app.ComparisonCondition{
						FieldID: "field1", // duplicate
						Value:   json.RawMessage(`"different_value"`),
					},
				},
				{
					IsNot: &app.ComparisonCondition{
						FieldID: "field3",
						Value:   json.RawMessage(`"value3"`),
					},
				},
			},
		}
		fieldIDs, _ := condition.ExtractPropertyIDs()
		require.Len(t, fieldIDs, 3)
		require.Contains(t, fieldIDs, "field1")
		require.Contains(t, fieldIDs, "field2")
		require.Contains(t, fieldIDs, "field3")
	})
}
