// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

// responsef creates an ephemeral command response using printf syntax.
func responsef(format string, args ...interface{}) *model.CommandResponse {
	return &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		Text:         fmt.Sprintf(format, args...),
		Type:         model.POST_DEFAULT,
	}
}

// parseNamedArgs parses a command string into a map of arguments. It is assumed the
// command string is of the form `<action> --arg1 value1 ...` Supports empty values.
// Arg names are limited to [0-9a-zA-Z_].
func parseNamedArgs(cmd string) map[string]string {
	m := make(map[string]string)

	split := strings.Fields(cmd)

	// check for optional action
	if len(split) >= 2 && !strings.HasPrefix(split[1], "--") {
		m[ActionKey] = split[1] // prefix with hyphen to avoid collision with arg named "action"
	}

	// To support values containing hyphens, we allow all characters up until the next double hyphen.
	// However Go regex does not support negative lookahead, so we fake it by adding extra double hyphens
	// which get eaten by the non-capturing group.
	cmdFixed := strings.ReplaceAll(cmd, "--", "-- --") + " --"

	re := regexp.MustCompile(`(\-\-\w+\s+)(.*?)(?:\-\-)`) //re := regexp.MustCompile(`(\-\-\w+\s+)([^\-]*)`)
	splitArgs := re.FindAllStringSubmatch(cmdFixed, -1)

	for _, arr := range splitArgs {
		arg := strings.TrimSpace(arr[1][2:]) // strip out the leading hyphens
		val := strings.TrimSpace(arr[2])

		if arg != "" {
			m[arg] = val
		}
	}
	return m
}
