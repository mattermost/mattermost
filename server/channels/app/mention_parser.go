package app

type MentionParser interface {
	ProcessText(text string)
	Results() *MentionResults
}
