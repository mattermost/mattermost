package model

import (
	"encoding/json"
	"io"
)

// Sharing is sharing information for a root block
// swagger:model
type Sharing struct {
	// ID of the root block
	// required: true
	ID string `json:"id"`

	// Is sharing enabled
	// required: true
	Enabled bool `json:"enabled"`

	// Access token
	// required: true
	Token string `json:"token"`

	// ID of the user who last modified this
	// required: true
	ModifiedBy string `json:"modifiedBy"`

	// Updated time
	// required: true
	UpdateAt int64 `json:"update_at,omitempty"`
}

func SharingFromJSON(data io.Reader) Sharing {
	var sharing Sharing
	_ = json.NewDecoder(data).Decode(&sharing)
	return sharing
}
