package fake

import (
	"testing"
)

func TestCreditCards(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := CreditCardType()
		if v == "" {
			t.Errorf("CreditCardType failed with lang %s", lang)
		}

		v = CreditCardNum("")
		if v == "" {
			t.Errorf("CreditCardNum failed with lang %s", lang)
		}

		v = CreditCardNum("visa")
		if v == "" {
			t.Errorf("CreditCardNum failed with lang %s", lang)
		}
	}
}
