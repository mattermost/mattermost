// Corrected test file for interactive button fix
// File: server/channels/app/interactive_button_fix_test.go

package app

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInteractiveButtonsAfterEdit(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	t.Run("interactive buttons should work after message edit", func(t *testing.T) {
		// Create post with interactive button
		attachment := &model.SlackAttachment{
			Text: "Approval needed",
			Actions: []*model.PostAction{
				{
					Id:     "approve-btn",
					Name:   "Approve",
					Url:    "https://example.com/approve", // Fixed: Use Url instead of URL
					Cookie: "test-cookie-123",
				},
			},
		}

		attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
		originalPost := &model.Post{
			Id:        "test-post-id",
			UserId:    "test-user-id",
			ChannelId: "test-channel-id",
			Message:   "Please approve this request",
		}
		originalPost.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		// Create edited post (simulating message edit)
		editedPost := originalPost.Clone()
		editedPost.Message = "URGENT: Please approve this request"
		
		// Apply the fix
		preservedPost := th.App.preserveInteractiveElements(originalPost, editedPost)
		
		// Verify button data is preserved
		preservedAttachments := th.App.extractSlackAttachments(preservedPost)
		
		require.Len(t, preservedAttachments, 1)
		require.Len(t, preservedAttachments[0].Actions, 1)
		
		action := preservedAttachments[0].Actions[0]
		assert.Equal(t, "approve-btn", action.Id)
		assert.Equal(t, "Approve", action.Name)
		assert.Equal(t, "https://example.com/approve", action.Url) // Fixed: Use Url
		assert.Equal(t, "test-cookie-123", action.Cookie)
	})

	t.Run("should find interactive actions by ID", func(t *testing.T) {
		attachment := &model.SlackAttachment{
			Actions: []*model.PostAction{
				{Id: "action-1", Name: "Button 1", Url: "https://example.com/1"},
				{Id: "action-2", Name: "Button 2", Url: "https://example.com/2"},
			},
		}

		attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
		post := &model.Post{Id: "test-post"}
		post.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		// Find existing action
		action := th.App.findInteractiveAction(post, "action-2")
		require.NotNil(t, action)
		assert.Equal(t, "action-2", action.Id)
		assert.Equal(t, "Button 2", action.Name)

		// Try to find non-existent action
		action = th.App.findInteractiveAction(post, "non-existent")
		assert.Nil(t, action)
	})

	t.Run("should handle large attachment JSON safely", func(t *testing.T) {
		// Create a very large attachment JSON to test DoS protection
		largeAttachment := &model.SlackAttachment{
			Text: string(make([]byte, 2*1024*1024)), // 2MB of data
		}

		largeAttachmentJSON, _ := json.Marshal([]*model.SlackAttachment{largeAttachment})
		post := &model.Post{Id: "test-post"}
		post.SetProps(map[string]interface{}{
			"attachments": string(largeAttachmentJSON),
		})

		// Should return empty slice due to size validation
		attachments := th.App.extractSlackAttachments(post)
		assert.Empty(t, attachments, "Large attachments should be rejected")
	})

	t.Run("should preserve multiple interactive buttons", func(t *testing.T) {
		// Create multiple attachments with buttons
		attachments := []*model.SlackAttachment{
			{
				Text: "First approval",
				Actions: []*model.PostAction{
					{Id: "approve-1", Name: "Approve 1", Url: "https://example.com/approve1"},
				},
			},
			{
				Text: "Second approval", 
				Actions: []*model.PostAction{
					{Id: "approve-2", Name: "Approve 2", Url: "https://example.com/approve2"},
				},
			},
		}

		attachmentJSON, _ := json.Marshal(attachments)
		originalPost := &model.Post{Id: "test-post"}
		originalPost.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		editedPost := originalPost.Clone()
		editedPost.Message = "Updated message"

		// Apply preservation
		preserved := th.App.preserveInteractiveElements(originalPost, editedPost)
		preservedAttachments := th.App.extractSlackAttachments(preserved)

		// Verify all buttons are preserved
		require.Len(t, preservedAttachments, 2)
		assert.Len(t, preservedAttachments[0].Actions, 1)
		assert.Len(t, preservedAttachments[1].Actions, 1)
		assert.Equal(t, "approve-1", preservedAttachments[0].Actions[0].Id)
		assert.Equal(t, "approve-2", preservedAttachments[1].Actions[0].Id)
	})
}

func TestPreserveInteractiveElements(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	t.Run("should preserve interactive elements from original post", func(t *testing.T) {
		// Original post with interactive elements
		originalAttachment := &model.SlackAttachment{
			Text: "Original attachment",
			Actions: []*model.PostAction{
				{
					Id:     "original-action",
					Name:   "Original Button",
					Url:    "https://example.com/original",
					Cookie: "original-cookie",
				},
			},
		}

		originalAttachmentJSON, _ := json.Marshal([]*model.SlackAttachment{originalAttachment})
		originalPost := &model.Post{
			Id:      "original-post-id",
			Message: "Original message",
		}
		originalPost.SetProps(map[string]interface{}{
			"attachments": string(originalAttachmentJSON),
		})

		// Updated post without interactive elements
		updatedPost := &model.Post{
			Id:      "original-post-id",
			Message: "Updated message",
		}

		// Preserve interactive elements
		result := th.App.preserveInteractiveElements(originalPost, updatedPost)

		// Verify interactive elements were preserved
		resultAttachments := th.App.extractSlackAttachments(result)
		
		require.Len(t, resultAttachments, 1)
		require.Len(t, resultAttachments[0].Actions, 1)
		
		action := resultAttachments[0].Actions[0]
		assert.Equal(t, "original-action", action.Id)
		assert.Equal(t, "Original Button", action.Name)
		assert.Equal(t, "https://example.com/original", action.Url)
		assert.Equal(t, "original-cookie", action.Cookie)
	})

	t.Run("should handle posts without attachments", func(t *testing.T) {
		originalPost := &model.Post{
			Id:      "test-post-id",
			Message: "No attachments here",
		}

		updatedPost := &model.Post{
			Id:      "test-post-id", 
			Message: "Still no attachments",
		}

		result := th.App.preserveInteractiveElements(originalPost, updatedPost)
		
		// Should not crash and should return the updated post unchanged
		assert.Equal(t, "Still no attachments", result.Message)
		attachments := th.App.extractSlackAttachments(result)
		assert.Empty(t, attachments)
	})
}

func TestFindInteractiveAction(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	t.Run("should find action by ID in post attachments", func(t *testing.T) {
		attachment := &model.SlackAttachment{
			Text: "Test attachment",
			Actions: []*model.PostAction{
				{
					Id:   "action-1",
					Name: "First Action",
					Url:  "https://example.com/1",
				},
				{
					Id:   "action-2", 
					Name: "Second Action",
					Url:  "https://example.com/2",
				},
			},
		}

		attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
		post := &model.Post{
			Id:      "test-post",
			Message: "Test message",
		}
		post.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		// Find existing action
		action := th.App.findInteractiveAction(post, "action-2")
		require.NotNil(t, action)
		assert.Equal(t, "action-2", action.Id)
		assert.Equal(t, "Second Action", action.Name)

		// Try to find non-existent action
		action = th.App.findInteractiveAction(post, "non-existent")
		assert.Nil(t, action)
	})
}