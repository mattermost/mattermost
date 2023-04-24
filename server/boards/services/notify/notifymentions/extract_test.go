// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifymentions

import (
	"strings"
	"testing"
)

const (
	s0 = "Zero is in the mind @billy."
	s1 = "This is line 1."
	s2 = "Line two is right here."
	s3 = "Three is the line I am."
	s4 = "'Four score and seven years...', said @lincoln."
	s5 = "Fast Five was arguably the best F&F film."
	s6 = "Big Hero 6 may have an inflated sense of self."
	s7 = "The seventh sign, @sarah, will be a failed unit test."
)

var (
	all       = []string{s0, s1, s2, s3, s4, s5, s6, s7}
	allConcat = strings.Join(all, "\n")

	extractLimits = limits{
		prefixLines:    2,
		prefixMaxChars: 100,
		suffixLines:    2,
		suffixMaxChars: 100,
	}
)

func join(s ...string) string {
	return strings.Join(s, "\n")
}

func Test_extractText(t *testing.T) {
	type args struct {
		s       string
		mention string
		limits  limits
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{name: "good", want: join(s2, s3, s4, s5, s6), args: args{mention: "@lincoln", limits: extractLimits, s: allConcat}},
		{name: "not found", want: "", args: args{mention: "@bogus", limits: extractLimits, s: allConcat}},
		{name: "one line", want: join(s4), args: args{mention: "@lincoln", limits: extractLimits, s: s4}},
		{name: "two lines", want: join(s4, s5), args: args{mention: "@lincoln", limits: extractLimits, s: join(s4, s5)}},
		{name: "zero lines", want: "", args: args{mention: "@lincoln", limits: extractLimits, s: ""}},
		{name: "first line mention", want: join(s0, s1, s2), args: args{mention: "@billy", limits: extractLimits, s: allConcat}},
		{name: "last line mention", want: join(s5[7:], s6, s7), args: args{mention: "@sarah", limits: extractLimits, s: allConcat}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := extractText(tt.args.s, tt.args.mention, tt.args.limits); got != tt.want {
				t.Errorf("extractText()\ngot:\n%v\nwant:\n%v\n", got, tt.want)
			}
		})
	}
}

func Test_safeConcat(t *testing.T) {
	type args struct {
		lines []string
		start int
		end   int
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{name: "out of range", want: join(s0, s1, s2, s3, s4, s5, s6, s7), args: args{start: -22, end: 99, lines: all}},
		{name: "2,3", want: join(s2, s3), args: args{start: 2, end: 4, lines: all}},
		{name: "mismatch", want: "", args: args{start: 4, end: 2, lines: all}},
		{name: "empty", want: "", args: args{start: 2, end: 4, lines: []string{}}},
		{name: "nil", want: "", args: args{start: 2, end: 4, lines: nil}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := safeConcat(tt.args.lines, tt.args.start, tt.args.end); got != tt.want {
				t.Errorf("safeConcat() = [%v], want [%v]", got, tt.want)
			}
		})
	}
}

func Test_safeSubstr(t *testing.T) {
	type args struct {
		s     string
		start int
		end   int
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{name: "good", want: "is line", args: args{start: 33, end: 40, s: join(s0, s1, s2)}},
		{name: "out of range", want: allConcat, args: args{start: -10, end: 1000, s: allConcat}},
		{name: "mismatch", want: "", args: args{start: 33, end: 26, s: allConcat}},
		{name: "empty", want: "", args: args{start: 2, end: 4, s: ""}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := safeSubstr(tt.args.s, tt.args.start, tt.args.end); got != tt.want {
				t.Errorf("safeSubstr()\ngot:\n[%v]\nwant:\n[%v]\n", got, tt.want)
			}
		})
	}
}
