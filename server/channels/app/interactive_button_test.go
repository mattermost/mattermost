// Comprehensive tests for issue #34438: Interactive button functionality after message edits
// Tests both backend preservation logic and frontend component behavior

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInteractiveButtonsAfterMessageEdit(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := th.CreateTeam()
	channel := th.CreatePublicChannel()
	user := th.CreateUser()
	th.LinkUserToTeam(user, team)
	th.AddUserToChannel(user, channel)

	t.Run("should preserve interactive button data after message edit", func(t *testing.T) {
		// Create post with interactive buttons
		originalPost := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Original message with buttons",
		}

		// Add interactive buttons as attachments
		attachment := &model.SlackAttachment{
			Text: "Choose an action:",
			Actions: []*model.PostAction{
				{
					Id:     "action1",
					Name:   "Approve",
					URL:    "https://example.com/approve",
					Cookie: "test-cookie-123",
					Style:  "primary",
				},
				{
					Id:     "action2",
					Name:   "Reject", 
					URL:    "https://example.com/reject",
					Cookie: "test-cookie-456",
					Style:  "danger",
				},
			},
		}

		attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
		originalPost.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		// Create the post
		createdPost, err := th.App.CreatePost(th.Context, originalPost, channel, false, true)
		require.NoError(t, err)

		// Verify buttons exist in original post
		var originalAttachments []*model.SlackAttachment
		attachmentData := createdPost.GetProps()["attachments"].(string)
		json.Unmarshal([]byte(attachmentData), &originalAttachments)
		require.Len(t, originalAttachments, 1)
		require.Len(t, originalAttachments[0].Actions, 2)

		// Edit the message
		editedPost := createdPost.Clone()
		editedPost.Message = "Edited message - buttons should still work"
		
		updatedPost, appErr := th.App.UpdatePost(th.Context, editedPost, false)
		require.Nil(t, appErr)

		// Verify interactive buttons are preserved after edit
		var updatedAttachments []*model.SlackAttachment
		updatedAttachmentData := updatedPost.GetProps()["attachments"].(string)
		json.Unmarshal([]byte(updatedAttachmentData), &updatedAttachments)
		
		require.Len(t, updatedAttachments, 1, "Attachments should be preserved")
		require.Len(t, updatedAttachments[0].Actions, 2, "Interactive buttons should be preserved")
		
		// Verify button properties are intact
		actions := updatedAttachments[0].Actions
		assert.Equal(t, "action1", actions[0].Id)
		assert.Equal(t, "Approve", actions[0].Name)
		assert.Equal(t, "https://example.com/approve", actions[0].URL)
		assert.Equal(t, "test-cookie-123", actions[0].Cookie)
		
		assert.Equal(t, "action2", actions[1].Id) 
		assert.Equal(t, "Reject", actions[1].Name)
		assert.Equal(t, "https://example.com/reject", actions[1].URL)
		assert.Equal(t, "test-cookie-456", actions[1].Cookie)
	})

	t.Run("should execute button actions correctly after message edit", func(t *testing.T) {
		// Create post with interactive button
		post := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Test message",
		}

		attachment := &model.SlackAttachment{
			Text: "Test attachment",
			Actions: []*model.PostAction{
				{
					Id:     "test-action",
					Name:   "Test Button",
					URL:    "https://webhook.example.com/callback",
					Cookie: "secure-cookie-789",
				},
			},
		}

		attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
		post.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		createdPost, err := th.App.CreatePost(th.Context, post, channel, false, true)
		require.NoError(t, err)

		// Edit the post
		editedPost := createdPost.Clone()
		editedPost.Message = "Edited test message"
		
		updatedPost, appErr := th.App.UpdatePost(th.Context, editedPost, false)
		require.Nil(t, appErr)

		// Try to execute the button action after edit
		actionErr := th.App.DoPostActionWithCookie(th.Context, updatedPost.Id, "test-action", "secure-cookie-789")
		assert.Nil(t, actionErr, "Button action should work after message edit")
	})

	t.Run("should handle multiple edits without breaking buttons", func(t *testing.T) {
		// Create post with interactive buttons
		post := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Initial message",
		}

		attachment := &model.SlackAttachment{
			Actions: []*model.PostAction{
				{
					Id:     "persistent-action",
					Name:   "Persistent Button",
					URL:    "https://example.com/persistent",
					Cookie: "persistent-cookie",
				},
			},
		}

		attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
		post.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		createdPost, _ := th.App.CreatePost(th.Context, post, channel, false, true)

		// Perform multiple edits
		for i := 1; i <= 3; i++ {
			editedPost := createdPost.Clone()
			editedPost.Message = fmt.Sprintf("Edit #%d", i)
			
			var updateErr *model.AppError
			createdPost, updateErr = th.App.UpdatePost(th.Context, editedPost, false)
			require.Nil(t, updateErr)

			// Verify button still works after each edit
			actionErr := th.App.DoPostActionWithCookie(th.Context, createdPost.Id, "persistent-action", "persistent-cookie")
			assert.Nil(t, actionErr, fmt.Sprintf("Button should work after edit #%d", i))
		}
	})

	t.Run("should reject invalid action cookies after edit", func(t *testing.T) {
		// Create post with interactive button
		post := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Security test message",
		}

		attachment := &model.SlackAttachment{
			Actions: []*model.PostAction{
				{
					Id:     "secure-action",
					Name:   "Secure Button",
					URL:    "https://example.com/secure",
					Cookie: "correct-cookie",
				},
			},
		}

		attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
		post.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		createdPost, _ := th.App.CreatePost(th.Context, post, channel, false, true)

		// Edit the post
		editedPost := createdPost.Clone()
		editedPost.Message = "Edited security test"
		
		updatedPost, _ := th.App.UpdatePost(th.Context, editedPost, false)

		// Try with correct cookie - should work
		actionErr := th.App.DoPostActionWithCookie(th.Context, updatedPost.Id, "secure-action", "correct-cookie")
		assert.Nil(t, actionErr, "Correct cookie should work")

		// Try with wrong cookie - should fail
		actionErr = th.App.DoPostActionWithCookie(th.Context, updatedPost.Id, "secure-action", "wrong-cookie")
		assert.NotNil(t, actionErr, "Wrong cookie should be rejected")
		assert.Equal(t, "api.post.do_action.cookie_mismatch", actionErr.Id)
	})

	t.Run("should handle missing actions gracefully", func(t *testing.T) {
		// Create post without interactive buttons
		post := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Regular message without buttons",
		}

		createdPost, _ := th.App.CreatePost(th.Context, post, channel, false, true)

		// Edit the post
		editedPost := createdPost.Clone()
		editedPost.Message = "Edited regular message"
		
		updatedPost, appErr := th.App.UpdatePost(th.Context, editedPost, false)
		require.Nil(t, appErr)

		// Try to execute non-existent action
		actionErr := th.App.DoPostActionWithCookie(th.Context, updatedPost.Id, "non-existent-action", "any-cookie")
		assert.NotNil(t, actionErr, "Non-existent action should return error")
		assert.Equal(t, "api.post.do_action.action_not_found", actionErr.Id)
	})
}

func TestPreserveInteractiveElements(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("should preserve interactive elements from original post", func(t *testing.T) {
		// Original post with interactive elements
		originalAttachment := &model.SlackAttachment{
			Text: "Original attachment",
			Actions: []*model.PostAction{
				{
					Id:     "original-action",
					Name:   "Original Button",
					URL:    "https://example.com/original",
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
		var resultAttachments []*model.SlackAttachment
		attachmentData := result.GetProps()["attachments"].(string)
		json.Unmarshal([]byte(attachmentData), &resultAttachments)
		
		require.Len(t, resultAttachments, 1)
		require.Len(t, resultAttachments[0].Actions, 1)
		
		action := resultAttachments[0].Actions[0]
		assert.Equal(t, "original-action", action.Id)
		assert.Equal(t, "Original Button", action.Name)
		assert.Equal(t, "https://example.com/original", action.URL)
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
		assert.Nil(t, result.GetProps()["attachments"])
	})
}

func TestFindPostAction(t *testing.T) {
	th := Setup(t)
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
		action, foundAttachment := th.App.findPostAction(post, "action-2")
		require.NotNil(t, action)
		require.NotNil(t, foundAttachment)
		assert.Equal(t, "action-2", action.Id)
		assert.Equal(t, "Second Action", action.Name)
		assert.Equal(t, "Test attachment", foundAttachment.Text)

		// Try to find non-existent action
		action, foundAttachment = th.App.findPostAction(post, "non-existent")
		assert.Nil(t, action)
		assert.Nil(t, foundAttachment)
	})
}

// Integration test simulating frontend behavior
func TestInteractiveButtonFrontendIntegration(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := th.CreateTeam()
	channel := th.CreatePublicChannel()
	user := th.CreateUser()
	th.LinkUserToTeam(user, team)
	th.AddUserToChannel(user, channel)

	t.Run("should simulate complete button interaction workflow", func(t *testing.T) {
		// 1. Create post with interactive button (simulates webhook/integration)
		post := &model.Post{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Please approve this request",
		}

		attachment := &model.SlackAttachment{
			Color: "good",
			Text:  "Approval needed for deployment",
			Actions: []*model.PostAction{
				{
					Id:     "approve-deploy",
					Name:   "✅ Approve",
					URL:    "https://ci-system.example.com/approve",
					Cookie: "deploy-123-cookie",
					Style:  "primary",
				},
				{
					Id:     "reject-deploy",
					Name:   "❌ Reject", 
					URL:    "https://ci-system.example.com/reject",
					Cookie: "deploy-123-cookie",
					Style:  "danger",
				},
			},
		}

		attachmentJSON, _ := json.Marshal([]*model.SlackAttachment{attachment})
		post.SetProps(map[string]interface{}{
			"attachments": string(attachmentJSON),
		})

		createdPost, err := th.App.CreatePost(th.Context, post, channel, false, true)
		require.NoError(t, err)

		// 2. User clicks button - should work
		actionErr := th.App.DoPostActionWithCookie(th.Context, createdPost.Id, "approve-deploy", "deploy-123-cookie")
		assert.Nil(t, actionErr, "Button click should work on original post")

		// 3. Someone edits the message (maybe adds context)
		editedPost := createdPost.Clone()
		editedPost.Message = "Please approve this request - URGENT: Production deployment"
		
		updatedPost, appErr := th.App.UpdatePost(th.Context, editedPost, false)
		require.Nil(t, appErr)

		// 4. User clicks button after edit - this should still work (fixes #34438)
		actionErr = th.App.DoPostActionWithCookie(th.Context, updatedPost.Id, "reject-deploy", "deploy-123-cookie")
		assert.Nil(t, actionErr, "Button click should work after message edit - this fixes the reported bug")

		// 5. Verify the post still has the interactive buttons
		var finalAttachments []*model.SlackAttachment
		finalAttachmentData := updatedPost.GetProps()["attachments"].(string)
		json.Unmarshal([]byte(finalAttachmentData), &finalAttachments)
		
		require.Len(t, finalAttachments, 1)
		require.Len(t, finalAttachments[0].Actions, 2)
		
		// Verify button properties survived the edit
		actions := finalAttachments[0].Actions
		assert.Equal(t, "approve-deploy", actions[0].Id)
		assert.Equal(t, "https://ci-system.example.com/approve", actions[0].URL)
		assert.Equal(t, "reject-deploy", actions[1].Id)
		assert.Equal(t, "https://ci-system.example.com/reject", actions[1].URL)
	})
}