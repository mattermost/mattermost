// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "strings"

// Block action subtypes for DoBlockActionRequest.
// This endpoint is the unification point for post actions and dialog submit/lookup;
// legacy endpoints remain for compatibility.
const (
	BlockActionSubtypeExecute = "execute" // default
	BlockActionSubtypeLookup  = "lookup"
)

// Block action client contexts for DoBlockActionRequest.Context.
const (
	BlockActionContextPost   = "post"
	BlockActionContextDialog = "dialog"
)

// Block action response types returned to the client.
const (
	BlockActionResponseTypeOK      = "ok"
	BlockActionResponseTypeRefresh = "refresh"
	BlockActionResponseTypeDialog  = "dialog"
)

// DoBlockActionRequest is the client → server body for POST /api/v4/actions/blocks/do.
// The integration URL and static Context are resolved from the post or encrypted cookie
// via post_id + action_id — they are not client-supplied.
type DoBlockActionRequest struct {
	// Subtype is execute (default) or lookup.
	Subtype string `json:"subtype,omitempty"`

	// Context identifies where the action was triggered: post or dialog.
	Context string `json:"context"`

	PostId string `json:"post_id"`
	// ChannelId is client-supplied for dialog context only (current channel).
	// Used for ephemeral posts; not forwarded on the upstream integration request.
	ChannelId         string            `json:"channel_id,omitempty"`
	ActionId          string            `json:"action_id"`
	Cookie            string            `json:"cookie,omitempty"`
	SelectedOption    string            `json:"selected_option,omitempty"`
	Query             map[string]string `json:"query,omitempty"`
	FormValues        map[string]any    `json:"form_values,omitempty"`
	IntegrationFormat string            `json:"integration_format,omitempty"`
}

// DoBlockActionResponse is returned synchronously to the client after the upstream
// integration call completes (dialog-style proxying, plus optional post-action side effects).
type DoBlockActionResponse struct {
	TriggerId    string `json:"trigger_id,omitempty"`
	GotoLocation string `json:"goto_location,omitempty"`

	Error  string            `json:"error,omitempty"`
	Errors map[string]string `json:"errors,omitempty"`
	// Type is "", ok, refresh, or dialog.
	// "refresh" updates the current UI: mm_blocks/mm_blocks_actions for posts,
	// or block_dialog for dialogs (based on request Context).
	// "dialog" always opens a new stacked dialog from block_dialog.
	Type string `json:"type,omitempty"`

	// MmBlocks is an opaque block tree from the integration (type "refresh", post context).
	MmBlocks []any `json:"mm_blocks,omitempty"`
	// MmBlocksActions is the opaque encrypted cookie string after AddPostActionCookies.
	MmBlocksActions string `json:"mm_blocks_actions,omitempty"`

	// BlockDialog is used for type "dialog" (new stacked dialog) and for type "refresh"
	// when request Context is dialog. Actions are encrypted before return.
	BlockDialog *BlockDialog `json:"block_dialog,omitempty"`

	// KeepDialogOpen is only meaningful when request Context is dialog. When true, the
	// client leaves the current dialog open (e.g. after stacking a child via dialogs/open).
	KeepDialogOpen bool `json:"keep_dialog_open,omitempty"`

	// Items is populated for subtype lookup.
	Items []DialogSelectOption `json:"items,omitempty"`
}

// NormalizeBlockActionSubtype returns execute or lookup; empty/unknown defaults to execute
// only for empty. Unknown non-empty values return "" so callers can reject them.
func NormalizeBlockActionSubtype(s string) string {
	switch strings.TrimSpace(strings.ToLower(s)) {
	case "", BlockActionSubtypeExecute:
		return BlockActionSubtypeExecute
	case BlockActionSubtypeLookup:
		return BlockActionSubtypeLookup
	default:
		return ""
	}
}

// NormalizeBlockActionContext returns post or dialog. Empty/unknown returns "" so callers can reject them.
func NormalizeBlockActionContext(s string) string {
	switch strings.TrimSpace(strings.ToLower(s)) {
	case BlockActionContextPost:
		return BlockActionContextPost
	case BlockActionContextDialog:
		return BlockActionContextDialog
	default:
		return ""
	}
}
