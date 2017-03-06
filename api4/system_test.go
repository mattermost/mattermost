package api4

import (
	"testing"
)

func TestGetPing(t *testing.T) {
	th := Setup().InitBasic()
	defer TearDown()
	Client := th.Client

	b, _ := Client.GetPing()
	if b == false  {
		t.Fatal()
	}
}


