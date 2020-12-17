// +build !appengine

package docconv

import (
	"bytes"
	"io"
	"log"
	"strings"

	"golang.org/x/net/html"

	"github.com/JalfResi/justext"
)

// ConvertHTML converts HTML into text.
func ConvertHTML(r io.Reader, readability bool) (string, map[string]string, error) {
	meta := make(map[string]string)

	buf := new(bytes.Buffer)
	_, err := buf.ReadFrom(r)
	if err != nil {
		return "", nil, err
	}

	cleanXML, err := Tidy(buf, false)
	if err != nil {
		log.Println("Tidy:", err)
		// Tidy failed, so we now manually tokenize instead
		clean := cleanHTML(buf, true)
		cleanXML = []byte(clean)
		// TODO: remove this log
		log.Println("Cleaned HTML using Golang tokenizer")
	}

	if readability {
		cleanXML = HTMLReadability(bytes.NewReader(cleanXML))
	}
	return HTMLToText(bytes.NewReader(cleanXML)), meta, nil
}

var acceptedHTMLTags = [...]string{
	"div", "p", "br", "span", "body", "head", "html", "ul", "ol", "li", "dl", "dt", "dd", "a", "form", "article",
	"section", "table", "tr", "td", "tbody", "thead", "th", "tfoot", "col", "colgroup", "caption", "form", "input",
	"title", "h1", "h2", "h3", "h4", "h5", "h6", "meta", "strong", "cite", "em", "address", "abbr", "acronym",
	"blockquote", "q", "pre", "samp", "select", "fieldset", "legend", "button", "option", "textarea", "label",
}

// Tests for known friendly HTML parameters that tidy is unlikely to choke on
func acceptedHTMLTag(tagName string) bool {
	for _, tag := range acceptedHTMLTags {
		if tag == tagName {
			return true
		}
	}
	return false
}

// Removes scripts, comments, styles and parameters from HTML.
// Also removes made up tags, e.g. <fb:like>
// Can keep head elements or not. Typically not much in there.
func cleanHTML(r io.Reader, all bool) string {
	output := ""
	if !all {
		output = "<html><head></head>"
	}
	mainSection := false
	junkSection := false

	d := html.NewTokenizer(r)
	for {
		// token type
		tokenType := d.Next()
		if tokenType == html.ErrorToken {
			return output
		}
		token := d.Token()

		switch tokenType {
		case html.StartTagToken: // <tag>
			if token.Data == "body" || (token.Data == "html" && all) {
				mainSection = true
			}
			if !acceptedHTMLTag(token.Data) {
				junkSection = true
			}

			if !junkSection && mainSection {
				output += "<" + token.Data + ">"
			}

		case html.TextToken: // text between start and end tag
			if !junkSection && mainSection {
				output += token.Data
			}

		case html.EndTagToken: // </tag>
			if !junkSection && mainSection {
				output += "</" + token.Data + ">"
			}
			if !acceptedHTMLTag(token.Data) {
				junkSection = false
			}

		case html.SelfClosingTagToken: // <tag/>
			if !junkSection && mainSection {
				output += "<" + token.Data + " />" // TODO: Can probably keep attributes from the meta tags
			}
		}
	}
}

// HTMLReadabilityOptions is a type which defines parameters that are passed to the justext package.
// TODO: Improve this!
type HTMLReadabilityOptions struct {
	LengthLow             int
	LengthHigh            int
	StopwordsLow          float64
	StopwordsHigh         float64
	MaxLinkDensity        float64
	MaxHeadingDistance    int
	ReadabilityUseClasses string
}

// HTMLReadabilityOptionsValues are the global settings used for HTMLReadability.
// TODO: Remove this from global state.
var HTMLReadabilityOptionsValues HTMLReadabilityOptions

// HTMLReadability extracts the readable text in an HTML document
func HTMLReadability(r io.Reader) []byte {
	jr := justext.NewReader(r)

	// TODO: Improve this!
	jr.Stoplist = readabilityStopList
	jr.LengthLow = HTMLReadabilityOptionsValues.LengthLow
	jr.LengthHigh = HTMLReadabilityOptionsValues.LengthHigh
	jr.StopwordsLow = HTMLReadabilityOptionsValues.StopwordsLow
	jr.StopwordsHigh = HTMLReadabilityOptionsValues.StopwordsHigh
	jr.MaxLinkDensity = HTMLReadabilityOptionsValues.MaxLinkDensity
	jr.MaxHeadingDistance = HTMLReadabilityOptionsValues.MaxHeadingDistance

	paragraphSet, err := jr.ReadAll()
	if err != nil {
		log.Println("Justext:", err)
		return nil
	}

	useClasses := strings.SplitN(HTMLReadabilityOptionsValues.ReadabilityUseClasses, ",", 10)

	output := ""
	for _, paragraph := range paragraphSet {
		for _, class := range useClasses {
			if paragraph.CfClass == class {
				output += paragraph.Text + "\n"
			}
		}
	}

	return []byte(output)
}

// HTMLToText converts HTML to plain text.
func HTMLToText(input io.Reader) string {
	text, _ := XMLToText(input, []string{"br", "p", "h1", "h2", "h3", "h4"}, []string{}, false)
	return text
}

var readabilityStopList = map[string]bool{"and": true, "the": true, "a": true, "about": true, "above": true, "across": true, "after": true, "afterwards": true, "again": true, "against": true, "all": true, "almost": true, "alone": true,
	"along": true, "already": true, "also": true, "although": true, "always": true, "am": true, "among": true, "amongst": true, "amoungst": true, "amount": true, "an": true, "another": true, "any": true,
	"anyhow": true, "anyone": true, "anything": true, "anyway": true, "anywhere": true, "are": true, "around": true, "as": true, "at": true, "back": true, "be": true, "became": true, "because": true,
	"become": true, "becomes": true, "becoming": true, "been": true, "before": true, "beforehand": true, "behind": true, "being": true, "below": true, "beside": true, "besides": true, "between": true,
	"beyond": true, "both": true, "bottom": true, "but": true, "by": true, "can": true, "cannot": true, "cant": true, "co": true, "con": true, "could": true, "couldnt": true, "cry": true,
	"de": true, "describe": true, "detail": true, "do": true, "done": true, "down": true, "due": true, "during": true, "each": true, "eg": true, "eight": true, "either": true, "eleven": true, "else": true,
	"elsewhere": true, "empty": true, "enough": true, "etc": true, "even": true, "ever": true, "every": true, "everyone": true, "everything": true, "everywhere": true, "except": true, "few": true,
	"fifteen": true, "fify": true, "fill": true, "find": true, "fire": true, "first": true, "five": true, "for": true, "former": true, "formerly": true, "forty": true, "found": true, "four": true, "from": true,
	"front": true, "full": true, "further": true, "get": true, "give": true, "go": true, "had": true, "has": true, "hasnt": true, "have": true, "he": true, "hence": true, "her": true, "here": true, "hereafter": true,
	"hereby": true, "herein": true, "hereupon": true, "hers": true, "herself": true, "him": true, "himself": true, "his": true, "how": true, "however": true, "hundred": true, "ie": true, "if": true, "in": true,
	"inc": true, "indeed": true, "interest": true, "into": true, "is": true, "it": true, "its": true, "itself": true, "keep": true, "last": true, "latter": true, "latterly": true, "least": true, "less": true,
	"ltd": true, "made": true, "many": true, "may": true, "me": true, "meanwhile": true, "might": true, "mill": true, "mine": true, "more": true, "moreover": true, "most": true, "mostly": true, "move": true,
	"much": true, "must": true, "my": true, "myself": true, "name": true, "namely": true, "neither": true, "never": true, "nevertheless": true, "next": true, "nine": true, "no": true, "nobody": true,
	"none": true, "noone": true, "nor": true, "not": true, "nothing": true, "now": true, "nowhere": true, "of": true, "off": true, "often": true, "on": true, "once": true, "one": true, "only": true, "onto": true,
	"or": true, "other": true, "others": true, "otherwise": true, "our": true, "ours": true, "ourselves": true, "out": true, "over": true, "own": true, "part": true, "per": true, "perhaps": true,
	"please": true, "put": true, "rather": true, "re": true, "same": true, "see": true, "seem": true, "seemed": true, "seeming": true, "seems": true, "serious": true, "several": true, "she": true,
	"should": true, "show": true, "side": true, "since": true, "sincere": true, "six": true, "sixty": true, "so": true, "some": true, "somehow": true, "someone": true, "something": true, "sometime": true,
	"sometimes": true, "somewhere": true, "still": true, "such": true, "take": true, "ten": true, "than": true, "that": true, "their": true, "them": true, "themselves": true,
	"then": true, "thence": true, "there": true, "thereafter": true, "thereby": true, "therefore": true, "therein": true, "thereupon": true, "these": true, "they": true, "thickv": true, "thin": true,
	"third": true, "this": true, "those": true, "though": true, "three": true, "through": true, "throughout": true, "thru": true, "thus": true, "to": true, "together": true, "too": true, "top": true,
	"toward": true, "towards": true, "twelve": true, "twenty": true, "two": true, "un": true, "under": true, "until": true, "up": true, "upon": true, "us": true, "very": true, "via": true, "was": true, "we": true,
	"well": true, "were": true, "what": true, "whatever": true, "when": true, "whence": true, "whenever": true, "where": true, "whereafter": true, "whereas": true, "whereby": true, "wherein": true,
	"whereupon": true, "wherever": true, "whether": true, "which": true, "while": true, "whither": true, "who": true, "whoever": true, "whole": true, "whom": true, "whose": true, "why": true, "will": true,
	"with": true, "within": true, "without": true, "would": true, "yet": true, "you": true, "your": true, "youre": true, "yours": true, "yourself": true, "yourselves": true, "www": true, "com": true, "http": true}
