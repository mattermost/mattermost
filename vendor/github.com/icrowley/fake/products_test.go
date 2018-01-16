package fake

import (
	"testing"
)

func TestProducts(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := Brand()
		if v == "" {
			t.Errorf("Brand failed with lang %s", lang)
		}

		v = ProductName()
		if v == "" {
			t.Errorf("ProductName failed with lang %s", lang)
		}

		v = Product()
		if v == "" {
			t.Errorf("Product failed with lang %s", lang)
		}

		v = Model()
		if v == "" {
			t.Errorf("Model failed with lang %s", lang)
		}
	}
}
