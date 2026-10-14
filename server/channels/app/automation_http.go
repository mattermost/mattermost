// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const (
	automationRunAsHeader       = "Mattermost-Weave-Run-As"
	automationOwnerScopeHeader  = "Mattermost-Weave-Owner-Scope"
	automationInvokerHeader     = "Mattermost-Weave-Invoker-User-Id"
	automationAuthorHeader      = "Mattermost-Weave-Author-User-Id"
	automationActingUserHeader  = "Mattermost-Weave-Acting-User-Id"
	automationErrorMessageRunes = 200
)

var (
	automationPlaceholder = regexp.MustCompile(`\{\{\.([A-Za-z_][A-Za-z0-9_]*)\}\}`)
	automationPathSegment = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
)

func automationMethod(method string) (string, error) {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return strings.ToUpper(strings.TrimSpace(method)), nil
	default:
		return "", errors.New("automation action method must be GET, HEAD, POST, PUT, PATCH, or DELETE")
	}
}

func automationMethodHasBody(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch:
		return true
	default:
		return false
	}
}

// renderAutomationRequest fills the registered path from the action fields and
// JSON-encodes every field the path did not consume. The path template is the
// plugin's. Values are single path segments.
func renderAutomationRequest(action model.AutomationActionDescriptor, fields map[string]model.AutomationValue) (string, string, []byte, error) {
	method, err := automationMethod(action.Method)
	if err != nil {
		return "", "", nil, err
	}
	remaining := make(map[string]model.AutomationValue, len(fields))
	for key, value := range fields {
		remaining[key] = value
	}
	rendered := action.Path
	matches := automationPlaceholder.FindAllStringSubmatch(action.Path, -1)
	seen := map[string]string{}
	for _, match := range matches {
		key := match[1]
		segment, ok := seen[key]
		if !ok {
			value, exists := remaining[key]
			if !exists {
				return "", "", nil, errors.Errorf("automation action path requires %s", key)
			}
			segment, err = automationSegment(value)
			if err != nil {
				return "", "", nil, errors.Wrapf(err, "automation action field %s", key)
			}
			seen[key] = segment
			delete(remaining, key)
		}
		rendered = strings.ReplaceAll(rendered, match[0], segment)
	}
	if strings.Contains(rendered, "{{") || rendered != path.Clean(rendered) || !strings.HasPrefix(rendered, "/") {
		return "", "", nil, errors.New("automation action path is not a plugin route")
	}
	if !automationMethodHasBody(method) {
		if len(remaining) > 0 {
			return "", "", nil, errors.New("automation action has fields that are not part of the path")
		}
		return method, rendered, nil, nil
	}
	if len(remaining) == 0 {
		return method, rendered, nil, nil
	}
	payload := make(map[string]any, len(remaining))
	for key, value := range remaining {
		payload[key] = value.Native()
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", "", nil, err
	}
	if len(body) > model.AutomationActionMaxBytes {
		return "", "", nil, errors.New("automation action request exceeds 1 MiB")
	}
	return method, rendered, body, nil
}

func automationSegment(value model.AutomationValue) (string, error) {
	var segment string
	switch value.Type.Normalize() {
	case model.AutomationValueText, model.AutomationValueTextarea:
		segment = value.Text
	case model.AutomationValueBool:
		segment = strconv.FormatBool(value.Bool)
	case model.AutomationValueInt:
		segment = strconv.FormatInt(value.Int, 10)
	case model.AutomationValueFloat:
		segment = strconv.FormatFloat(value.Float, 'f', -1, 64)
	default:
		return "", errors.Errorf("unknown automation type %q", value.Type)
	}
	if !automationPathSegment.MatchString(segment) {
		return "", errors.Errorf("path value %q is not a single path segment", segment)
	}
	return segment, nil
}

func projectAutomationResults(results []model.AutomationField, status int, body []byte) (map[string]model.AutomationValue, error) {
	if status < 200 || status >= 300 {
		return nil, errors.Errorf("automation action returned %d: %s", status, automationErrorMessage(body))
	}
	if len(results) == 0 || len(bytes.TrimSpace(body)) == 0 {
		return map[string]model.AutomationValue{}, nil
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.UseNumber()
	var raw map[string]any
	if err := decoder.Decode(&raw); err != nil {
		return nil, errors.Wrap(err, "automation action result is not a JSON object")
	}
	out := make(map[string]model.AutomationValue, len(results))
	for _, field := range results {
		value, ok := raw[field.Key]
		if !ok || value == nil {
			continue
		}
		parsed, err := automationValueFromJSON(field.Type, value)
		if err != nil {
			return nil, errors.Wrapf(err, "automation result %s", field.Key)
		}
		out[field.Key] = parsed
	}
	return out, nil
}

func automationValueFromJSON(declared model.AutomationValueType, value any) (model.AutomationValue, error) {
	switch declared.Normalize() {
	case model.AutomationValueText, model.AutomationValueTextarea:
		text, ok := value.(string)
		if !ok {
			return model.AutomationValue{}, errors.New("expected a string")
		}
		return model.AutomationValue{Type: declared.Normalize(), Text: text}, nil
	case model.AutomationValueBool:
		flag, ok := value.(bool)
		if !ok {
			return model.AutomationValue{}, errors.New("expected a bool")
		}
		return model.AutomationBool(flag), nil
	case model.AutomationValueInt:
		number, ok := value.(json.Number)
		if !ok {
			return model.AutomationValue{}, errors.New("expected an int")
		}
		parsed, err := number.Int64()
		if err != nil {
			return model.AutomationValue{}, errors.New("expected a whole number")
		}
		return model.AutomationInt(parsed), nil
	case model.AutomationValueFloat:
		number, ok := value.(json.Number)
		if !ok {
			return model.AutomationValue{}, errors.New("expected a float")
		}
		parsed, err := number.Float64()
		if err != nil {
			return model.AutomationValue{}, errors.New("expected a finite float")
		}
		return model.AutomationValue{Type: model.AutomationValueFloat, Float: parsed}, nil
	default:
		return model.AutomationValue{}, errors.Errorf("unknown automation type %q", declared)
	}
}

func automationErrorMessage(body []byte) string {
	var raw map[string]any
	if json.Unmarshal(body, &raw) == nil {
		for _, key := range []string{"error", "message", "detailed_error"} {
			text, ok := raw[key].(string)
			if ok && text != "" {
				return truncateAutomationRunes(text, automationErrorMessageRunes)
			}
		}
	}
	text := strings.TrimSpace(string(body))
	if text == "" {
		return "the plugin returned an error"
	}
	return truncateAutomationRunes(text, automationErrorMessageRunes)
}

func truncateAutomationRunes(text string, limit int) string {
	if utf8.RuneCountInString(text) <= limit {
		return text
	}
	runes := []rune(text)
	return string(runes[:limit])
}

type automationResponse struct {
	header http.Header
	code   int
	body   bytes.Buffer
	tooBig bool
}

func (w *automationResponse) Header() http.Header {
	if w.header == nil {
		w.header = make(http.Header)
	}
	return w.header
}

func (w *automationResponse) WriteHeader(status int) {
	if w.code == 0 {
		w.code = status
	}
}

func (w *automationResponse) Write(p []byte) (int, error) {
	if w.code == 0 {
		w.code = http.StatusOK
	}
	remain := model.AutomationActionMaxBytes + 1 - w.body.Len()
	if remain <= 0 {
		w.tooBig = true
		return len(p), nil
	}
	if len(p) > remain {
		_, _ = w.body.Write(p[:remain])
		w.tooBig = true
		return len(p), nil
	}
	return w.body.Write(p)
}

func (w *automationResponse) status() int {
	if w.code == 0 {
		return http.StatusOK
	}
	return w.code
}

func (api *PluginAPI) callAutomationHTTP(req *model.AutomationActionRequest, method, route string, body []byte) (int, []byte, error) {
	var reader io.Reader
	if len(body) > 0 {
		reader = bytes.NewReader(body)
	}
	httpReq, err := http.NewRequest(method, "http://plugin.internal"+route, reader)
	if err != nil {
		return 0, nil, err
	}
	httpReq.URL.Scheme = ""
	httpReq.URL.Host = ""
	httpReq.RequestURI = route
	if len(body) > 0 {
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.ContentLength = int64(len(body))
	}
	httpReq.Header.Set(automationActingUserHeader, req.ActingUserID)
	if req.RunAs != "" {
		httpReq.Header.Set(automationRunAsHeader, req.RunAs)
	}
	if req.OwnerScope != "" {
		httpReq.Header.Set(automationOwnerScopeHeader, req.OwnerScope)
	}
	if req.InvokerUserID != "" {
		httpReq.Header.Set(automationInvokerHeader, req.InvokerUserID)
	}
	if req.AuthorUserID != "" {
		httpReq.Header.Set(automationAuthorHeader, req.AuthorUserID)
	}
	if req.TraceToken != "" {
		httpReq.Header.Set(automationTraceHeader, req.TraceToken)
	}

	rec := &automationResponse{}
	api.app.ServeInternalPluginRequest(req.ActingUserID, rec, httpReq, api.id, req.PluginID)
	if rec.tooBig {
		return 0, nil, errors.New("automation action result exceeds 1 MiB")
	}
	return rec.status(), rec.body.Bytes(), nil
}
