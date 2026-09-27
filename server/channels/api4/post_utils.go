// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func userCreatePostPermissionCheckWithContext(c *Context, channelId string) {
	hasPermission := false
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionCreatePost); ok {
		hasPermission = true
	} else if channel, err := c.App.GetChannel(c.AppContext, channelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}
}

func postHardenedModeCheckWithContext(where string, c *Context, props model.StringInterface) {
	if appErr := app.PostHardenedModeCheckWithApp(c.App, c.AppContext.Session().IsIntegration(), props); appErr != nil {
		appErr.Where = where
		c.Err = appErr
	}
}

func postPriorityCheckWithContext(where string, c *Context, priority *model.PostPriority, rootId string) {
	appErr := app.PostPriorityCheckWithApp(where, c.App, c.AppContext, c.AppContext.Session().UserId, priority, rootId)
	if appErr != nil {
		appErr.Where = where
		c.Err = appErr
	}
}

func postCardTypeCheckWithContext(where string, c *Context, postType string) {
	if appErr := app.PostCardTypeCheckWithApp(where, c.App, postType); appErr != nil {
		appErr.Where = where
		c.Err = appErr
	}
}

// postBurnOnReadCheckWithContext runs the channel/participant checks and then
// the ABAC create_burn_on_read_post policy check.
//
// The policy check is here rather than inside PostBurnOnReadCheckWithApp
// because the scheduled-post send job calls that function too: a post that was
// allowed when the user scheduled it must still send, even if the policy has
// since tightened.
//
// It must also stay after the create-post permission check that both callers
// run first. A user who cannot post in the channel at all is refused on that
// basis rather than told burn-on-read is unavailable, and a burn-on-read allow
// must never override a create-post deny.
func postBurnOnReadCheckWithContext(where string, c *Context, post *model.Post, channel *model.Channel) {
	appErr := app.PostBurnOnReadCheckWithApp(where, c.App, c.AppContext, post.UserId, post.ChannelId, post.Type, channel)
	if appErr != nil {
		appErr.Where = where
		c.Err = appErr
		return
	}

	if post.Type != model.PostTypeBurnOnRead {
		return
	}

	if !c.App.HasPermissionToChannelAction(c.AppContext, post.UserId, c.AppContext.Session().Roles, post.ChannelId, model.AccessControlPolicyActionCreateBurnOnReadPost) {
		c.Err = model.NewAppError(where, "api.post.create_post.burn_on_read.abac_denied.app_error", nil, "", http.StatusForbidden)
	}
}

// checkUploadFilePermissionForNewFiles checks upload_file permission only when
// adding new files to a post, preventing permission bypass via cross-channel file attachments.
func checkUploadFilePermissionForNewFiles(c *Context, newFileIds []string, originalPost *model.Post) {
	if len(newFileIds) == 0 {
		return
	}

	originalFileIDsMap := make(map[string]bool, len(originalPost.FileIds))
	for _, fileID := range originalPost.FileIds {
		originalFileIDsMap[fileID] = true
	}

	hasNewFiles := false
	for _, fileID := range newFileIds {
		if !originalFileIDsMap[fileID] {
			hasNewFiles = true
			break
		}
	}

	if hasNewFiles {
		checkUploadFileAttachmentPermission(c, "checkUploadFilePermissionForNewFiles", originalPost.ChannelId)
	}
}

// checkUploadFileAttachmentPermission checks both the upload_file permission and
// the upload_file_attachment permission policy for the channel. Every path that
// uploads a file or attaches one to content in a channel must run it.
func checkUploadFileAttachmentPermission(c *Context, where string, channelID string) {
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelID, model.PermissionUploadFile); !ok {
		c.SetPermissionError(model.PermissionUploadFile)
		return
	}

	if !c.App.HasPermissionToChannelAction(c.AppContext, c.AppContext.Session().UserId, c.AppContext.Session().Roles, channelID, model.AccessControlPolicyActionUploadFileAttachment) {
		c.Err = model.NewAppError(where, "api.file.upload_file.abac_denied.app_error", nil, "", http.StatusForbidden)
	}
}

// checkEditFileAttachmentPermission checks edit_file_attachment permission
// when file IDs are being changed (files added or removed) during post edit.
func checkEditFileAttachmentPermission(c *Context, newFileIds []string, originalPost *model.Post) {
	if utils.SliceEqualUnordered(newFileIds, originalPost.FileIds) {
		return
	}
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditFileAttachment); !ok {
		c.SetPermissionError(model.PermissionEditFileAttachment)
	}
}

// postAttributeValuesForCreate turns the submitted metadata values into PropertyValues to
// write with the post.
//
// With the flag off and nothing submitted this returns (nil, nil) without touching the
// property store, which is what keeps createPost byte-identical to its pre-feature
// behaviour — the reason this is safe to add to the most-used endpoint in the product.
//
// Errors never name an attribute: which attributes a server defines is itself sensitive,
// and the caller may not be allowed to see them.
func postAttributeValuesForCreate(c *Context, post *model.Post, channel *model.Channel) ([]*model.PropertyValue, *model.AppError) {
	items := post.Metadata.GetPropertyValues()

	if !c.App.Config().FeatureFlags.PostAttributes {
		if len(items) > 0 {
			return nil, model.NewAppError("Api4.createPost", "api.post.create_post.attributes_feature_disabled.app_error", nil, "", http.StatusBadRequest)
		}
		return nil, nil
	}

	if len(items) == 0 {
		return nil, nil
	}

	group, appErr := c.App.GetPropertyGroup(c.AppContext, model.PostAttributesPropertyGroupName)
	if appErr != nil {
		return nil, appErr
	}

	// One call covers all three scopes a post's fields can come from: the system, the
	// post's team and its channel.
	fields, appErr := c.App.SearchPropertyFields(c.AppContext, group.ID, model.PropertyFieldSearchOpts{
		ObjectTypes: []string{model.PropertyFieldObjectTypePost},
		ChannelID:   channel.Id,
		TeamID:      channel.TeamId,
		PerPage:     model.PostAttributesMaxApplicableFields + 1,
	})
	if appErr != nil {
		return nil, appErr
	}

	// If the per-target cap was ever bypassed elsewhere, the page here may be truncated and
	// a legitimate field could look unknown to this request.
	fieldByID := make(map[string]*model.PropertyField, len(fields))
	for _, field := range fields {
		fieldByID[field.ID] = field
	}

	seen := make(map[string]bool, len(items))
	values := make([]*model.PropertyValue, 0, len(items))
	for _, item := range items {
		// The client submits full PropertyValue structs, so everything the server owns has
		// to be rejected rather than quietly dropped: a caller that sent an ID or a
		// TargetID meant something by it and should not be told the write succeeded as
		// asked.
		if item.ID != "" || item.GroupID != "" || item.TargetID != "" || item.TargetType != "" ||
			item.CreateAt != 0 || item.UpdateAt != 0 || item.CreatedBy != "" || item.UpdatedBy != "" {
			return nil, model.NewAppError("Api4.createPost", "api.post.create_post.invalid_attribute.app_error", nil, "server-owned field set by client", http.StatusBadRequest)
		}
		if !model.IsValidId(item.FieldID) {
			return nil, model.NewAppError("Api4.createPost", "api.post.create_post.invalid_attribute.app_error", nil, "invalid field id", http.StatusBadRequest)
		}
		if seen[item.FieldID] {
			return nil, model.NewAppError("Api4.createPost", "api.post.create_post.invalid_attribute.app_error", nil, "duplicate field", http.StatusBadRequest)
		}
		field, ok := fieldByID[item.FieldID]
		if !ok {
			return nil, model.NewAppError("Api4.createPost", "api.post.create_post.invalid_attribute.app_error", nil, "unknown field", http.StatusBadRequest)
		}
		if !c.App.CanSetPostPropertyValueOnCreate(c.AppContext, c.AppContext.Session().UserId, field, channel) {
			return nil, model.NewAppError("Api4.createPost", "api.post.create_post.attribute_no_permission.app_error", nil, "", http.StatusForbidden)
		}

		seen[item.FieldID] = true
		values = append(values, &model.PropertyValue{
			GroupID: group.ID,
			FieldID: field.ID,
			Value:   item.Value,
		})
	}

	return values, nil
}
