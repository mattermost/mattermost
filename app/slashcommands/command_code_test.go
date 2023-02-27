// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestCodeProviderDoCommand(t *testing.T) {
	cp := CodeProvider{}
	args := &model.CommandArgs{
		T: func(s string, args ...any) string { return s },
	}

	for msg, expected := range map[string]string{
		"":           "api.command_code.message.app_error",
		"foo":        "    foo",
		"foo\nbar":   "    foo\n    bar",
		"foo\nbar\n": "    foo\n    bar\n    ",
	} {
		actual := cp.DoCommand(nil, nil, args, msg).Text
		if actual != expected {
			t.Errorf("expected `%v`, got `%v`", expected, actual)
		}
	}
}
