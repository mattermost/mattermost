// Interactive button test - Production-ready final version
// File: server/channels/app/interactive_button_fix_test.go

package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPreserveInteractiveElements(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	t.Run("should preserve interactive buttons after message edit", func(t *testing.T) {
		// Create post with interactive button
		attachment := &model.SlackAttachment{
			Text: "Approval needed",
			Actions: []*model.PostAction{
				{
					Id:     "approve-btn",
					Name:   "Approve",
					URL:    "https://example.com/approve",
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

		// Apply the preservation fix
		preservedPost := th.App.PreserveInteractiveElements(originalPost, editedPost)

		// Verify button data is preserved
		preservedAttachments := th.App.extractSlackAttachments(preservedPost)

		require.Len(t, preservedAttachments, 1)
		require.Len(t, preservedAttachments[0].Actions, 1)

		action := preservedAttachments[0].Actions[0]
		assert.Equal(t, "approve-btn", action.Id)
		assert.Equal(t, "Approve", action.Name)
		assert.Equal(t, "https://example.com/approve", action.URL)
		assert.Equal(t, "test-cookie-123", action.Cookie)
	})

	t.Run("should handle nil posts gracefully", func(t *testing.T) {
		// Test with nil original post
		result := th.App.PreserveInteractiveElements(nil, &model.Post{})
		assert.NotNil(t, result)

		// Test with nil updated post
		result = th.App.PreserveInteractiveElements(&model.Post{}, nil)
		assert.Nil(t, result)

		// Test with both nil
		result = th.App.PreserveInteractiveElements(nil, nil)
		assert.Nil(t, result)
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

		result := th.App.PreserveInteractiveElements(originalPost, updatedPost)

		// Should return the updated post unchanged
		assert.Equal(t, "Still no attachments", result.Message)
		attachments := th.App.extractSlackAttachments(result)
		assert.Empty(t, attachments)
	})

	t.Run("should preserve multiple interactive buttons", func(t *testing.T) {
		// Create multiple attachments with buttons
		attachments := []*model.SlackAttachment{
			{
				Text: "First approval",
				Actions: []*model.PostAction{
					{Id: "approve-1", Name: "Approve 1", URL: "https://example.com/approve1"},
				},
			},
			{
				Text: "Second approval",
				Actions: []*model.PostAction{
					{Id: "approve-2", Name: "Approve 2", URL: "https://example.com/approve2"},
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
		preserved := th.App.PreserveInteractiveElements(originalPost, editedPost)
		preservedAttachments := th.App.extractSlackAttachments(preserved)

		// Verify all buttons are preserved
		require.Len(t, preservedAttachments, 2)
		assert.Len(t, preservedAttachments[0].Actions, 1)
		assert.Len(t, preservedAttachments[1].Actions, 1)
		assert.Equal(t, "approve-1", preservedAttachments[0].Actions[0].Id)
		assert.Equal(t, "approve-2", preservedAttachments[1].Actions[0].Id)
	})
}

func TestExtractSlackAttachments(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	t.Run("should handle DoS protection for large attachments", func(t *testing.T) {
		// Create a very large attachment JSON to test DoS protection
		largeData := strings.Repeat("x", 2*1024*1024) // 2MB of data
		largeAttachment := &model.SlackAttachment{
			Text: largeData,
		}

		largeAttachmentJSON, _ := json.Marshal([]*model.SlackAttachment{largeAttachment})
		post := &model.Post{Id: "test-post"}
		post.SetProps(map[string]interface{}{
			"attachments": string(largeAttachmentJSON),
		})

		// Should return empty slice due to size validation
		attachments := th.App.extractSlackAttachments(post)
		assert.Empty(t, attachments, "Large attachments should be rejected for DoS protection")
	})

	t.Run("should handle nil post", func(t *testing.T) {
		attachments := th.App.extractSlackAttachments(nil)
		assert.Empty(t, attachments)
	})

	t.Run("should handle post with nil props", func(t *testing.T) {
		post := &model.Post{Id: "test-post"}
		attachments := th.App.extractSlackAttachments(post)
		assert.Empty(t, attachments)
	})

	t.Run("should handle malformed JSON", func(t *testing.T) {
		post := &model.Post{Id: "test-post"}
		post.SetProps(map[string]interface{}{
			"attachments": "invalid-json-{",
		})

		attachments := th.App.extractSlackAttachments(post)
		assert.Empty(t, attachments, "Should handle malformed JSON gracefully")
	})

	t.Run("should handle non-string attachment data", func(t *testing.T) {
		post := &model.Post{Id: "test-post"}
		post.SetProps(map[string]interface{}{
			"attachments": 12345, // Non-string data
		})

		attachments := th.App.extractSlackAttachments(post)
		assert.Empty(t, attachments, "Should handle non-string attachment data")
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
					URL:  "https://example.com/1",
				},
				{
					Id:   "action-2",
					Name: "Second Action",
					URL:  "https://example.com/2",
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

	t.Run("should handle nil post", func(t *testing.T) {
		action := th.App.findInteractiveAction(nil, "action-1")
		assert.Nil(t, action)
	})

	t.Run("should handle empty action ID", func(t *testing.T) {
		post := &model.Post{Id: "test-post"}
		action := th.App.findInteractiveAction(post, "")
		assert.Nil(t, action)
	})

	t.Run("should handle nil attachments", func(t *testing.T) {
		attachment := &model.SlackAttachment{
			Actions: []*model.PostAction{nil}, // Nil action
		}

		attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
		post := &model.Post{Id: "test-post"}
		post.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		action := th.App.findInteractiveAction(post, "action-1")
		assert.Nil(t, action, "Should handle nil actions gracefully")
	})
}

func TestExecuteInteractiveAction(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	// Create test post with interactive action
	attachment := &model.SlackAttachment{
		Actions: []*model.PostAction{
			{
				Id:     "test-action",
				Name:   "Test Button",
				URL:    "https://example.com/webhook",
				Cookie: "valid-cookie-123",
			},
		},
	}

	attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
	post := &model.Post{
		Id:      "test-post-id",
		Message: "Test message with button",
	}
	post.SetProps(map[string]interface{}{
		"attachments": string(attachmentJSON),
	})

	// Store the post so GetSinglePost can find it
	th.App.Srv().Store().Post().Save(th.Context, post)

	t.Run("should execute valid interactive action", func(t *testing.T) {
		err := th.App.ExecuteInteractiveAction(
			th.Context,
			post.Id,
			"test-action",
			"valid-cookie-123",
		)
		assert.NoError(t, err, "Should execute valid action without error")
	})

	t.Run("should reject action with invalid cookie", func(t *testing.T) {
		err := th.App.ExecuteInteractiveAction(
			th.Context,
			post.Id,
			"test-action",
			"invalid-cookie",
		)
		assert.Error(t, err, "Should reject action with invalid cookie")
		assert.Contains(t, err.Id, "cookie_mismatch")
	})

	t.Run("should reject non-existent action", func(t *testing.T) {
		err := th.App.ExecuteInteractiveAction(
			th.Context,
			post.Id,
			"non-existent-action",
			"valid-cookie-123",
		)
		assert.Error(t, err, "Should reject non-existent action")
		assert.Contains(t, err.Id, "not_found")
	})

	t.Run("should handle invalid parameters", func(t *testing.T) {
		// Test with nil context
		err := th.App.ExecuteInteractiveAction(nil, post.Id, "test-action", "valid-cookie-123")
		assert.Error(t, err, "Should reject nil context")

		// Test with empty post ID
		err = th.App.ExecuteInteractiveAction(th.Context, "", "test-action", "valid-cookie-123")
		assert.Error(t, err, "Should reject empty post ID")

		// Test with empty action ID
		err = th.App.ExecuteInteractiveAction(th.Context, post.Id, "", "valid-cookie-123")
		assert.Error(t, err, "Should reject empty action ID")
	})
}

func TestGetAttachmentKey(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	t.Run("should generate keys based on attachment content", func(t *testing.T) {
		app := th.App

		// Test with text
		attachment := &model.SlackAttachment{Text: "Test text"}
		key := app.getAttachmentKey(attachment)
		assert.Equal(t, "Test text", key)

		// Test with fallback when no text
		attachment = &model.SlackAttachment{Fallback: "Test fallback"}
		key = app.getAttachmentKey(attachment)
		assert.Equal(t, "Test fallback", key)

		// Test with title when no text or fallback
		attachment = &model.SlackAttachment{Title: "Test title"}
		key = app.getAttachmentKey(attachment)
		assert.Equal(t, "Test title", key)

		// Test with nil attachment
		key = app.getAttachmentKey(nil)
		assert.Equal(t, "nil-attachment", key)

		// Test with empty attachment
		attachment = &model.SlackAttachment{}
		key = app.getAttachmentKey(attachment)
		assert.Equal(t, "default-attachment", key)
	})
}
