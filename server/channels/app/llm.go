// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-plugin-ai/llm"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const mattermostAIPluginID = "mattermost-ai"

// completionResponse represents the JSON response from non-streaming endpoints
type completionResponse struct {
	Completion string `json:"completion"`
	Error      string `json:"error,omitempty"`
}

// makePluginHTTPRequest makes an HTTP request to the mattermost-ai plugin via ServeInterPluginRequest
func (a *App) makePluginHTTPRequest(rctx request.CTX, method, path string, body []byte) (*http.Response, error) {
	req, err := http.NewRequest(method, path, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Get the user ID from the request context and add it to the header
	if rctx.Session() != nil && rctx.Session().UserId != "" {
		req.Header.Set("Mattermost-User-Id", rctx.Session().UserId)
	}

	// Use PluginResponseWriter to capture the response
	responseTransfer := &PluginResponseWriter{}

	// ServeInterPluginRequest expects sourcePluginId, but since this is the server calling,
	// we pass an empty string for the source
	a.ServeInterPluginRequest(responseTransfer, req, "", mattermostAIPluginID)

	resp := responseTransfer.GenerateResponse()
	if resp == nil {
		return nil, fmt.Errorf("plugin %s not found or not responding", mattermostAIPluginID)
	}

	return resp, nil
}

// convertSSEStreamToChannel converts an SSE stream from an HTTP response into a channel of TextStreamEvents
func convertSSEStreamToChannel(body io.ReadCloser) <-chan llm.TextStreamEvent {
	stream := make(chan llm.TextStreamEvent)

	go func() {
		defer close(stream)
		defer body.Close()

		scanner := bufio.NewScanner(body)
		for scanner.Scan() {
			line := scanner.Text()

			// SSE format: "data: <content>"
			if strings.HasPrefix(line, "data: ") {
				data := strings.TrimPrefix(line, "data: ")

				// Check for special end marker
				if data == "[DONE]" || data == "" {
					continue
				}

				// Send the text chunk
				stream <- llm.TextStreamEvent{
					Type:  llm.EventTypeText,
					Value: data,
				}
			}
		}

		// Check for scanner errors
		if err := scanner.Err(); err != nil {
			stream <- llm.TextStreamEvent{
				Type:  llm.EventTypeError,
				Value: err,
			}
		}

		// Send end event
		stream <- llm.TextStreamEvent{
			Type:  llm.EventTypeEnd,
			Value: nil,
		}
	}()

	return stream
}

// AgentRequest makes a streaming request to an LLM agent via the mattermost-ai plugin.
func (a *App) AgentRequest(rctx request.CTX, agent string, request plugin.CompletionRequest) (*llm.TextStreamResult, error) {
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	path := fmt.Sprintf("/api/v1/agent/%s/completion", agent)
	resp, err := a.makePluginHTTPRequest(rctx, http.MethodPost, path, requestBody)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var errResp completionResponse
		if json.Unmarshal(body, &errResp) == nil && errResp.Error != "" {
			return nil, fmt.Errorf("agent request failed: %s", errResp.Error)
		}
		return nil, fmt.Errorf("agent request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// For streaming responses, convert the SSE stream to a channel
	result := &llm.TextStreamResult{
		Stream: convertSSEStreamToChannel(resp.Body),
	}

	return result, nil
}

// AgentRequestNoStream makes a non-streaming request to an LLM agent via the mattermost-ai plugin.
func (a *App) AgentRequestNoStream(rctx request.CTX, agent string, request plugin.CompletionRequest) (string, error) {
	requestBody, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	path := fmt.Sprintf("/api/v1/agent/%s/completion/nostream", agent)
	resp, err := a.makePluginHTTPRequest(rctx, http.MethodPost, path, requestBody)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var result completionResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if result.Error != "" {
		return "", fmt.Errorf("agent request failed: %s", result.Error)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("agent request failed with status %d: %s", resp.StatusCode, string(body))
	}

	return result.Completion, nil
}

// LLMServiceRequest makes a streaming request to an LLM service via the mattermost-ai plugin.
func (a *App) LLMServiceRequest(rctx request.CTX, service string, request plugin.CompletionRequest) (*llm.TextStreamResult, error) {
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	path := fmt.Sprintf("/api/v1/service/%s/completion", service)
	resp, err := a.makePluginHTTPRequest(rctx, http.MethodPost, path, requestBody)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var errResp completionResponse
		if json.Unmarshal(body, &errResp) == nil && errResp.Error != "" {
			return nil, fmt.Errorf("service request failed: %s", errResp.Error)
		}
		return nil, fmt.Errorf("service request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// For streaming responses, convert the SSE stream to a channel
	result := &llm.TextStreamResult{
		Stream: convertSSEStreamToChannel(resp.Body),
	}

	return result, nil
}

// LLMServiceRequestNoStream makes a non-streaming request to an LLM service via the mattermost-ai plugin.
func (a *App) LLMServiceRequestNoStream(rctx request.CTX, service string, request plugin.CompletionRequest) (string, error) {
	requestBody, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	path := fmt.Sprintf("/api/v1/service/%s/completion/nostream", service)
	resp, err := a.makePluginHTTPRequest(rctx, http.MethodPost, path, requestBody)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var result completionResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if result.Error != "" {
		return "", fmt.Errorf("service request failed: %s", result.Error)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("service request failed with status %d: %s", resp.StatusCode, string(body))
	}

	return result.Completion, nil
}
