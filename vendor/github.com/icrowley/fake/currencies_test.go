package fake

import (
	"testing"
)

func TestCurrencies(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := Currency()
		if v == "" {
			t.Errorf("Currency failed with lang %s", lang)
		}

		v = CurrencyCode()
		if v == "" {
			t.Errorf("CurrencyCode failed with lang %s", lang)
		}
	}
}
