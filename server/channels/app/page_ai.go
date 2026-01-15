// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	agentclient "github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// PageImageExtractionAction defines the type of image analysis to perform for wiki pages
type PageImageExtractionAction string

const (
	PageImageExtractionExtractHandwriting PageImageExtractionAction = "extract_handwriting"
	PageImageExtractionDescribeImage      PageImageExtractionAction = "describe_image"
)

// PageImageExtractionRequest represents a request to extract text or describe an image for wiki pages
type PageImageExtractionRequest struct {
	AgentID string                    `json:"agent_id"`
	FileID  string                    `json:"file_id"`
	Action  PageImageExtractionAction `json:"action"`
}

// PageImageExtractionResponse represents the response from page image extraction
// ExtractedText contains TipTap JSON format for direct rendering in the wiki editor
type PageImageExtractionResponse struct {
	ExtractedText string `json:"extracted_text"`
}

// pageImageExtractionSystemPrompt requests TipTap JSON format for wiki editor rendering
const pageImageExtractionSystemPrompt = `You extract text from images and return TipTap/ProseMirror document JSON.

OUTPUT FORMAT - Return ONLY this exact JSON structure:
{"type":"doc","content":[...array of nodes...]}

ALLOWED NODE TYPES (use ONLY these):
- doc: root document node
- paragraph: {"type":"paragraph","content":[...text nodes...]}
- heading: {"type":"heading","attrs":{"level":1},"content":[...text nodes...]} (level 1-3)
- text: {"type":"text","text":"content"} or with marks: {"type":"text","marks":[{"type":"bold"}],"text":"content"}
- bulletList: {"type":"bulletList","content":[...listItem nodes...]}
- orderedList: {"type":"orderedList","content":[...listItem nodes...]}
- listItem: {"type":"listItem","content":[{"type":"paragraph","content":[...]}]}
- taskList: {"type":"taskList","content":[...taskItem nodes...]}
- taskItem: {"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[...]}]}
- horizontalRule: {"type":"horizontalRule"}
- blockquote: {"type":"blockquote","content":[...paragraph nodes...]}
- codeBlock: {"type":"codeBlock","content":[{"type":"text","text":"code"}]}

MARKS (formatting applied to text nodes via "marks" array, NOT as node types):
- bold: {"type":"text","marks":[{"type":"bold"}],"text":"bold text"}
- italic: {"type":"text","marks":[{"type":"italic"}],"text":"italic text"}
- strike: {"type":"text","marks":[{"type":"strike"}],"text":"strikethrough"}
- code: {"type":"text","marks":[{"type":"code"}],"text":"inline code"}
- combined: {"type":"text","marks":[{"type":"bold"},{"type":"italic"}],"text":"bold italic"}

CRITICAL: bold, italic, strike, code are MARKS on text nodes, NOT node types.
WRONG: {"type":"bold","content":[...]}
RIGHT: {"type":"text","marks":[{"type":"bold"}],"text":"bold text"}

DO NOT USE: textStyle, textColor, highlight, underline, subscript, superscript

EXAMPLE - Paragraph with bold word:
{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is "},{"type":"text","marks":[{"type":"bold"}],"text":"important"},{"type":"text","text":" text."}]}]}

EXAMPLE - Todo list with heading:
{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Tasks"}]},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"Done"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Todo"}]}]}]}]}

CRITICAL RULES:
1. Response MUST start with {"type":"doc"
2. Response MUST end with }
3. NO markdown, NO code blocks, NO backticks, NO explanations
4. ONLY use node types listed above - bold/italic/strike/code are MARKS not nodes
5. ONLY output the JSON object`

// pageImageExtractionHandwritingPrompt is the user prompt for extracting handwritten text as TipTap JSON
const pageImageExtractionHandwritingPrompt = `Extract text from this image and convert to TipTap JSON.

CHECKBOX DETECTION:
- Empty box/circle/bracket → taskItem with checked:false
- Checkmark/X/filled box → taskItem with checked:true
- Crossed-out text → text node with strike mark: {"type":"text","marks":[{"type":"strike"}],"text":"crossed out"}

STRUCTURE MAPPING:
- Title/heading → heading node (level 1-3)
- Checkbox list → taskList containing taskItem nodes
- Bullet list → bulletList containing listItem nodes
- Numbered list → orderedList containing listItem nodes
- Regular text → paragraph node

MARKS ARE APPLIED TO TEXT NODES (bold/italic/strike/code are NOT node types):
- Bold: {"type":"text","marks":[{"type":"bold"}],"text":"bold text"}
- Italic: {"type":"text","marks":[{"type":"italic"}],"text":"italic text"}
- Strike: {"type":"text","marks":[{"type":"strike"}],"text":"struck text"}

Example output:
{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Tasks"}]},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"Done"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Todo"}]}]}]}]}

OUTPUT RULES:
- Start with {"type":"doc"
- bold/italic/strike/code are MARKS on text nodes, NOT node types
- No markdown, no code blocks, no explanations`

// pageImageExtractionDescribePrompt is the user prompt for describing an image as TipTap JSON
const pageImageExtractionDescribePrompt = `Describe this image and convert to TipTap JSON.

STRUCTURE MAPPING:
- Title → heading node (level 1)
- Description → paragraph node
- Key elements → bulletList with listItem nodes

MARKS ARE APPLIED TO TEXT NODES (bold/italic/strike/code are NOT node types):
- Bold: {"type":"text","marks":[{"type":"bold"}],"text":"bold text"}
- Italic: {"type":"text","marks":[{"type":"italic"}],"text":"italic text"}

Example output:
{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Image Description"}]},{"type":"paragraph","content":[{"type":"text","text":"This image shows..."}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Element 1"}]}]}]}]}

OUTPUT RULES:
- Start with {"type":"doc"
- bold/italic/strike/code are MARKS on text nodes, NOT node types
- No markdown, no code blocks, no explanations`

// ExtractPageImageText extracts text from an image using AI vision capabilities
// and returns TipTap JSON format for wiki page rendering
func (a *App) ExtractPageImageText(
	rctx request.CTX,
	agentID string,
	fileID string,
	action PageImageExtractionAction,
) (*PageImageExtractionResponse, *model.AppError) {
	// Verify the file exists and get its info
	fileInfo, err := a.GetFileInfo(rctx, fileID)
	if err != nil {
		return nil, model.NewAppError("ExtractPageImageText", "app.page.extract_image.file_not_found", nil, err.Error(), http.StatusNotFound)
	}

	// Verify it's an image file
	if !strings.HasPrefix(fileInfo.MimeType, "image/") {
		return nil, model.NewAppError("ExtractPageImageText", "app.page.extract_image.not_image", nil, fmt.Sprintf("file type: %s", fileInfo.MimeType), http.StatusBadRequest)
	}

	// Get agent and service details for logging
	var serviceType string
	var serviceName string

	agents, agentsErr := a.GetAgents(rctx, rctx.Session().UserId)
	if agentsErr == nil {
		for _, agent := range agents {
			if agent.ID == agentID {
				serviceType = agent.ServiceType
				break
			}
		}
	}

	// Get service details
	services, servicesErr := a.GetLLMServices(rctx, rctx.Session().UserId)
	if servicesErr == nil {
		for _, service := range services {
			if service.Type == serviceType {
				serviceName = service.Name
				break
			}
		}
	}

	rctx.Logger().Info("Page AI Image Extraction request received",
		mlog.String("agent_id", agentID),
		mlog.String("file_id", fileID),
		mlog.String("service_type", serviceType),
		mlog.String("service_name", serviceName),
		mlog.String("action", string(action)),
		mlog.String("mime_type", fileInfo.MimeType),
	)

	// Get the appropriate prompt for the action
	userPrompt := getPageImageExtractionPromptForAction(action)
	if userPrompt == "" {
		return nil, model.NewAppError("ExtractPageImageText", "app.page.extract_image.invalid_action", nil, fmt.Sprintf("invalid action: %s", action), http.StatusBadRequest)
	}

	// Prepare completion request with file ID for vision
	client := a.getBridgeClient(rctx.Session().UserId)
	completionRequest := agentclient.CompletionRequest{
		Posts: []agentclient.Post{
			{Role: "system", Message: pageImageExtractionSystemPrompt},
			{Role: "user", Message: userPrompt, FileIDs: []string{fileID}},
		},
	}

	rctx.Logger().Info("Calling AI agent for page image extraction",
		mlog.String("agent_id", agentID),
		mlog.String("file_id", fileID),
		mlog.String("service_type", serviceType),
		mlog.Int("system_prompt_length", len(pageImageExtractionSystemPrompt)),
		mlog.Int("user_prompt_length", len(userPrompt)),
	)

	completion, completionErr := client.AgentCompletion(agentID, completionRequest)
	if completionErr != nil {
		rctx.Logger().Error("AI agent page image extraction call failed",
			mlog.String("agent_id", agentID),
			mlog.String("file_id", fileID),
			mlog.String("service_type", serviceType),
			mlog.Err(completionErr),
		)
		return nil, model.NewAppError("ExtractPageImageText", "app.page.extract_image.agent_call_failed", nil, completionErr.Error(), http.StatusInternalServerError)
	}

	rctx.Logger().Info("AI agent page image extraction succeeded",
		mlog.String("agent_id", agentID),
		mlog.String("file_id", fileID),
		mlog.Int("response_length", len(completion)),
	)

	// Clean up markdown code blocks first (AI may wrap response in ```json...```)
	cleanedCompletion := cleanMarkdownCodeBlocks(completion)
	trimmed := strings.TrimSpace(cleanedCompletion)

	// Parse the AI response - we expect TipTap doc JSON: {"type":"doc","content":[...]}
	var response PageImageExtractionResponse

	// Check if it's a TipTap document (starts with {"type":"doc")
	if strings.HasPrefix(trimmed, `{"type":"doc"`) {
		// It's a TipTap doc - sanitize and use as extracted text
		sanitized, sanitizeErr := sanitizeTipTapDoc(trimmed)
		if sanitizeErr != nil {
			rctx.Logger().Warn("Failed to sanitize TipTap doc, using raw",
				mlog.String("agent_id", agentID),
				mlog.String("file_id", fileID),
				mlog.Err(sanitizeErr),
			)
			response.ExtractedText = trimmed
		} else {
			response.ExtractedText = sanitized
		}
		rctx.Logger().Info("AI returned TipTap doc format",
			mlog.String("agent_id", agentID),
			mlog.String("file_id", fileID),
		)
	} else {
		// Try to parse as {"extracted_text":"..."} format
		if err := json.Unmarshal([]byte(cleanedCompletion), &response); err != nil || response.ExtractedText == "" {
			// Either JSON parsing failed or no extracted_text field - use raw response
			rctx.Logger().Warn("AI response was not expected format, using raw response",
				mlog.String("agent_id", agentID),
				mlog.String("file_id", fileID),
				mlog.String("response_preview", trimmed[:min(100, len(trimmed))]),
			)
			response.ExtractedText = trimmed
		}
	}

	if response.ExtractedText == "" {
		return nil, model.NewAppError("ExtractPageImageText", "app.page.extract_image.empty_response", nil, "", http.StatusInternalServerError)
	}

	return &response, nil
}

// getPageImageExtractionPromptForAction returns the appropriate user prompt for the given action
func getPageImageExtractionPromptForAction(action PageImageExtractionAction) string {
	switch action {
	case PageImageExtractionExtractHandwriting:
		return pageImageExtractionHandwritingPrompt
	case PageImageExtractionDescribeImage:
		return pageImageExtractionDescribePrompt
	}
	return ""
}

// cleanMarkdownCodeBlocks removes markdown code block wrappers from AI responses
// AI models sometimes wrap JSON in ```json ... ``` despite instructions not to
func cleanMarkdownCodeBlocks(text string) string {
	text = strings.TrimSpace(text)

	// Check for code block wrapper patterns
	// Pattern: ```json\n...\n``` or ```\n...\n```
	if strings.HasPrefix(text, "```") {
		// Find the end of the opening fence (```json or ```)
		firstNewline := strings.Index(text, "\n")
		if firstNewline == -1 {
			return text
		}

		// Find the closing fence
		lastFence := strings.LastIndex(text, "```")
		if lastFence <= firstNewline {
			return text
		}

		// Extract content between fences
		content := text[firstNewline+1 : lastFence]
		return strings.TrimSpace(content)
	}

	return text
}

// invalidMarkNodeTypes are node types that should be marks, not nodes
// AI sometimes incorrectly uses these as node types instead of marks on text nodes
var invalidMarkNodeTypes = map[string]bool{
	"bold":   true,
	"italic": true,
	"strike": true,
	"code":   true,
}

// sanitizeTipTapDoc fixes common AI mistakes in TipTap JSON output
// It converts invalid node types (bold, italic, strike, code) into proper marks on text nodes
func sanitizeTipTapDoc(docJSON string) (string, error) {
	var doc map[string]any
	if err := json.Unmarshal([]byte(docJSON), &doc); err != nil {
		return "", err
	}

	sanitizeNode(doc)

	result, err := json.Marshal(doc)
	if err != nil {
		return "", err
	}

	return string(result), nil
}

// sanitizeNode recursively fixes invalid node types in a TipTap node
func sanitizeNode(node map[string]any) {
	content, hasContent := node["content"].([]any)
	if !hasContent {
		return
	}

	var newContent []any
	for _, child := range content {
		childMap, ok := child.(map[string]any)
		if !ok {
			newContent = append(newContent, child)
			continue
		}

		nodeType, _ := childMap["type"].(string)

		// Check if this is an invalid mark-as-node type
		if invalidMarkNodeTypes[nodeType] {
			// Convert to text node with mark
			converted := convertMarkNodeToTextWithMark(childMap, nodeType)
			newContent = append(newContent, converted...)
		} else {
			// Recursively sanitize children
			sanitizeNode(childMap)
			newContent = append(newContent, childMap)
		}
	}

	node["content"] = newContent
}

// convertMarkNodeToTextWithMark converts an invalid mark node (like {"type":"bold","content":[...]})
// into proper text nodes with marks (like {"type":"text","marks":[{"type":"bold"}],"text":"..."})
func convertMarkNodeToTextWithMark(node map[string]any, markType string) []any {
	content, hasContent := node["content"].([]any)
	if !hasContent {
		// No content, create empty text node with mark
		return []any{
			map[string]any{
				"type":  "text",
				"marks": []any{map[string]any{"type": markType}},
				"text":  "",
			},
		}
	}

	var result []any
	for _, child := range content {
		childMap, ok := child.(map[string]any)
		if !ok {
			continue
		}

		childType, _ := childMap["type"].(string)

		if childType == "text" {
			// Add the mark to this text node
			existingMarks, _ := childMap["marks"].([]any)
			if existingMarks == nil {
				existingMarks = []any{}
			}
			existingMarks = append(existingMarks, map[string]any{"type": markType})
			childMap["marks"] = existingMarks
			result = append(result, childMap)
		} else if invalidMarkNodeTypes[childType] {
			// Nested invalid mark node - recursively convert with combined marks
			nested := convertMarkNodeToTextWithMark(childMap, childType)
			for _, n := range nested {
				nMap, ok := n.(map[string]any)
				if ok && nMap["type"] == "text" {
					// Add the outer mark to the nested text node
					existingMarks, _ := nMap["marks"].([]any)
					if existingMarks == nil {
						existingMarks = []any{}
					}
					existingMarks = append(existingMarks, map[string]any{"type": markType})
					nMap["marks"] = existingMarks
				}
				result = append(result, n)
			}
		} else {
			// Other node type inside mark node - recursively sanitize
			sanitizeNode(childMap)
			result = append(result, childMap)
		}
	}

	return result
}
