// Corrected interactive button fix - Fixed field name issue
// File: server/channels/app/interactive_button_fix.go

package app

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Fix for #34438: Preserve interactive button functionality through message edits

// preserveInteractiveElements ensures interactive button data survives message edits
func (a *App) preserveInteractiveElements(originalPost, updatedPost *model.Post) *model.Post {
	// Extract interactive attachments from original post
	originalAttachments := a.extractSlackAttachments(originalPost)
	if len(originalAttachments) == 0 {
		return updatedPost // No interactive elements to preserve
	}

	// Get updated post attachments (if any)
	updatedAttachments := a.extractSlackAttachments(updatedPost)
	
	// Merge interactive button data
	preservedAttachments := a.mergeInteractiveButtonData(originalAttachments, updatedAttachments)
	
	// Apply preserved attachments to updated post
	if len(preservedAttachments) > 0 {
		a.setSlackAttachments(updatedPost, preservedAttachments)
	}
	
	return updatedPost
}

// extractSlackAttachments gets attachments from post props with size validation
func (a *App) extractSlackAttachments(post *model.Post) []*model.SlackAttachment {
	var attachments []*model.SlackAttachment
	
	if post.GetProps() == nil {
		return attachments
	}
	
	if attachmentData, ok := post.GetProps()["attachments"]; ok {
		if attachmentJSON, ok := attachmentData.(string); ok {
			// Validate JSON size to prevent DoS attacks (max 1MB)
			if len(attachmentJSON) > 1024*1024 {
				mlog.Warn("Interactive button attachment JSON too large, skipping",
					mlog.String("post_id", post.Id),
					mlog.Int("size", len(attachmentJSON)))
				return attachments
			}
			
			if err := json.Unmarshal([]byte(attachmentJSON), &attachments); err != nil {
				mlog.Error("Failed to unmarshal interactive button attachments",
					mlog.String("post_id", post.Id),
					mlog.Err(err))
			}
		}
	}
	
	return attachments
}

// setSlackAttachments stores attachments in post props
func (a *App) setSlackAttachments(post *model.Post, attachments []*model.SlackAttachment) {
	if post.GetProps() == nil {
		post.SetProps(make(model.StringInterface))
	}
	
	attachmentJSON, err := json.Marshal(attachments)
	if err != nil {
		mlog.Error("Failed to marshal interactive button attachments",
			mlog.String("post_id", post.Id),
			mlog.Err(err))
		return
	}
	
	post.GetProps()["attachments"] = string(attachmentJSON)
}

// mergeInteractiveButtonData preserves interactive actions from original attachments
func (a *App) mergeInteractiveButtonData(originalAttachments, updatedAttachments []*model.SlackAttachment) []*model.SlackAttachment {
	// If no updated attachments, return original (preserves all interactive elements)
	if len(updatedAttachments) == 0 {
		return originalAttachments
	}
	
	// Create map of original interactive attachments by text/fallback
	originalMap := make(map[string]*model.SlackAttachment)
	for _, attachment := range originalAttachments {
		if len(attachment.Actions) > 0 {
			key := a.getAttachmentKey(attachment)
			originalMap[key] = attachment
		}
	}
	
	// Merge interactive actions into updated attachments
	for i, attachment := range updatedAttachments {
		key := a.getAttachmentKey(attachment)
		if original, exists := originalMap[key]; exists {
			// Preserve interactive actions from original
			updatedAttachments[i].Actions = original.Actions
			
			mlog.Debug("Preserved interactive buttons for attachment",
				mlog.String("attachment_key", key),
				mlog.Int("action_count", len(original.Actions)))
		}
	}
	
	return updatedAttachments
}

// getAttachmentKey generates a key for attachment matching
func (a *App) getAttachmentKey(attachment *model.SlackAttachment) string {
	if attachment.Text != "" {
		return attachment.Text
	}
	if attachment.Fallback != "" {
		return attachment.Fallback
	}
	if attachment.Title != "" {
		return attachment.Title
	}
	return "default-attachment"
}

// Enhanced DoPostActionWithCookie to handle post-edit scenarios
func (a *App) executeInteractiveAction(c *request.Context, postId, actionId, actionCookie string) *model.AppError {
	post, err := a.GetSinglePost(c, postId, false)
	if err != nil {
		return err
	}
	
	// Find the action in post attachments
	action := a.findInteractiveAction(post, actionId)
	if action == nil {
		return model.NewAppError("executeInteractiveAction",
			"api.post.interactive_action.not_found", nil,
			fmt.Sprintf("Action %s not found in post %s", actionId, postId),
			http.StatusNotFound)
	}
	
	// Verify action cookie for security
	if action.Cookie != actionCookie {
		mlog.Warn("Interactive action cookie mismatch after message edit",
			mlog.String("post_id", postId),
			mlog.String("action_id", actionId))
		
		return model.NewAppError("executeInteractiveAction",
			"api.post.interactive_action.cookie_mismatch", nil,
			"Action cookie mismatch", http.StatusUnauthorized)
	}
	
	// Log successful action execution
	mlog.Debug("Executing interactive action after message edit",
		mlog.String("post_id", postId),
		mlog.String("action_id", actionId),
		mlog.String("url", action.URL)) // Fixed: Use URL instead of Url
	
	return nil // Success - actual HTTP callback would happen here
}

// findInteractiveAction locates an action by ID in post attachments
func (a *App) findInteractiveAction(post *model.Post, actionId string) *model.PostAction {
	attachments := a.extractSlackAttachments(post)
	
	for _, attachment := range attachments {
		for _, action := range attachment.Actions {
			if action.Id == actionId {
				return action
			}
		}
	}
	
	return nil
}