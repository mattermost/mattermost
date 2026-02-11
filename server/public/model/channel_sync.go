package model

import "encoding/json"

// ChannelSyncLayout represents the canonical sidebar layout for a team.
// One layout per team. Managed by System Admins and Team Admins.
type ChannelSyncLayout struct {
	TeamId     string                 `json:"team_id"`
	Categories []*ChannelSyncCategory `json:"categories"`
	UpdateAt   int64                  `json:"update_at"`
	UpdateBy   string                 `json:"update_by"`
}

// ChannelSyncCategory is one category within a canonical layout.
type ChannelSyncCategory struct {
	Id          string   `json:"id"`
	DisplayName string   `json:"display_name"`
	SortOrder   int64    `json:"sort_order"`
	ChannelIds  []string `json:"channel_ids"`
}

// ChannelSyncDismissal tracks a user's dismissal of a Quick Join channel.
type ChannelSyncDismissal struct {
	UserId    string `json:"user_id"`
	ChannelId string `json:"channel_id"`
	TeamId    string `json:"team_id"`
}

// ChannelSyncUserState represents the sync state for a specific user on a team.
// Built at query time, not stored directly.
type ChannelSyncUserState struct {
	TeamId     string                      `json:"team_id"`
	ShouldSync bool                        `json:"should_sync"`
	Categories []*ChannelSyncUserCategory  `json:"categories"`
}

// ChannelSyncUserCategory is a category as seen by a specific user.
// Merges canonical layout with user's personal state (collapsed/muted)
// and filters to only channels the user has joined (plus Quick Join items).
type ChannelSyncUserCategory struct {
	Id          string   `json:"id"`
	DisplayName string   `json:"display_name"`
	SortOrder   int64    `json:"sort_order"`
	Collapsed   bool     `json:"collapsed"`
	Muted       bool     `json:"muted"`
	ChannelIds  []string `json:"channel_ids"`
	QuickJoin   []string `json:"quick_join"`
}

func (l *ChannelSyncLayout) ToJSON() (string, error) {
	b, err := json.Marshal(l)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func ChannelSyncLayoutFromJSON(data string) (*ChannelSyncLayout, error) {
	var layout ChannelSyncLayout
	if err := json.Unmarshal([]byte(data), &layout); err != nil {
		return nil, err
	}
	return &layout, nil
}

func (l *ChannelSyncLayout) IsValid() *AppError {
	if !IsValidId(l.TeamId) {
		return NewAppError("ChannelSyncLayout.IsValid", "model.channel_sync_layout.is_valid.team_id.app_error", nil, "", 400)
	}

	seenIds := make(map[string]bool)
	for _, cat := range l.Categories {
		if cat.Id == "" {
			return NewAppError("ChannelSyncLayout.IsValid", "model.channel_sync_layout.is_valid.category_id.app_error", nil, "", 400)
		}
		if seenIds[cat.Id] {
			return NewAppError("ChannelSyncLayout.IsValid", "model.channel_sync_layout.is_valid.duplicate_category.app_error", nil, "", 400)
		}
		seenIds[cat.Id] = true

		if cat.DisplayName == "" {
			return NewAppError("ChannelSyncLayout.IsValid", "model.channel_sync_layout.is_valid.display_name.app_error", nil, "", 400)
		}
	}

	return nil
}

// FindCategoryForChannel returns the category containing the given channel ID, or nil.
func (l *ChannelSyncLayout) FindCategoryForChannel(channelId string) *ChannelSyncCategory {
	for _, cat := range l.Categories {
		for _, chId := range cat.ChannelIds {
			if chId == channelId {
				return cat
			}
		}
	}
	return nil
}

// AllChannelIds returns a flat set of all channel IDs in the layout.
func (l *ChannelSyncLayout) AllChannelIds() map[string]bool {
	result := make(map[string]bool)
	for _, cat := range l.Categories {
		for _, chId := range cat.ChannelIds {
			result[chId] = true
		}
	}
	return result
}
