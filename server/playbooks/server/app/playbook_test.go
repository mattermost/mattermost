package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlaybook_MarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		original Playbook
		expected []byte
		wantErr  bool
	}{
		{
			name: "marshals a struct with nil slices into empty arrays",
			original: Playbook{
				ID:                          "playbookid",
				Title:                       "the playbook title",
				Description:                 "the playbook's description",
				TeamID:                      "theteamid",
				CreatePublicPlaybookRun:     true,
				CreateAt:                    4503134,
				DeleteAt:                    0,
				NumStages:                   0,
				NumSteps:                    0,
				Checklists:                  nil,
				Members:                     nil,
				BroadcastChannelIDs:         []string{"channelid"},
				ReminderMessageTemplate:     "This is a message",
				ReminderTimerDefaultSeconds: 0,
				InvitedUserIDs:              nil,
				InvitedGroupIDs:             nil,
			},
			expected: []byte(`"checklists":[]`),
			wantErr:  false,
		},
		{
			name: "marshals a struct with nil []checklistItems into an empty array",
			original: Playbook{
				ID:                      "playbookid",
				Title:                   "the playbook title",
				Description:             "the playbook's description",
				TeamID:                  "theteamid",
				CreatePublicPlaybookRun: true,
				CreateAt:                4503134,
				DeleteAt:                0,
				NumStages:               0,
				NumSteps:                0,
				Checklists: []Checklist{
					{
						ID:    "checklist1",
						Title: "checklist 1",
						Items: nil,
					},
				},
				BroadcastChannelIDs:          []string{},
				ReminderMessageTemplate:      "This is a message",
				ReminderTimerDefaultSeconds:  0,
				InvitedUserIDs:               nil,
				InvitedGroupIDs:              nil,
				WebhookOnStatusUpdateURLs:    []string{"testurl"},
				WebhookOnStatusUpdateEnabled: true,
			},
			expected: []byte(`"checklists":[{"id":"checklist1","title":"checklist 1","items":[]}]`),
			wantErr:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(tt.original)
			if (err != nil) != tt.wantErr {
				t.Errorf("MarshalJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			require.Contains(t, string(got), string(tt.expected))
		})
	}
}

func TestPlaybookFilterOptions_Clone(t *testing.T) {
	options := PlaybookFilterOptions{
		Page:      1,
		PerPage:   10,
		Sort:      SortByID,
		Direction: DirectionAsc,
	}
	marshalledOptions, err := json.Marshal(options)
	require.NoError(t, err)

	clone := options.Clone()
	clone.Page = 2
	clone.PerPage = 20
	clone.Sort = SortByName
	clone.Direction = DirectionDesc

	var unmarshalledOptions PlaybookFilterOptions
	err = json.Unmarshal(marshalledOptions, &unmarshalledOptions)
	require.NoError(t, err)
	require.Equal(t, options, unmarshalledOptions)
}

func TestPlaybookFilterOptions_Validate(t *testing.T) {
	t.Run("non-positive PerPage", func(t *testing.T) {
		options := PlaybookFilterOptions{
			PerPage: -1,
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, PerPageDefault, validOptions.PerPage)
	})

	t.Run("invalid sort option", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Sort: SortField("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case sort option", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Sort: SortField("STAges"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, SortByStages, validOptions.Sort)
	})

	t.Run("valid, no explicit sort option", func(t *testing.T) {
		options := PlaybookFilterOptions{}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, SortByID, validOptions.Sort)
	})

	t.Run("invalid sort direction", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Direction: SortDirection("invalid"),
		}

		_, err := options.Validate()
		require.Error(t, err)
	})

	t.Run("valid, but wrong case direction option", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Direction: SortDirection("DEsC"),
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, DirectionDesc, validOptions.Direction)
	})

	t.Run("valid, no explicit direction", func(t *testing.T) {
		options := PlaybookFilterOptions{}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, DirectionAsc, validOptions.Direction)
	})

	t.Run("valid", func(t *testing.T) {
		options := PlaybookFilterOptions{
			Page:      1,
			PerPage:   10,
			Sort:      SortByTitle,
			Direction: DirectionAsc,
		}

		validOptions, err := options.Validate()
		require.NoError(t, err)
		require.Equal(t, options, validOptions)
	})
}
