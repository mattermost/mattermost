package model

// This is a list of all the current versions including any patches.
// It should be maintained in chronological order with most current
// release at the front of the list.
var versions = []string{
	"0.9.0",
	"0.8.2",
	"0.8.1",
	"0.8.0",
	"0.7.3",
	"0.7.2",
	"0.7.1",
	"0.7.0",
	"0.6.7",
	"0.6.6",
	"0.6.5",
	"0.6.2",
	"0.6.1",
	"0.6.0",
	"0.5.0",
}

var (
	CurrentVersion = versions[0]
	BuildNumber    string
	BuildDate      string
	BuildHash      string
	Edition        string
)
