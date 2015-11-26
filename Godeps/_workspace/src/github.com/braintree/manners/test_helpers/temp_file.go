package test_helpers

import (
	"io/ioutil"
	"os"
)

type TempFile struct {
	*os.File
}

func NewTempFile(content []byte) (*TempFile, error) {
	f, err := ioutil.TempFile("", "graceful-test")
	if err != nil {
		return nil, err
	}

	f.Write(content)
	return &TempFile{f}, nil
}

func (tf *TempFile) Unlink() {
	if tf.File != nil {
		os.Remove(tf.Name())
		tf.File = nil
	}
}
