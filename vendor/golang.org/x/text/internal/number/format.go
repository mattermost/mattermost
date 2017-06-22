// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package number

import (
	"strconv"

	"golang.org/x/text/language"
)

// TODO:
// - public (but internal) API for creating formatters
// - split out the logic that computes the visible digits from the rest of the
//   formatting code (needed for plural).
// - grouping of fractions
// - reuse percent pattern for permille
// - padding

// Formatter contains all the information needed to render a number.
type Formatter struct {
	*Pattern
	Info
	RoundingContext
	f func(dst []byte, f *Formatter, d *Decimal) []byte
}

func lookupFormat(t language.Tag, tagToIndex []uint8) *Pattern {
	for ; ; t = t.Parent() {
		if ci, ok := language.CompactIndex(t); ok {
			return &formats[tagToIndex[ci]]
		}
	}
}

func (f *Formatter) Format(dst []byte, d *Decimal) []byte {
	return f.f(dst, f, d)
}

func appendDecimal(dst []byte, f *Formatter, d *Decimal) []byte {
	if dst, ok := f.renderSpecial(dst, d); ok {
		return dst
	}
	n := d.normalize()
	if maxSig := int(f.MaxSignificantDigits); maxSig > 0 {
		n.round(ToZero, maxSig)
	}
	digits := n.Digits
	exp := n.Exp

	// Split in integer and fraction part.
	var intDigits, fracDigits []byte
	var numInt, numFrac int
	if exp > 0 {
		numInt = int(exp)
		if int(exp) >= len(digits) { // ddddd | ddddd00
			intDigits = digits
		} else { // ddd.dd
			intDigits = digits[:exp]
			fracDigits = digits[exp:]
			numFrac = len(fracDigits)
		}
	} else {
		fracDigits = digits
		numFrac = -int(exp) + len(digits)
	}
	// Cap integer digits. Remove *most-significant* digits.
	if f.MaxIntegerDigits > 0 && numInt > int(f.MaxIntegerDigits) {
		offset := numInt - int(f.MaxIntegerDigits)
		if offset > len(intDigits) {
			numInt = 0
			intDigits = nil
		} else {
			numInt = int(f.MaxIntegerDigits)
			intDigits = intDigits[offset:]
			// for keeping track of significant digits
			digits = digits[offset:]
		}
		// Strip leading zeros. Resulting number of digits is significant digits.
		for len(intDigits) > 0 && intDigits[0] == 0 {
			intDigits = intDigits[1:]
			digits = digits[1:]
			numInt--
		}
	}
	if f.MaxSignificantDigits == 0 && int(f.MaxFractionDigits) < numFrac {
		if extra := numFrac - int(f.MaxFractionDigits); extra > len(fracDigits) {
			numFrac = 0
			fracDigits = nil
		} else {
			numFrac = int(f.MaxFractionDigits)
			fracDigits = fracDigits[:len(fracDigits)-extra]
		}
	}

	neg := d.Neg && numInt+numFrac > 0
	affix, suffix := f.getAffixes(neg)
	dst = appendAffix(dst, f, affix, neg)
	savedLen := len(dst)

	minInt := int(f.MinIntegerDigits)
	if minInt == 0 && f.MinSignificantDigits > 0 {
		minInt = 1
	}
	// add leading zeros
	for i := numInt; i < minInt; i++ {
		dst = f.AppendDigit(dst, 0)
		if f.needsSep(minInt - i) {
			dst = append(dst, f.Symbol(SymGroup)...)
		}
	}
	i := 0
	for ; i < len(intDigits); i++ {
		dst = f.AppendDigit(dst, intDigits[i])
		if f.needsSep(numInt - i) {
			dst = append(dst, f.Symbol(SymGroup)...)
		}
	}
	for ; i < numInt; i++ {
		dst = f.AppendDigit(dst, 0)
		if f.needsSep(numInt - i) {
			dst = append(dst, f.Symbol(SymGroup)...)
		}
	}

	trailZero := int(f.MinFractionDigits) - numFrac
	if d := int(f.MinSignificantDigits) - len(digits); d > 0 && d > trailZero {
		trailZero = d
	}
	if numFrac > 0 || trailZero > 0 || f.Flags&AlwaysDecimalSeparator != 0 {
		dst = append(dst, f.Symbol(SymDecimal)...)
	}
	// Add leading zeros
	for i := numFrac - len(fracDigits); i > 0; i-- {
		dst = f.AppendDigit(dst, 0)
	}
	i = 0
	for ; i < len(fracDigits); i++ {
		dst = f.AppendDigit(dst, fracDigits[i])
	}
	for ; trailZero > 0; trailZero-- {
		dst = f.AppendDigit(dst, 0)
	}
	// Ensure that at least one digit is written no matter what. This makes
	// things more robust, even though a pattern should always require at least
	// one fraction or integer digit.
	if len(dst) == savedLen {
		dst = f.AppendDigit(dst, 0)
	}
	return appendAffix(dst, f, suffix, neg)
}

func appendScientific(dst []byte, f *Formatter, d *Decimal) []byte {
	if dst, ok := f.renderSpecial(dst, d); ok {
		return dst
	}
	// Significant digits are transformed by parser for scientific notation and
	// do not need to be handled here.
	maxInt, numInt := int(f.MaxIntegerDigits), int(f.MinIntegerDigits)
	if numInt == 0 {
		numInt = 1
	}
	maxSig := int(f.MaxFractionDigits) + numInt
	minSig := int(f.MinFractionDigits) + numInt
	n := d.normalize()
	if maxSig > 0 {
		n.round(ToZero, maxSig)
	}
	digits := n.Digits
	exp := n.Exp

	// If a maximum number of integers is specified, the minimum must be 1
	// and the exponent is grouped by this number (e.g. for engineering)
	if len(digits) == 0 {
		exp = 0
	} else if maxInt > numInt {
		// Correct the exponent to reflect a single integer digit.
		exp--
		numInt = 1
		// engineering
		// 0.01234 ([12345]e-1) -> 1.2345e-2  12.345e-3
		// 12345   ([12345]e+5) -> 1.2345e4  12.345e3
		d := int(exp) % maxInt
		if d < 0 {
			d += maxInt
		}
		exp -= int32(d)
		numInt += d
	} else {
		exp -= int32(numInt)
	}
	var intDigits, fracDigits []byte
	if numInt <= len(digits) {
		intDigits = digits[:numInt]
		fracDigits = digits[numInt:]
	} else {
		intDigits = digits
	}
	neg := d.Neg && len(digits) > 0
	affix, suffix := f.getAffixes(neg)
	dst = appendAffix(dst, f, affix, neg)
	savedLen := len(dst)

	i := 0
	for ; i < len(intDigits); i++ {
		dst = f.AppendDigit(dst, intDigits[i])
		if f.needsSep(numInt - i) {
			dst = append(dst, f.Symbol(SymGroup)...)
		}
	}
	for ; i < numInt; i++ {
		dst = f.AppendDigit(dst, 0)
		if f.needsSep(numInt - i) {
			dst = append(dst, f.Symbol(SymGroup)...)
		}
	}

	trailZero := minSig - numInt - len(fracDigits)
	if len(fracDigits) > 0 || trailZero > 0 || f.Flags&AlwaysDecimalSeparator != 0 {
		dst = append(dst, f.Symbol(SymDecimal)...)
	}
	i = 0
	for ; i < len(fracDigits); i++ {
		dst = f.AppendDigit(dst, fracDigits[i])
	}
	for ; trailZero > 0; trailZero-- {
		dst = f.AppendDigit(dst, 0)
	}
	// Ensure that at least one digit is written no matter what. This makes
	// things more robust, even though a pattern should always require at least
	// one fraction or integer digit.
	if len(dst) == savedLen {
		dst = f.AppendDigit(dst, 0)
	}

	// exp
	dst = append(dst, f.Symbol(SymExponential)...)
	switch {
	case exp < 0:
		dst = append(dst, f.Symbol(SymMinusSign)...)
		exp = -exp
	case f.Flags&AlwaysExpSign != 0:
		dst = append(dst, f.Symbol(SymPlusSign)...)
	}
	buf := [12]byte{}
	b := strconv.AppendUint(buf[:0], uint64(exp), 10)
	for i := len(b); i < int(f.MinExponentDigits); i++ {
		dst = f.AppendDigit(dst, 0)
	}
	for _, c := range b {
		dst = f.AppendDigit(dst, c-'0')
	}
	return appendAffix(dst, f, suffix, neg)
}

func (f *Formatter) getAffixes(neg bool) (affix, suffix string) {
	str := f.Affix
	if str != "" {
		if f.NegOffset > 0 {
			if neg {
				str = str[f.NegOffset:]
			} else {
				str = str[:f.NegOffset]
			}
		}
		sufStart := 1 + str[0]
		affix = str[1:sufStart]
		suffix = str[sufStart+1:]
	} else if neg {
		affix = "-"
	}
	return affix, suffix
}

func (f *Formatter) renderSpecial(dst []byte, d *Decimal) (b []byte, ok bool) {
	if d.NaN {
		return fmtNaN(dst, f), true
	}
	if d.Inf {
		return fmtInfinite(dst, f, d), true
	}
	return dst, false
}

func fmtNaN(dst []byte, f *Formatter) []byte {
	return append(dst, f.Symbol(SymNan)...)
}

func fmtInfinite(dst []byte, f *Formatter, d *Decimal) []byte {
	if d.Neg {
		dst = append(dst, f.Symbol(SymMinusSign)...)
	}
	return append(dst, f.Symbol(SymInfinity)...)
}

func appendAffix(dst []byte, f *Formatter, affix string, neg bool) []byte {
	quoting := false
	escaping := false
	for _, r := range affix {
		switch {
		case escaping:
			// escaping occurs both inside and outside of quotes
			dst = append(dst, string(r)...)
			escaping = false
		case r == '\\':
			escaping = true
		case r == '\'':
			quoting = !quoting
		case !quoting && (r == '-' || r == '+'):
			if neg {
				dst = append(dst, f.Symbol(SymMinusSign)...)
			} else {
				dst = append(dst, f.Symbol(SymPlusSign)...)
			}
		default:
			dst = append(dst, string(r)...)
		}
	}
	return dst
}
