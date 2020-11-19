package docconv

import (
	"bytes"
	"io"

	"github.com/advancedlogic/GoOse"
)

// ConvertURL fetches the HTML page at the URL given in the io.Reader.
func ConvertURL(input io.Reader, readability bool) (string, map[string]string, error) {
	meta := make(map[string]string)

	buf := new(bytes.Buffer)
	_, err := buf.ReadFrom(input)
	if err != nil {
		return "", nil, err
	}

	g := goose.New()
	article, err := g.ExtractFromURL(buf.String())
	if err != nil {
		return "", nil, err
	}

	meta["title"] = article.Title
	meta["description"] = article.MetaDescription
	meta["image"] = article.TopImage

	return article.CleanedText, meta, nil
}
