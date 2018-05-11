package reflect2_test

import (
	"github.com/modern-go/reflect2"
	"testing"
)

type MyStruct struct {
}

func TestTypeByName(t *testing.T) {
	typByPtr := reflect2.TypeOfPtr((*MyStruct)(nil)).Elem()
	typByName := reflect2.TypeByName("reflect2_test.MyStruct")
	if typByName != typByPtr {
		t.Fail()
	}
	typByPkg := reflect2.TypeByPackageName(
		"github.com/modern-go/reflect2_test",
		"MyStruct")
	if typByPkg != typByPtr {
		t.Fail()
	}
}
