// Copyright (C) 2014-2017 Miquel Sabaté Solà <mikisabate@gmail.com>
// This file is licensed under the MIT license.
// See the LICENSE file.

package user_agent

import (
	"regexp"
	"strings"
)

var botFromSiteRegexp = regexp.MustCompile("http://.+\\.\\w+")

// Get the name of the bot from the website that may be in the given comment. If
// there is no website in the comment, then an empty string is returned.
func getFromSite(comment []string) string {
	if len(comment) == 0 {
		return ""
	}

	// Where we should check the website.
	idx := 2
	if len(comment) < 3 {
		idx = 0
	}

	// Pick the site.
	results := botFromSiteRegexp.FindStringSubmatch(comment[idx])
	if len(results) == 1 {
		// If it's a simple comment, just return the name of the site.
		if idx == 0 {
			return results[0]
		}

		// This is a large comment, usually the name will be in the previous
		// field of the comment.
		return strings.TrimSpace(comment[1])
	}
	return ""
}

// Returns true if the info that we currently have corresponds to the Google
// mobile bot. This function also modifies some attributes in the receiver
// accordingly.
func (p *UserAgent) googleBot() bool {
	// This is a hackish way to detect Google's mobile bot.
	if strings.Index(p.ua, "Googlebot") != -1 {
		p.platform = ""
		p.undecided = true
	}
	return p.undecided
}

// Set the attributes of the receiver as given by the parameters. All the other
// parameters are set to empty.
func (p *UserAgent) setSimple(name, version string, bot bool) {
	p.bot = bot
	if !bot {
		p.mozilla = ""
	}
	p.browser.Name = name
	p.browser.Version = version
	p.browser.Engine = ""
	p.browser.EngineVersion = ""
	p.os = ""
	p.localization = ""
}

// Fix some values for some weird browsers.
func (p *UserAgent) fixOther(sections []section) {
	if len(sections) > 0 {
		p.browser.Name = sections[0].name
		p.browser.Version = sections[0].version
		p.mozilla = ""
	}
}

var botRegex = regexp.MustCompile("(?i)(bot|crawler|sp(i|y)der|search|worm|fetch|nutch)")

// Check if we're dealing with a bot or with some weird browser. If that is the
// case, the receiver will be modified accordingly.
func (p *UserAgent) checkBot(sections []section) {
	// If there's only one element, and it's doesn't have the Mozilla string,
	// check whether this is a bot or not.
	if len(sections) == 1 && sections[0].name != "Mozilla" {
		p.mozilla = ""

		// Check whether the name has some suspicious "bot" or "crawler" in his name.
		if botRegex.Match([]byte(sections[0].name)) {
			p.setSimple(sections[0].name, "", true)
			return
		}

		// Tough luck, let's try to see if it has a website in his comment.
		if name := getFromSite(sections[0].comment); name != "" {
			// First of all, this is a bot. Moreover, since it doesn't have the
			// Mozilla string, we can assume that the name and the version are
			// the ones from the first section.
			p.setSimple(sections[0].name, sections[0].version, true)
			return
		}

		// At this point we are sure that this is not a bot, but some weirdo.
		p.setSimple(sections[0].name, sections[0].version, false)
	} else {
		// Let's iterate over the available comments and check for a website.
		for _, v := range sections {
			if name := getFromSite(v.comment); name != "" {
				// Ok, we've got a bot name.
				results := strings.SplitN(name, "/", 2)
				version := ""
				if len(results) == 2 {
					version = results[1]
				}
				p.setSimple(results[0], version, true)
				return
			}
		}

		// We will assume that this is some other weird browser.
		p.fixOther(sections)
	}
}
