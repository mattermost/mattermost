package fake

import (
	"testing"
)

func TestAddresses(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := Continent()
		if v == "" {
			t.Errorf("Continent failed with lang %s", lang)
		}

		v = Country()
		if v == "" {
			t.Errorf("Country failed with lang %s", lang)
		}

		v = City()
		if v == "" {
			t.Errorf("City failed with lang %s", lang)
		}

		v = State()
		if v == "" {
			t.Errorf("State failed with lang %s", lang)
		}

		v = StateAbbrev()
		if v == "" && lang == "en" {
			t.Errorf("StateAbbrev failed with lang %s", lang)
		}

		v = Street()
		if v == "" {
			t.Errorf("Street failed with lang %s", lang)
		}

		v = StreetAddress()
		if v == "" {
			t.Errorf("StreetAddress failed with lang %s", lang)
		}

		v = Zip()
		if v == "" {
			t.Errorf("Zip failed with lang %s", lang)
		}

		v = Phone()
		if v == "" {
			t.Errorf("Phone failed with lang %s", lang)
		}
	}
}
