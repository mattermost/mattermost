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

OPTIONAL (for emphasis): textStyle with color attr: {"type":"text","marks":[{"type":"textStyle","attrs":{"color":"#ff0000"}}],"text":"red text"}
DO NOT USE: highlight, underline, subscript, superscript

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

// supportedMarks are the only mark types supported by our TipTap schema
// Any other marks (highlight, etc.) will be stripped
var supportedMarks = map[string]bool{
	"bold":      true,
	"italic":    true,
	"strike":    true,
	"code":      true,
	"link":      true,
	"textStyle": true, // Used by TipTap Color extension for text colors
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
			// Strip unsupported marks from text nodes
			if nodeType == "text" {
				stripUnsupportedMarks(childMap)
			}
			// Recursively sanitize children
			sanitizeNode(childMap)
			newContent = append(newContent, childMap)
		}
	}

	node["content"] = newContent
}

// stripUnsupportedMarks removes marks that aren't in our TipTap schema
// Also converts textColor marks to textStyle (TipTap's expected format)
func stripUnsupportedMarks(textNode map[string]any) {
	marks, hasMarks := textNode["marks"].([]any)
	if !hasMarks || len(marks) == 0 {
		return
	}

	var filteredMarks []any
	for _, mark := range marks {
		markMap, ok := mark.(map[string]any)
		if !ok {
			continue
		}
		markType, _ := markMap["type"].(string)

		// Convert textColor to textStyle (TipTap's Color extension uses textStyle)
		if markType == "textColor" {
			markMap["type"] = "textStyle"
			markType = "textStyle"
		}

		if supportedMarks[markType] {
			filteredMarks = append(filteredMarks, mark)
		}
	}

	if len(filteredMarks) == 0 {
		delete(textNode, "marks")
	} else {
		textNode["marks"] = filteredMarks
	}
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

// SummarizeThreadToPageRequest represents a request to summarize a thread into a wiki page
type SummarizeThreadToPageRequest struct {
	AgentID  string `json:"agent_id"`
	ThreadID string `json:"thread_id"`
	Title    string `json:"title"`
}

// SummarizeThreadToPageResponse represents the response from thread summarization
type SummarizeThreadToPageResponse struct {
	PageID string `json:"page_id"`
}

// threadSummarizationSystemPrompt requests TipTap JSON format for wiki pages
const threadSummarizationSystemPrompt = `You summarize conversations and return TipTap/ProseMirror document JSON for wiki pages.

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

CRITICAL RULES:
1. Response MUST start with {"type":"doc"
2. Response MUST end with }
3. NO markdown, NO code blocks, NO backticks, NO explanations
4. ONLY output the JSON object
5. Create a well-structured summary with headings, bullet points, and action items where appropriate`

// threadSummarizationUserPrompt is the template for summarizing a thread
const threadSummarizationUserPrompt = `Summarize the following conversation into a well-structured wiki page.

Create a comprehensive summary that includes:
1. A brief overview paragraph
2. Key discussion points as bullet points
3. Decisions made (if any)
4. Action items or next steps (as a task list if applicable)

Conversation:
%s

Return ONLY the TipTap JSON document. No explanations or markdown.`

// SummarizeThreadToPage summarizes a thread/conversation and creates a draft wiki page with the summary.
// Returns the draft page ID for the user to review and publish.
func (a *App) SummarizeThreadToPage(rctx request.CTX, agentID, threadID, wikiID, pageTitle string) (string, *model.AppError) {
	userID := rctx.Session().UserId

	// Check if AI plugin bridge is available
	if !a.isAIPluginBridgeAvailable(rctx) {
		return "", model.NewAppError("SummarizeThreadToPage", "app.page.summarize_thread.ai_not_available", nil, "AI plugin bridge is not available", http.StatusServiceUnavailable)
	}

	// Validate inputs
	if agentID == "" {
		return "", model.NewAppError("SummarizeThreadToPage", "app.page.summarize_thread.missing_agent", nil, "", http.StatusBadRequest)
	}
	if threadID == "" {
		return "", model.NewAppError("SummarizeThreadToPage", "app.page.summarize_thread.missing_thread", nil, "", http.StatusBadRequest)
	}
	if wikiID == "" {
		return "", model.NewAppError("SummarizeThreadToPage", "app.page.summarize_thread.missing_wiki", nil, "", http.StatusBadRequest)
	}
	pageTitle = strings.TrimSpace(pageTitle)
	if pageTitle == "" {
		return "", model.NewAppError("SummarizeThreadToPage", "app.page.summarize_thread.missing_title", nil, "", http.StatusBadRequest)
	}

	// Validate wiki exists
	_, wikiErr := a.GetWiki(rctx, wikiID)
	if wikiErr != nil {
		return "", wikiErr
	}

	// Fetch the thread posts
	opts := model.GetPostsOptions{
		CollapsedThreads: false,
	}
	postList, threadErr := a.GetPostThread(rctx, threadID, opts, userID)
	if threadErr != nil {
		return "", model.NewAppError("SummarizeThreadToPage", "app.page.summarize_thread.fetch_thread_failed", nil, threadErr.Error(), http.StatusInternalServerError)
	}

	if postList == nil || len(postList.Order) == 0 {
		return "", model.NewAppError("SummarizeThreadToPage", "app.page.summarize_thread.empty_thread", nil, "", http.StatusBadRequest)
	}

	// Build conversation text from posts
	conversationText := a.buildConversationText(rctx, postList)

	// Prepare user prompt with conversation
	userPrompt := fmt.Sprintf(threadSummarizationUserPrompt, conversationText)

	// Create bridge client and call AI
	client := a.getBridgeClient(userID)
	completionRequest := agentclient.CompletionRequest{
		Posts: []agentclient.Post{
			{Role: "system", Message: threadSummarizationSystemPrompt},
			{Role: "user", Message: userPrompt},
		},
	}

	rctx.Logger().Info("Calling AI agent for thread summarization",
		mlog.String("agent_id", agentID),
		mlog.String("thread_id", threadID),
		mlog.String("wiki_id", wikiID),
		mlog.Int("post_count", len(postList.Order)),
	)

	completion, completionErr := client.AgentCompletion(agentID, completionRequest)
	if completionErr != nil {
		rctx.Logger().Error("AI agent thread summarization call failed",
			mlog.String("agent_id", agentID),
			mlog.String("thread_id", threadID),
			mlog.Err(completionErr),
		)
		return "", model.NewAppError("SummarizeThreadToPage", "app.page.summarize_thread.agent_call_failed", nil, completionErr.Error(), http.StatusInternalServerError)
	}

	rctx.Logger().Info("AI agent thread summarization succeeded",
		mlog.String("agent_id", agentID),
		mlog.String("thread_id", threadID),
		mlog.Int("response_length", len(completion)),
	)

	// Clean up markdown code blocks (AI may wrap response in ```json...```)
	cleanedCompletion := cleanMarkdownCodeBlocks(completion)
	trimmed := strings.TrimSpace(cleanedCompletion)

	// Validate that response is TipTap JSON
	if !strings.HasPrefix(trimmed, `{"type":"doc"`) {
		rctx.Logger().Warn("AI response was not TipTap format, wrapping in paragraph",
			mlog.String("agent_id", agentID),
			mlog.String("thread_id", threadID),
			mlog.String("response_preview", trimmed[:min(100, len(trimmed))]),
		)
		// Wrap plain text in TipTap paragraph
		trimmed = convertPlainTextToTipTapJSON(trimmed)
	}

	// Sanitize the TipTap document
	sanitized, sanitizeErr := sanitizeTipTapDoc(trimmed)
	if sanitizeErr != nil {
		rctx.Logger().Warn("Failed to sanitize TipTap doc, using raw",
			mlog.String("agent_id", agentID),
			mlog.String("thread_id", threadID),
			mlog.Err(sanitizeErr),
		)
		sanitized = trimmed
	}

	// Generate a new page ID for the draft
	pageID := model.NewId()

	// Create a draft page with the summarized content (user can review before publishing)
	draft, draftErr := a.SavePageDraftWithMetadata(rctx, userID, wikiID, pageID, sanitized, pageTitle, 0, nil)
	if draftErr != nil {
		return "", model.NewAppError("SummarizeThreadToPage", "app.page.summarize_thread.create_draft_failed", nil, draftErr.Error(), http.StatusInternalServerError)
	}

	rctx.Logger().Info("Thread summarization draft created",
		mlog.String("agent_id", agentID),
		mlog.String("thread_id", threadID),
		mlog.String("page_id", draft.PageId),
		mlog.String("wiki_id", wikiID),
	)

	return draft.PageId, nil
}

// buildConversationText formats posts into a readable conversation string for AI summarization
func (a *App) buildConversationText(rctx request.CTX, postList *model.PostList) string {
	// Collect unique user IDs to batch fetch
	userIDsMap := make(map[string]bool)
	for _, postID := range postList.Order {
		post := postList.Posts[postID]
		if post == nil || post.IsSystemMessage() {
			continue
		}
		userIDsMap[post.UserId] = true
	}

	// Batch fetch all users at once (avoids N+1 queries)
	userIDs := make([]string, 0, len(userIDsMap))
	for id := range userIDsMap {
		userIDs = append(userIDs, id)
	}

	usernameMap := make(map[string]string)
	if len(userIDs) > 0 {
		users, err := a.Srv().Store().User().GetProfileByIds(rctx, userIDs, nil, false)
		if err == nil {
			for _, user := range users {
				usernameMap[user.Id] = user.Username
			}
		}
	}

	var sb strings.Builder
	for _, postID := range postList.Order {
		post := postList.Posts[postID]
		if post == nil || post.IsSystemMessage() {
			continue
		}

		// Get username from pre-fetched map
		username := post.UserId
		if name, ok := usernameMap[post.UserId]; ok {
			username = name
		}

		// Format: @username: message
		sb.WriteString(fmt.Sprintf("@%s: %s\n", username, post.Message))
	}

	return sb.String()
}
