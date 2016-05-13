package gorp_test

import (
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"testing"
)

func TestGorp(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Gorp Suite")
}
