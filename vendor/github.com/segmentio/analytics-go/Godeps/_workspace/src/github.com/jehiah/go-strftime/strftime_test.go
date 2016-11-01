package strftime

import (
	"time"
	"fmt"
	"testing"
)

func ExampleFormat() {
	t := time.Unix(1340244776, 0)
	utc, _ := time.LoadLocation("UTC")
	t = t.In(utc)
	fmt.Println(Format("%Y-%m-%d %H:%M:%S", t))
	// Output:
	// 2012-06-21 02:12:56
}

func TestNoLeadingPercentSign(t *testing.T) {
	tm := time.Unix(1340244776, 0)
	utc, _ := time.LoadLocation("UTC")
	tm = tm.In(utc)
	result := Format("aaabbb0123456789%Y", tm)
	if result != "aaabbb01234567892012" {
		t.Logf("%s != %s", result, "aaabbb01234567892012")
		t.Fail()
	}
}


func TestUnsupported(t *testing.T) {
	tm := time.Unix(1340244776, 0)
	utc, _ := time.LoadLocation("UTC")
	tm = tm.In(utc)
	result := Format("%0%1%%%2", tm)
	if result != "%0%1%%2" {
		t.Logf("%s != %s", result, "%0%1%%2")
		t.Fail()
	}
}

