package goose

import (
	"github.com/fatih/set"
)

//some word statistics
type wordStats struct {
	//total number of stopwords or good words that we can calculate
	stopWordCount int
	//total number of words on a node
	wordCount int
	//holds an actual list of the stop words we found
	stopWords *set.Set
}

func (w *wordStats) getStopWords() *set.Set {
	return w.stopWords
}

func (w *wordStats) setStopWords(stopWords *set.Set) {
	w.stopWords = stopWords
}

func (w *wordStats) getStopWordCount() int {
	return w.stopWordCount
}

func (w *wordStats) setStopWordCount(stopWordCount int) {
	w.stopWordCount = stopWordCount
}

func (w *wordStats) getWordCount() int {
	return w.wordCount
}

func (w *wordStats) setWordCount(wordCount int) {
	w.wordCount = wordCount
}
