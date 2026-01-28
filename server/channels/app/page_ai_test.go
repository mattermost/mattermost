// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestFetchExternalImageAsFile_URLValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	rctx := th.CreateSessionContext()

	t.Run("reject URL without scheme", func(t *testing.T) {
		// URL without scheme is treated as having empty scheme
		_, _, appErr := th.App.FetchExternalImageAsFile(rctx, "example.com/image.jpg", th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.fetch_external_image.invalid_scheme", appErr.Id)
	})

	t.Run("reject file:// scheme", func(t *testing.T) {
		_, _, appErr := th.App.FetchExternalImageAsFile(rctx, "file:///etc/passwd", th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.fetch_external_image.invalid_scheme", appErr.Id)
	})

	t.Run("reject ftp:// scheme", func(t *testing.T) {
		_, _, appErr := th.App.FetchExternalImageAsFile(rctx, "ftp://example.com/image.jpg", th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.fetch_external_image.invalid_scheme", appErr.Id)
	})

	t.Run("reject javascript: scheme", func(t *testing.T) {
		_, _, appErr := th.App.FetchExternalImageAsFile(rctx, "javascript:alert('xss')", th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.fetch_external_image.invalid_scheme", appErr.Id)
	})

	t.Run("reject data: scheme", func(t *testing.T) {
		_, _, appErr := th.App.FetchExternalImageAsFile(rctx, "data:image/png;base64,abc123", th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.fetch_external_image.invalid_scheme", appErr.Id)
	})
}

func TestFetchExternalImageAsFile_ImageProxyRequired(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	rctx := th.CreateSessionContext()

	t.Run("reject when image proxy disabled", func(t *testing.T) {
		// Ensure image proxy is disabled
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ImageProxySettings.Enable = false
		})

		_, _, appErr := th.App.FetchExternalImageAsFile(rctx, "https://example.com/image.jpg", th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.fetch_external_image.proxy_disabled", appErr.Id)
	})
}

func TestExtractPageImageText_AIAvailabilityCheck(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	rctx := th.CreateSessionContext()

	t.Run("return error when AI bridge not available", func(t *testing.T) {
		// AI plugin bridge is not configured in test environment
		_, appErr := th.App.ExtractPageImageText(rctx, "agent-id", "file-id", "", PageImageExtractionExtractHandwriting)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.extract_image.ai_not_available", appErr.Id)
	})

	t.Run("return error for URL when AI bridge not available", func(t *testing.T) {
		_, appErr := th.App.ExtractPageImageText(rctx, "agent-id", "", "https://example.com/image.jpg", PageImageExtractionDescribeImage)
		require.NotNil(t, appErr)
		require.Equal(t, "app.page.extract_image.ai_not_available", appErr.Id)
	})
}

func TestCleanMarkdownCodeBlocks(t *testing.T) {
	t.Run("remove json code block wrapper", func(t *testing.T) {
		input := "```json\n{\"type\":\"doc\"}\n```"
		expected := "{\"type\":\"doc\"}"
		result := cleanMarkdownCodeBlocks(input)
		require.Equal(t, expected, result)
	})

	t.Run("remove plain code block wrapper", func(t *testing.T) {
		input := "```\n{\"type\":\"doc\"}\n```"
		expected := "{\"type\":\"doc\"}"
		result := cleanMarkdownCodeBlocks(input)
		require.Equal(t, expected, result)
	})

	t.Run("preserve content without code blocks", func(t *testing.T) {
		input := "{\"type\":\"doc\"}"
		result := cleanMarkdownCodeBlocks(input)
		require.Equal(t, input, result)
	})

	t.Run("handle content with leading whitespace", func(t *testing.T) {
		input := "  ```json\n{\"type\":\"doc\"}\n```  "
		expected := "{\"type\":\"doc\"}"
		result := cleanMarkdownCodeBlocks(input)
		require.Equal(t, expected, result)
	})
}

func TestSanitizeTipTapDoc(t *testing.T) {
	t.Run("fix bold node type to mark", func(t *testing.T) {
		// AI sometimes returns {"type":"bold","content":[...]} instead of proper marks
		input := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"bold","content":[{"type":"text","text":"important"}]}]}]}`
		result, err := sanitizeTipTapDoc(input)
		require.NoError(t, err)
		// Should contain bold as a mark on text node
		require.Contains(t, result, `"marks"`)
		require.Contains(t, result, `"text":"important"`)
		// Should not contain bold as a separate node type in content array
		// The bold mark type in marks array is correct
		require.Contains(t, result, `"type":"text"`)
	})

	t.Run("fix italic node type to mark", func(t *testing.T) {
		input := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"italic","content":[{"type":"text","text":"emphasis"}]}]}]}`
		result, err := sanitizeTipTapDoc(input)
		require.NoError(t, err)
		require.Contains(t, result, `"marks"`)
		require.Contains(t, result, `"text":"emphasis"`)
	})

	t.Run("strip unsupported marks", func(t *testing.T) {
		input := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"test","marks":[{"type":"highlight"}]}]}]}`
		result, err := sanitizeTipTapDoc(input)
		require.NoError(t, err)
		require.NotContains(t, result, `"highlight"`)
	})

	t.Run("preserve valid document", func(t *testing.T) {
		input := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}`
		result, err := sanitizeTipTapDoc(input)
		require.NoError(t, err)
		require.Contains(t, result, `"type":"doc"`)
		require.Contains(t, result, `"type":"paragraph"`)
		require.Contains(t, result, `"type":"text"`)
	})

	t.Run("return error for invalid JSON", func(t *testing.T) {
		input := `not valid json`
		_, err := sanitizeTipTapDoc(input)
		require.Error(t, err)
	})
}

func TestGetPageImageExtractionPromptForAction(t *testing.T) {
	t.Run("return handwriting prompt for extract_handwriting", func(t *testing.T) {
		prompt := getPageImageExtractionPromptForAction(PageImageExtractionExtractHandwriting)
		require.NotEmpty(t, prompt)
		require.Contains(t, prompt, "Extract text from this image")
	})

	t.Run("return describe prompt for describe_image", func(t *testing.T) {
		prompt := getPageImageExtractionPromptForAction(PageImageExtractionDescribeImage)
		require.NotEmpty(t, prompt)
		require.Contains(t, prompt, "Describe this image")
	})

	t.Run("return empty for invalid action", func(t *testing.T) {
		prompt := getPageImageExtractionPromptForAction("invalid_action")
		require.Empty(t, prompt)
	})
}
