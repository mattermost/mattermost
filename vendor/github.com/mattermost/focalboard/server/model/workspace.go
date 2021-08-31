package model

// Workspace is information global to a workspace
// swagger:model
type Workspace struct {
	// ID of the workspace
	// required: true
	ID string `json:"id"`

	// Title of the workspace
	// required: false
	Title string `json:"title"`

	// Token required to register new users
	// required: true
	SignupToken string `json:"signupToken"`

	// Workspace settings
	// required: false
	Settings map[string]interface{} `json:"settings"`

	// ID of user who last modified this
	// required: true
	ModifiedBy string `json:"modifiedBy"`

	// Updated time
	// required: true
	UpdateAt int64 `json:"updateAt"`
}
