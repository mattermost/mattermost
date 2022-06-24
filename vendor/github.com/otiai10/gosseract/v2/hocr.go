package gosseract

/**
 * NOTE:
 * 	These structs are the very minimum implementation
 *	only to satisfy test assertions.
 * TODO: Extend structs to cover main usecases.
**/

// Page represents `<div class='ocr_page' />`
type Page struct {
	ID      string  `xml:"id,attr"`
	Title   string  `xml:"title,attr"`
	Class   string  `xml:"class,attr"`
	Content Content `xml:"div"`
}

// Content represents `<div class='ocr_carea' />`
type Content struct {
	ID    string `xml:"id,attr"`
	Title string `xml:"title,attr"`
	Class string `xml:"class,attr"`
	Par   Par    `xml:"p"`
}

// Par represents `<p class='ocr_par' />`
type Par struct {
	ID       string `xml:"id,attr"`
	Title    string `xml:"title,attr"`
	Class    string `xml:"class,attr"`
	Language string `xml:"lang,attr"`
	Lines    []Line `xml:"span"`
}

// Line represents `<span class='ocr_line' />`
type Line struct {
	ID    string `xml:"id,attr"`
	Title string `xml:"title,attr"`
	Class string `xml:"class,attr"`
	Words []Word `xml:"span"`
}

// Word represents `<span class='ocr_word' />`
type Word struct {
	ID         string `xml:"id,attr"`
	Title      string `xml:"title,attr"`
	Class      string `xml:"class,attr"`
	Characters string `xml:",chardata"`
}
