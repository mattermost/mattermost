package internal

import (
	"testing"
	. "github.com/onsi/gomega"
	"time"
)

func TestRetryBackoff(t *testing.T) {
	RegisterTestingT(t)
	
	for i := -1; i<= 8; i++ {
		backoff := RetryBackoff(i, 512*time.Millisecond)
		Expect(backoff >= 0).To(BeTrue())
		Expect(backoff <= 512*time.Millisecond).To(BeTrue())
	}
}
