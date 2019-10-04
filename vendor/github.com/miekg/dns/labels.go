package dns

// Holds a bunch of helper functions for dealing with labels.

// SplitDomainName splits a name string into it's labels.
// www.miek.nl. returns []string{"www", "miek", "nl"}
// .www.miek.nl. returns []string{"", "www", "miek", "nl"},
// The root label (.) returns nil. Note that using
// strings.Split(s) will work in most cases, but does not handle
// escaped dots (\.) for instance.
// s must be a syntactically valid domain name, see IsDomainName.
func SplitDomainName(s string) (labels []string) {
	if len(s) == 0 {
		return nil
	}
	if s == "." {
		return nil
	}
	// offset of the final '.' or the length of the name
	var fqdnEnd int
	if IsFqdn(s) {
		fqdnEnd = len(s) - 1
	} else {
		fqdnEnd = len(s)
	}
	var (
		begin int
		off   int
		end   bool
	)
	for {
		off, end = NextLabel(s, off)
		if end {
			break
		}
		labels = append(labels, s[begin:off-1])
		begin = off
	}
	return append(labels, s[begin:fqdnEnd])
}

// CompareDomainName compares the names s1 and s2 and
// returns how many labels they have in common starting from the *right*.
// The comparison stops at the first inequality. The names are downcased
// before the comparison.
//
// www.miek.nl. and miek.nl. have two labels in common: miek and nl
// www.miek.nl. and www.bla.nl. have one label in common: nl
//
// s1 and s2 must be syntactically valid domain names.
func CompareDomainName(s1, s2 string) (n int) {
	// the first check: root label
	if s1 == "." || s2 == "." {
		return 0
	}

	j1 := len(s1)
	if s1[j1-1] == '.' {
		j1--
	}
	j2 := len(s2)
	if s2[j2-1] == '.' {
		j2--
	}
	var i1, i2 int
	for {
		i1 = prevLabel(s1, j1-1)
		i2 = prevLabel(s2, j2-1)
		if equal(s1[i1:j1], s2[i2:j2]) {
			n++
		} else {
			break
		}
		if i1 == 0 || i2 == 0 {
			break
		}
		j1 = i1 - 2
		j2 = i2 - 2
	}
	return
}

// CountLabel counts the the number of labels in the string s.
// s must be a syntactically valid domain name.
func CountLabel(s string) int {
	if s == "." {
		return 0
	}
	labels := 1
	for i := 0; i < len(s)-1; i++ {
		c := s[i]
		if c == '\\' {
			i++
			continue
		}
		if c == '.' {
			labels++
		}
	}
	return labels
}

// Split splits a name s into its label indexes.
// www.miek.nl. returns []int{0, 4, 9}, www.miek.nl also returns []int{0, 4, 9}.
// The root name (.) returns nil. Also see SplitDomainName.
// s must be a syntactically valid domain name.
func Split(s string) []int {
	if s == "." {
		return nil
	}
	idx := make([]int, 1, 3)
	off := 0
	end := false

	for {
		off, end = NextLabel(s, off)
		if end {
			return idx
		}
		idx = append(idx, off)
	}
}

// NextLabel returns the index of the start of the next label in the
// string s starting at offset.
// The bool end is true when the end of the string has been reached.
// Also see PrevLabel.
func NextLabel(s string, offset int) (i int, end bool) {
	for i = offset; i < len(s)-1; i++ {
		c := s[i]
		if c == '\\' {
			i++
			continue
		}
		if c == '.' {
			return i + 1, false
		}
	}
	return i + 1, true
}

func prevLabel(s string, offset int) int {
	for i := offset; i >= 0; i-- {
		if s[i] == '.' {
			if i == 0 || s[i-1] != '\\' {
				return i + 1 // the '.' is not escaped
			}
			// We are at '\.' and need to check if the '\' itself is escaped.
			// We do this by walking backwards from '\.' and counting the
			// number of '\' we encounter.  If the number of '\' is even
			// (though here it's actually odd since we start at '\.') the '\'
			// is escaped.
			j := i - 2
			for ; j >= 0 && s[j] == '\\'; j-- {
			}
			// An odd number here indicates that the '\' preceding the '.'
			// is escaped.
			if (i-j)&1 == 1 {
				return i + 1
			}
			i = j + 1
		}
	}
	return 0
}

// PrevLabel returns the index of the label when starting from the right and
// jumping n labels to the left.
// The bool start is true when the start of the string has been overshot.
// Also see NextLabel.
func PrevLabel(s string, n int) (i int, start bool) {
	if s == "." {
		return 0, true
	}
	if n == 0 {
		return len(s), false
	}
	i = len(s) - 1
	if s[i] == '.' {
		i--
	}
	for ; n > 0; n-- {
		i = prevLabel(s, i)
		if i == 0 {
			break
		}
		i -= 2
	}
	if n > 0 {
		return 0, true
	}
	return i + 2, false
}

// equal compares a and b while ignoring case. It returns true when equal otherwise false.
func equal(a, b string) bool {
	// might be lifted into API function.
	la := len(a)
	lb := len(b)
	if la != lb {
		return false
	}
	if a != b {
		// case-insensitive comparison
		for i := la - 1; i >= 0; i-- {
			ai := a[i]
			bi := b[i]
			if ai != bi {
				if bi < ai {
					bi, ai = ai, bi
				}
				if !('A' <= ai && ai <= 'Z' && bi == ai+'a'-'A') {
					return false
				}
			}
		}
	}
	return true
}
