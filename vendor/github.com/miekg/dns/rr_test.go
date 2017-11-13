package dns

// testRR returns the RR from string s. The error is thrown away.
func testRR(s string) RR {
	r, _ := NewRR(s)
	return r
}
