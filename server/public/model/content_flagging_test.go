package model

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFlagContentRequest_IsValid(t *testing.T) {
	validReasons := []string{"spam", "harassment", "inappropriate"}

	t.Run("valid request without comment", func(t *testing.T) {
		req := &FlagContentRequest{
			Reason:  "spam",
			Comment: "",
		}
		err := req.IsValid(false, validReasons)
		assert.Nil(t, err)
	})

	t.Run("valid request with comment", func(t *testing.T) {
		req := &FlagContentRequest{
			Reason:  "harassment",
			Comment: "This is inappropriate content",
		}
		err := req.IsValid(false, validReasons)
		assert.Nil(t, err)
	})

	t.Run("valid request with comment when required", func(t *testing.T) {
		req := &FlagContentRequest{
			Reason:  "inappropriate",
			Comment: "This violates community guidelines",
		}
		err := req.IsValid(true, validReasons)
		assert.Nil(t, err)
	})

	t.Run("missing comment when required", func(t *testing.T) {
		req := &FlagContentRequest{
			Reason:  "spam",
			Comment: "",
		}
		err := req.IsValid(true, validReasons)
		assert.NotNil(t, err)
		assert.Equal(t, "api.content_flagging.error.comment_required", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("missing reason", func(t *testing.T) {
		req := &FlagContentRequest{
			Reason:  "",
			Comment: "Some comment",
		}
		err := req.IsValid(false, validReasons)
		assert.NotNil(t, err)
		assert.Equal(t, "api.content_flagging.error.reason_required", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("invalid reason", func(t *testing.T) {
		req := &FlagContentRequest{
			Reason:  "invalid_reason",
			Comment: "Some comment",
		}
		err := req.IsValid(false, validReasons)
		assert.NotNil(t, err)
		assert.Equal(t, "api.content_flagging.error.reason_invalid", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("comment too long", func(t *testing.T) {
		longComment := strings.Repeat("a", commentMaxRunes+1)
		req := &FlagContentRequest{
			Reason:  "spam",
			Comment: longComment,
		}
		err := req.IsValid(false, validReasons)
		assert.NotNil(t, err)
		assert.Equal(t, "api.content_flagging.error.comment_too_long", err.Id)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
		assert.Equal(t, commentMaxRunes, err.params["MaxLength"])
	})

	t.Run("comment at max length", func(t *testing.T) {
		maxLengthComment := strings.Repeat("a", commentMaxRunes)
		req := &FlagContentRequest{
			Reason:  "harassment",
			Comment: maxLengthComment,
		}
		err := req.IsValid(false, validReasons)
		assert.Nil(t, err)
	})

	t.Run("unicode comment length validation", func(t *testing.T) {
		// Test with unicode characters that take multiple bytes
		unicodeComment := strings.Repeat("🚀", commentMaxRunes+1)
		req := &FlagContentRequest{
			Reason:  "spam",
			Comment: unicodeComment,
		}
		err := req.IsValid(false, validReasons)
		assert.NotNil(t, err)
		assert.Equal(t, "api.content_flagging.error.comment_too_long", err.Id)
	})

	t.Run("empty valid reasons list", func(t *testing.T) {
		req := &FlagContentRequest{
			Reason:  "spam",
			Comment: "Some comment",
		}
		err := req.IsValid(false, []string{})
		assert.NotNil(t, err)
		assert.Equal(t, "api.content_flagging.error.reason_invalid", err.Id)
	})
}
