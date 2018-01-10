package afero

import "testing"

func TestCopyOnWrite(t *testing.T) {
	var fs Fs
	var err error
	base := NewOsFs()
	roBase := NewReadOnlyFs(base)
	ufs := NewCopyOnWriteFs(roBase, NewMemMapFs())
	fs = ufs
	err = fs.MkdirAll("nonexistent/directory/", 0744)
	if err != nil {
		t.Error(err)
		return
	}
	_, err = fs.Create("nonexistent/directory/newfile")
	if err != nil {
		t.Error(err)
		return
	}

}

func TestCopyOnWriteFileInMemMapBase(t *testing.T) {
	base := &MemMapFs{}
	layer := &MemMapFs{}

	if err := WriteFile(base, "base.txt", []byte("base"), 0755); err != nil {
		t.Fatalf("Failed to write file: %s", err)
	}

	ufs := NewCopyOnWriteFs(base, layer)

	_, err := ufs.Stat("base.txt")
	if err != nil {
		t.Fatal(err)
	}
}
