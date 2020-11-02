// +build appengine

package docconv

import (
	"io"
	"io/ioutil"
	"log"
)

func HTMLReadability(r io.Reader) []byte {
	b, err := ioutil.ReadAll(r)
	if err != nil {
		log.Printf("HTMLReadability: %v", err)
		return nil
	}
	return b
}
