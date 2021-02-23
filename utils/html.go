// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"html/template"
	"reflect"
	"strings"

	"github.com/mattermost/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/v5/mlog"
)

func TranslateAsHTML(t i18n.TranslateFunc, translationID string, args map[string]interface{}) template.HTML {
	message := t(translationID, escapeForHTML(args))
	message = strings.Replace(message, "[[", "<strong>", -1)
	message = strings.Replace(message, "]]", "</strong>", -1)
	return template.HTML(message)
}

func escapeForHTML(arg interface{}) interface{} {
	switch typedArg := arg.(type) {
	case string:
		return template.HTMLEscapeString(typedArg)
	case *string:
		return template.HTMLEscapeString(*typedArg)
	case map[string]interface{}:
		safeArg := make(map[string]interface{}, len(typedArg))
		for key, value := range typedArg {
			safeArg[key] = escapeForHTML(value)
		}
		return safeArg
	default:
		mlog.Warn(
			"Unable to escape value for HTML template",
			mlog.Any("html_template", arg),
			mlog.String("template_type", reflect.ValueOf(arg).Type().String()),
		)
		return ""
	}
}
