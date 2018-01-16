package procfs

import (
	"testing"
)

func TestNewNamespaces(t *testing.T) {
	p, err := FS("fixtures").NewProc(26231)
	if err != nil {
		t.Fatal(err)
	}

	namespaces, err := p.NewNamespaces()
	if err != nil {
		t.Fatal(err)
	}

	expectedNamespaces := map[string]Namespace{
		"mnt": {"mnt", 4026531840},
		"net": {"net", 4026531993},
	}

	if want, have := len(expectedNamespaces), len(namespaces); want != have {
		t.Errorf("want %d parsed namespaces, have %d", want, have)
	}
	for _, ns := range namespaces {
		if want, have := expectedNamespaces[ns.Type], ns; want != have {
			t.Errorf("%s: want %v, have %v", ns.Type, want, have)
		}
	}
}
