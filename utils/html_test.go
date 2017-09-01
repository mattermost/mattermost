// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"html/template"
	"testing"
)

func TestTranslateAsHtml(t *testing.T) {
	TranslationsPreInit()

	translateFunc := TfuncWithFallback("en")

	expected := "To finish updating your email address for YOUR TEAM HERE, please click the link below to confirm this is the right address."
	if actual := TranslateAsHtml(translateFunc, "api.templates.email_change_verify_body.info",
		map[string]interface{}{"TeamDisplayName": "YOUR TEAM HERE"}); actual != template.HTML(expected) {
		t.Fatalf("Incorrectly translated template, got %v, expected %v", actual, expected)
	}

	expected = "To finish updating your email address for &lt;b&gt;YOUR TEAM HERE&lt;/b&gt;, please click the link below to confirm this is the right address."
	if actual := TranslateAsHtml(translateFunc, "api.templates.email_change_verify_body.info",
		map[string]interface{}{"TeamDisplayName": "<b>YOUR TEAM HERE</b>"}); actual != template.HTML(expected) {
		t.Fatalf("Incorrectly translated template, got %v, expected %v", actual, expected)
	}
}

func TestEscapeForHtml(t *testing.T) {
	input := "abc"
	expected := "abc"
	if actual := escapeForHtml(input).(string); actual != expected {
		t.Fatalf("incorrectly escaped %v, got %v expected %v", input, actual, expected)
	}

	input = "<b>abc</b>"
	expected = "&lt;b&gt;abc&lt;/b&gt;"
	if actual := escapeForHtml(input).(string); actual != expected {
		t.Fatalf("incorrectly escaped %v, got %v expected %v", input, actual, expected)
	}

	inputMap := map[string]interface{}{
		"abc": "abc",
		"123": "<b>123</b>",
	}
	expectedMap := map[string]interface{}{
		"abc": "abc",
		"123": "&lt;b&gt;123&lt;/b&gt;",
	}
	if actualMap := escapeForHtml(inputMap).(map[string]interface{}); actualMap["abc"] != expectedMap["abc"] || actualMap["123"] != expectedMap["123"] {
		t.Fatalf("incorrectly escaped %v, got %v expected %v", inputMap, actualMap, expectedMap)
	}
}
