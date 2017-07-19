package dns

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
)

const normal string = `
# Comment
domain somedomain.com
nameserver 10.28.10.2
nameserver 11.28.10.1
`

const missingNewline string = `
domain somedomain.com
nameserver 10.28.10.2
nameserver 11.28.10.1` // <- NOTE: NO newline.

func testConfig(t *testing.T, data string) {
	tempDir, err := ioutil.TempDir("", "")
	if err != nil {
		t.Fatalf("tempDir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	path := filepath.Join(tempDir, "resolv.conf")
	if err := ioutil.WriteFile(path, []byte(data), 0644); err != nil {
		t.Fatalf("writeFile: %v", err)
	}
	cc, err := ClientConfigFromFile(path)
	if err != nil {
		t.Errorf("error parsing resolv.conf: %v", err)
	}
	if l := len(cc.Servers); l != 2 {
		t.Errorf("incorrect number of nameservers detected: %d", l)
	}
	if l := len(cc.Search); l != 1 {
		t.Errorf("domain directive not parsed correctly: %v", cc.Search)
	} else {
		if cc.Search[0] != "somedomain.com" {
			t.Errorf("domain is unexpected: %v", cc.Search[0])
		}
	}
}

func TestNameserver(t *testing.T)          { testConfig(t, normal) }
func TestMissingFinalNewLine(t *testing.T) { testConfig(t, missingNewline) }

func TestNameList(t *testing.T) {
	cfg := ClientConfig{
		Ndots: 1,
	}
	// fqdn should be only result returned
	names := cfg.NameList("miek.nl.")
	if len(names) != 1 {
		t.Errorf("NameList returned != 1 names: %v", names)
	} else if names[0] != "miek.nl." {
		t.Errorf("NameList didn't return sent fqdn domain: %v", names[0])
	}

	cfg.Search = []string{
		"test",
	}
	// Sent domain has NDots and search
	names = cfg.NameList("miek.nl")
	if len(names) != 2 {
		t.Errorf("NameList returned != 2 names: %v", names)
	} else if names[0] != "miek.nl." {
		t.Errorf("NameList didn't return sent domain first: %v", names[0])
	} else if names[1] != "miek.nl.test." {
		t.Errorf("NameList didn't return search last: %v", names[1])
	}

	cfg.Ndots = 2
	// Sent domain has less than NDots and search
	names = cfg.NameList("miek.nl")
	if len(names) != 2 {
		t.Errorf("NameList returned != 2 names: %v", names)
	} else if names[0] != "miek.nl.test." {
		t.Errorf("NameList didn't return search first: %v", names[0])
	} else if names[1] != "miek.nl." {
		t.Errorf("NameList didn't return sent domain last: %v", names[1])
	}
}
