package elastic

import (
	"context"
	"testing"
)

func TestIndicesAnalyzeURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Index    string
		Expected string
	}{
		{
			"",
			"/_analyze",
		},
		{
			"tweets",
			"/tweets/_analyze",
		},
	}

	for _, test := range tests {
		path, _, err := client.IndexAnalyze().Index(test.Index).buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.Expected {
			t.Errorf("expected %q; got: %q", test.Expected, path)
		}
	}
}

func TestIndicesAnalyze(t *testing.T) {
	client := setupTestClient(t)
	// client := setupTestClientAndCreateIndexAndLog(t, SetTraceLog(log.New(os.Stdout, "", 0)))

	res, err := client.IndexAnalyze().Text("hello hi guy").Do(context.TODO())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(res.Tokens) != 3 {
		t.Fatalf("expected %d, got %d (%+v)", 3, len(res.Tokens), res.Tokens)
	}
}

func TestIndicesAnalyzeDetail(t *testing.T) {
	client := setupTestClient(t)
	// client := setupTestClientAndCreateIndexAndLog(t, SetTraceLog(log.New(os.Stdout, "", 0)))

	res, err := client.IndexAnalyze().Text("hello hi guy").Explain(true).Do(context.TODO())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(res.Detail.Analyzer.Tokens) != 3 {
		t.Fatalf("expected %d tokens, got %d (%+v)", 3, len(res.Detail.Tokenizer.Tokens), res.Detail.Tokenizer.Tokens)
	}
}

func TestIndicesAnalyzeWithIndex(t *testing.T) {
	client := setupTestClient(t)

	_, err := client.IndexAnalyze().Index("foo").Text("hello hi guy").Do(context.TODO())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if want, have := "elastic: Error 404 (Not Found): no such index [type=index_not_found_exception]", err.Error(); want != have {
		t.Fatalf("expected error %q, got %q", want, have)
	}
}

func TestIndicesAnalyzeValidate(t *testing.T) {
	client := setupTestClient(t)

	_, err := client.IndexAnalyze().Do(context.TODO())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if want, have := "missing required fields: [Text]", err.Error(); want != have {
		t.Fatalf("expected error %q, got %q", want, have)
	}
}
