// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package human

import (
	"fmt"
	"io"
)

type SimpleWriter struct {
	out io.Writer
}

func (w *SimpleWriter) Write(e LogEntry) {
	fmt.Fprintln(w.out, e)
}

func NewSimpleWriter(out io.Writer) *SimpleWriter {
	w := new(SimpleWriter)
	w.out = out
	return w
}
