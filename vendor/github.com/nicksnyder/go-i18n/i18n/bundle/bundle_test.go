package bundle

import (
	"fmt"
	"testing"

	"reflect"
	"sort"

	"github.com/nicksnyder/go-i18n/i18n/language"
	"github.com/nicksnyder/go-i18n/i18n/translation"
)

func TestMustLoadTranslationFile(t *testing.T) {
	t.Skipf("not implemented")
}

func TestLoadTranslationFile(t *testing.T) {
	t.Skipf("not implemented")
}

func TestParseTranslationFileBytes(t *testing.T) {
	t.Skipf("not implemented")
}

func TestAddTranslation(t *testing.T) {
	t.Skipf("not implemented")
}

func TestMustTfunc(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Errorf("expected MustTfunc to panic")
		}
	}()
	New().MustTfunc("invalid")
}

func TestLanguageTagsAndTranslationIDs(t *testing.T) {
	b := New()
	translationID := "translation_id"
	englishLanguage := languageWithTag("en-US")
	frenchLanguage := languageWithTag("fr-FR")
	spanishLanguage := languageWithTag("es")
	addFakeTranslation(t, b, englishLanguage, "English"+translationID)
	addFakeTranslation(t, b, frenchLanguage, translationID)
	addFakeTranslation(t, b, spanishLanguage, translationID)

	tags := b.LanguageTags()
	sort.Strings(tags)
	compareTo := []string{englishLanguage.Tag, spanishLanguage.Tag, frenchLanguage.Tag}
	if !reflect.DeepEqual(tags, compareTo) {
		t.Errorf("LanguageTags() = %#v; expected: %#v", tags, compareTo)
	}

	ids := b.LanguageTranslationIDs(englishLanguage.Tag)
	sort.Strings(ids)
	compareTo = []string{"English" + translationID}
	if !reflect.DeepEqual(ids, compareTo) {
		t.Errorf("LanguageTranslationIDs() = %#v; expected: %#v", ids, compareTo)
	}
}

func TestTfuncAndLanguage(t *testing.T) {
	b := New()
	translationID := "translation_id"
	englishLanguage := languageWithTag("en-US")
	frenchLanguage := languageWithTag("fr-FR")
	spanishLanguage := languageWithTag("es")
	chineseLanguage := languageWithTag("zh-hans-cn")
	englishTranslation := addFakeTranslation(t, b, englishLanguage, translationID)
	frenchTranslation := addFakeTranslation(t, b, frenchLanguage, translationID)
	spanishTranslation := addFakeTranslation(t, b, spanishLanguage, translationID)
	chineseTranslation := addFakeTranslation(t, b, chineseLanguage, translationID)

	tests := []struct {
		languageIDs      []string
		result           string
		expectedLanguage *language.Language
	}{
		{
			[]string{"invalid"},
			translationID,
			nil,
		},
		{
			[]string{"invalid", "invalid2"},
			translationID,
			nil,
		},
		{
			[]string{"invalid", "en-US"},
			englishTranslation,
			englishLanguage,
		},
		{
			[]string{"en-US", "invalid"},
			englishTranslation,
			englishLanguage,
		},
		{
			[]string{"en-US", "fr-FR"},
			englishTranslation,
			englishLanguage,
		},
		{
			[]string{"invalid", "es"},
			spanishTranslation,
			spanishLanguage,
		},
		{
			[]string{"zh-CN,fr-XX,es"},
			spanishTranslation,
			spanishLanguage,
		},
		{
			[]string{"fr"},
			frenchTranslation,

			// The language is still "fr" even though the translation is provided by "fr-FR"
			languageWithTag("fr"),
		},
		{
			[]string{"zh"},
			chineseTranslation,

			// The language is still "zh" even though the translation is provided by "zh-hans-cn"
			languageWithTag("zh"),
		},
		{
			[]string{"zh-hans"},
			chineseTranslation,

			// The language is still "zh-hans" even though the translation is provided by "zh-hans-cn"
			languageWithTag("zh-hans"),
		},
		{
			[]string{"zh-hans-cn"},
			chineseTranslation,
			languageWithTag("zh-hans-cn"),
		},
	}

	for i, test := range tests {
		tf, lang, err := b.TfuncAndLanguage(test.languageIDs[0], test.languageIDs[1:]...)
		if err != nil && test.expectedLanguage != nil {
			t.Errorf("Tfunc(%v) = error{%q}; expected no error", test.languageIDs, err)
		}
		if err == nil && test.expectedLanguage == nil {
			t.Errorf("Tfunc(%v) = nil error; expected error", test.languageIDs)
		}
		if result := tf(translationID); result != test.result {
			t.Errorf("translation %d was %s; expected %s", i, result, test.result)
		}
		if (lang == nil && test.expectedLanguage != nil) ||
			(lang != nil && test.expectedLanguage == nil) ||
			(lang != nil && test.expectedLanguage != nil && lang.String() != test.expectedLanguage.String()) {
			t.Errorf("lang %d was %s; expected %s", i, lang, test.expectedLanguage)
		}
	}
}

func addFakeTranslation(t *testing.T, b *Bundle, lang *language.Language, translationID string) string {
	translation := fakeTranslation(lang, translationID)
	b.AddTranslation(lang, testNewTranslation(t, map[string]interface{}{
		"id":          translationID,
		"translation": translation,
	}))
	return translation
}

func fakeTranslation(lang *language.Language, translationID string) string {
	return fmt.Sprintf("%s(%s)", lang.Tag, translationID)
}

func testNewTranslation(t *testing.T, data map[string]interface{}) translation.Translation {
	translation, err := translation.NewTranslation(data)
	if err != nil {
		t.Fatal(err)
	}
	return translation
}

func languageWithTag(tag string) *language.Language {
	return language.MustParse(tag)[0]
}

func createBenchmarkTranslateFunc(b *testing.B, translationTemplate interface{}, count interface{}, expected string) func(data interface{}) {
	bundle := New()
	lang := "en-US"
	translationID := "translation_id"
	translation, err := translation.NewTranslation(map[string]interface{}{
		"id":          translationID,
		"translation": translationTemplate,
	})
	if err != nil {
		b.Fatal(err)
	}
	bundle.AddTranslation(languageWithTag(lang), translation)
	tf, err := bundle.Tfunc(lang)
	if err != nil {
		b.Fatal(err)
	}
	return func(data interface{}) {
		var result string
		if count == nil {
			result = tf(translationID, data)
		} else {
			result = tf(translationID, count, data)
		}
		if result != expected {
			b.Fatalf("expected %q, got %q", expected, result)
		}
	}
}

func createBenchmarkPluralTranslateFunc(b *testing.B) func(data interface{}) {
	translationTemplate := map[string]interface{}{
		"one":   "{{.Person}} is {{.Count}} year old.",
		"other": "{{.Person}} is {{.Count}} years old.",
	}
	count := 26
	expected := "Bob is 26 years old."
	return createBenchmarkTranslateFunc(b, translationTemplate, count, expected)
}

func createBenchmarkNonPluralTranslateFunc(b *testing.B) func(data interface{}) {
	translationTemplate := "Hi {{.Person}}!"
	expected := "Hi Bob!"
	return createBenchmarkTranslateFunc(b, translationTemplate, nil, expected)
}

func BenchmarkTranslateNonPluralWithMap(b *testing.B) {
	data := map[string]interface{}{
		"Person": "Bob",
	}
	tf := createBenchmarkNonPluralTranslateFunc(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tf(data)
	}
}

func BenchmarkTranslateNonPluralWithStruct(b *testing.B) {
	data := struct{ Person string }{Person: "Bob"}
	tf := createBenchmarkNonPluralTranslateFunc(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tf(data)
	}
}

func BenchmarkTranslateNonPluralWithStructPointer(b *testing.B) {
	data := &struct{ Person string }{Person: "Bob"}
	tf := createBenchmarkNonPluralTranslateFunc(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tf(data)
	}
}

func BenchmarkTranslatePluralWithMap(b *testing.B) {
	data := map[string]interface{}{
		"Person": "Bob",
	}
	tf := createBenchmarkPluralTranslateFunc(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tf(data)
	}
}

func BenchmarkTranslatePluralWithStruct(b *testing.B) {
	data := struct{ Person string }{Person: "Bob"}
	tf := createBenchmarkPluralTranslateFunc(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tf(data)
	}
}

func BenchmarkTranslatePluralWithStructPointer(b *testing.B) {
	data := &struct{ Person string }{Person: "Bob"}
	tf := createBenchmarkPluralTranslateFunc(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tf(data)
	}
}
