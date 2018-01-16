package fake

import (
	"testing"
)

func TestSetLang(t *testing.T) {
	err := SetLang("ru")
	if err != nil {
		t.Error("SetLang should successfully set lang")
	}

	err = SetLang("sd")
	if err == nil {
		t.Error("SetLang with nonexistent lang should return error")
	}
}

func TestFakerRuWithoutCallback(t *testing.T) {
	SetLang("ru")
	EnFallback(false)
	brand := Brand()
	if brand != "" {
		t.Error("Fake call with no samples should return blank string")
	}
}

func TestFakerRuWithCallback(t *testing.T) {
	SetLang("ru")
	EnFallback(true)
	brand := Brand()
	if brand == "" {
		t.Error("Fake call for name with no samples with callback should not return blank string")
	}
}

// TestConcurrentSafety runs fake methods in multiple go routines concurrently.
// This test should be run with the race detector enabled.
func TestConcurrentSafety(t *testing.T) {
	workerCount := 10
	doneChan := make(chan struct{})

	for i := 0; i < workerCount; i++ {
		go func() {
			for j := 0; j < 1000; j++ {
				FirstName()
				LastName()
				Gender()
				FullName()
				Day()
				Country()
				Company()
				Industry()
				Street()
			}
			doneChan <- struct{}{}
		}()
	}

	for i := 0; i < workerCount; i++ {
		<-doneChan
	}
}
