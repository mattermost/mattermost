package fake

import (
	"testing"
)

func TestPersonal(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := Gender()
		if v == "" {
			t.Errorf("Gender failed with lang %s", lang)
		}

		v = GenderAbbrev()
		if v == "" {
			t.Errorf("GenderAbbrev failed with lang %s", lang)
		}

		v = Language()
		if v == "" {
			t.Errorf("Language failed with lang %s", lang)
		}
	}
}
