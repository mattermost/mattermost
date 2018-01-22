package fake

import (
	"testing"
)

func TestLoremIpsum(t *testing.T) {
	for _, lang := range GetLangs() {
		SetLang(lang)

		v := Character()
		if v == "" {
			t.Errorf("Character failed with lang %s", lang)
		}

		v = CharactersN(2)
		if v == "" {
			t.Errorf("CharactersN failed with lang %s", lang)
		}

		v = Characters()
		if v == "" {
			t.Errorf("Characters failed with lang %s", lang)
		}

		v = Word()
		if v == "" {
			t.Errorf("Word failed with lang %s", lang)
		}

		v = WordsN(2)
		if v == "" {
			t.Errorf("WordsN failed with lang %s", lang)
		}

		v = Words()
		if v == "" {
			t.Errorf("Words failed with lang %s", lang)
		}

		v = Title()
		if v == "" {
			t.Errorf("Title failed with lang %s", lang)
		}

		v = Sentence()
		if v == "" {
			t.Errorf("Sentence failed with lang %s", lang)
		}

		v = SentencesN(2)
		if v == "" {
			t.Errorf("SentencesN failed with lang %s", lang)
		}

		v = Sentences()
		if v == "" {
			t.Errorf("Sentences failed with lang %s", lang)
		}

		v = Paragraph()
		if v == "" {
			t.Errorf("Paragraph failed with lang %s", lang)
		}

		v = ParagraphsN(2)
		if v == "" {
			t.Errorf("ParagraphsN failed with lang %s", lang)
		}

		v = Paragraphs()
		if v == "" {
			t.Errorf("Paragraphs failed with lang %s", lang)
		}
	}
}
