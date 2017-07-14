package app

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestCodeProviderDoCommand(t *testing.T) {
	for msg, expected := range map[string]string{
		"":           "",
		"foo":        "    foo",
		"foo\nbar":   "    foo\n    bar",
		"foo\nbar\n": "    foo\n    bar\n    ",
	} {
		cp := CodeProvider{}
		actual := cp.DoCommand(&model.CommandArgs{}, msg).Text
		if actual != expected {
			t.Errorf("expected `%v`, got `%v`", expected, actual)
		}
	}
}
