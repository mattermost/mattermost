package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContainsCJK(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		s    string
		want bool
	}{
		{name: "empty string", s: "", want: false},
		{name: "latin only", s: "hello world", want: false},
		{name: "chinese characters", s: "你好", want: true},
		{name: "japanese hiragana", s: "こんにちは", want: true},
		{name: "japanese katakana", s: "カタカナ", want: true},
		{name: "korean hangul", s: "안녕하세요", want: true},
		{name: "mixed latin and chinese", s: "hello 你好 world", want: true},
		{name: "mixed latin and japanese", s: "test こんにちは", want: true},
		{name: "cyrillic not CJK", s: "слово", want: false},
		{name: "special characters only", s: "!@#$%^&*()", want: false},
		{name: "numbers only", s: "12345", want: false},
		{name: "single CJK char", s: "中", want: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ContainsCJK(tc.s)
			require.Equal(t, tc.want, got)
		})
	}
}
