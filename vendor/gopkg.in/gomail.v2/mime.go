// +build go1.5

package gomail

import (
	"mime"
	"mime/quotedprintable"
)

var newQPWriter = quotedprintable.NewWriter

type mimeEncoder struct {
	mime.WordEncoder
}

var (
	bEncoding = mimeEncoder{mime.BEncoding}
	qEncoding = mimeEncoder{mime.QEncoding}
)
