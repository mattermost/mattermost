package fake

import (
	"testing"
)

func TestNames(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := MaleFirstName()
		if v == "" {
			t.Errorf("MaleFirstName failed with lang %s", lang)
		}

		v = FemaleFirstName()
		if v == "" {
			t.Errorf("FemaleFirstName failed with lang %s", lang)
		}

		v = FirstName()
		if v == "" {
			t.Errorf("FirstName failed with lang %s", lang)
		}

		v = MaleLastName()
		if v == "" {
			t.Errorf("MaleLastName failed with lang %s", lang)
		}

		v = FemaleLastName()
		if v == "" {
			t.Errorf("FemaleLastName failed with lang %s", lang)
		}

		v = LastName()
		if v == "" {
			t.Errorf("LastName failed with lang %s", lang)
		}

		v = MalePatronymic()
		if v == "" {
			t.Errorf("MalePatronymic failed with lang %s", lang)
		}

		v = FemalePatronymic()
		if v == "" {
			t.Errorf("FemalePatronymic failed with lang %s", lang)
		}

		v = Patronymic()
		if v == "" {
			t.Errorf("Patronymic failed with lang %s", lang)
		}

		v = MaleFullNameWithPrefix()
		if v == "" {
			t.Errorf("MaleFullNameWithPrefix failed with lang %s", lang)
		}

		v = FemaleFullNameWithPrefix()
		if v == "" {
			t.Errorf("FemaleFullNameWithPrefix failed with lang %s", lang)
		}

		v = FullNameWithPrefix()
		if v == "" {
			t.Errorf("FullNameWithPrefix failed with lang %s", lang)
		}

		v = MaleFullNameWithSuffix()
		if v == "" {
			t.Errorf("MaleFullNameWithSuffix failed with lang %s", lang)
		}

		v = FemaleFullNameWithSuffix()
		if v == "" {
			t.Errorf("FemaleFullNameWithSuffix failed with lang %s", lang)
		}

		v = FullNameWithSuffix()
		if v == "" {
			t.Errorf("FullNameWithSuffix failed with lang %s", lang)
		}

		v = MaleFullName()
		if v == "" {
			t.Errorf("MaleFullName failed with lang %s", lang)
		}

		v = FemaleFullName()
		if v == "" {
			t.Errorf("FemaleFullName failed with lang %s", lang)
		}

		v = FullName()
		if v == "" {
			t.Errorf("FullName failed with lang %s", lang)
		}
	}
}
