package elastic

import (
	"net/url"
	"reflect"
	"testing"
)

func TestSnapshotValidate(t *testing.T) {
	var client *Client

	err := NewSnapshotCreateService(client).Validate()
	got := err.Error()
	expected := "missing required fields: [Repository Snapshot]"
	if got != expected {
		t.Errorf("expected %q; got: %q", expected, got)
	}
}

func TestSnapshotPutURL(t *testing.T) {
	client := setupTestClient(t)

	tests := []struct {
		Repository        string
		Snapshot          string
		Pretty            bool
		MasterTimeout     string
		WaitForCompletion bool
		ExpectedPath      string
		ExpectedParams    url.Values
	}{
		{
			Repository:        "repo",
			Snapshot:          "snapshot_of_sunday",
			Pretty:            true,
			MasterTimeout:     "60s",
			WaitForCompletion: true,
			ExpectedPath:      "/_snapshot/repo/snapshot_of_sunday",
			ExpectedParams: url.Values{
				"pretty":              []string{"1"},
				"master_timeout":      []string{"60s"},
				"wait_for_completion": []string{"true"},
			},
		},
	}

	for _, test := range tests {
		path, params, err := client.SnapshotCreate(test.Repository, test.Snapshot).
			Pretty(test.Pretty).
			MasterTimeout(test.MasterTimeout).
			WaitForCompletion(test.WaitForCompletion).
			buildURL()
		if err != nil {
			t.Fatal(err)
		}
		if path != test.ExpectedPath {
			t.Errorf("expected %q; got: %q", test.ExpectedPath, path)
		}
		if !reflect.DeepEqual(params, test.ExpectedParams) {
			t.Errorf("expected %q; got: %q", test.ExpectedParams, params)
		}
	}
}
