package fake

import (
	"testing"
)

func TestGeneral(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := Password(4, 10, true, true, true)
		if v == "" {
			t.Errorf("Password failed with lang %s", lang)
		}

		v = SimplePassword()
		if v == "" {
			t.Errorf("SimplePassword failed with lang %s", lang)
		}

		v = Color()
		if v == "" {
			t.Errorf("Color failed with lang %s", lang)
		}

		v = HexColor()
		if v == "" {
			t.Errorf("HexColor failed with lang %s", lang)
		}

		v = HexColorShort()
		if v == "" {
			t.Errorf("HexColorShort failed with lang %s", lang)
		}

		v = DigitsN(2)
		if v == "" {
			t.Errorf("DigitsN failed with lang %s", lang)
		}

		v = Digits()
		if v == "" {
			t.Errorf("Digits failed with lang %s", lang)
		}
	}
}
