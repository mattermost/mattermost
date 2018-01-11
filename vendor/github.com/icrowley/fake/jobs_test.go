package fake

import (
	"testing"
)

func TestJobs(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := Company()
		if v == "" {
			t.Errorf("Company failed with lang %s", lang)
		}

		v = JobTitle()
		if v == "" {
			t.Errorf("JobTitle failed with lang %s", lang)
		}

		v = Industry()
		if v == "" {
			t.Errorf("Industry failed with lang %s", lang)
		}
	}
}
