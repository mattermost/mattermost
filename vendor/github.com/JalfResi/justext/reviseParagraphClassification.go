package justext

// Context-sensitive paragraph classification. Assumes that classify_pragraphs has already been called.
func reviseParagraphClassification(paragraphs []*Paragraph, maxHeadingDistance int) {

	// Copy classes
	for _, paragraph := range paragraphs {
		paragraph.Class = paragraph.CfClass
	}

	// Good headings
	var j int = 0
	var distance int
	for i, paragraph := range paragraphs {
		if !(paragraph.Heading && paragraph.Class == "short") {
			continue
		}

		j = i + 1
		distance = 0

		for j < len(paragraphs) && distance <= maxHeadingDistance {
			if paragraphs[j].Class == "good" {
				paragraph.Class = "neargood"
				break
			}
			distance += len(paragraphs[j].Text)
			j += 1
		}
	}

	// Classify short
	var newClasses []string = make([]string, len(paragraphs))
	for i, paragraph := range paragraphs {
		if paragraph.Class != "short" {
			continue
		}

		var prevNeighbour string = getPrevNeighbour(i, paragraphs, true)
		var nextNeighbour string = getNextNeighbour(i, paragraphs, true)

		var neighbours map[string]bool = make(map[string]bool)
		neighbours[prevNeighbour] = true
		neighbours[nextNeighbour] = true

		if _, ok := neighbours["good"]; ok && len(neighbours) == 1 {
			newClasses[i] = "good"
		} else if _, ok := neighbours["bad"]; ok && len(neighbours) == 1 {
			newClasses[i] = "bad"
			// neighbours must contain both good and bad
		} else if (prevNeighbour == "bad" && getPrevNeighbour(i, paragraphs, false) == "neargood") || (nextNeighbour == "bad" && getNextNeighbour(i, paragraphs, false) == "neargood") {
			newClasses[i] = "good"
		} else {
			newClasses[i] = "bad"
		}
	}

	for i, c := range newClasses {
		if c != "" {
			paragraphs[i].Class = c
		}
	}

	// revise neargood
	for i, paragraph := range paragraphs {
		if paragraph.Class != "neargood" {
			continue
		}

		var prevNeighbour string = getPrevNeighbour(i, paragraphs, true)
		var nextNeighbour string = getNextNeighbour(i, paragraphs, true)

		if prevNeighbour == "bad" && nextNeighbour == "bad" {
			paragraph.Class = "bad"
		} else {
			paragraph.Class = "good"
		}
	}

	// more good headings
	for i, paragraph := range paragraphs {
		if !(paragraph.Heading && paragraph.Class == "bad" && paragraph.CfClass != "bad") {
			continue
		}
		j = i + 1
		distance = 0
		for j < len(paragraphs) && distance <= maxHeadingDistance {
			if paragraphs[j].Class == "good" {
				paragraph.Class = "good"
				break
			}
			distance += len(paragraphs[j].Text)
			j += 1
		}
	}
}

func getPrevNeighbour(i int, paragraphs []*Paragraph, ignoreNeargood bool) string {
	return getNeighbour(i, paragraphs, ignoreNeargood, -1, -1)
}

func getNextNeighbour(i int, paragraphs []*Paragraph, ignoreNeargood bool) string {
	return getNeighbour(i, paragraphs, ignoreNeargood, 1, len(paragraphs))
}

func getNeighbour(i int, paragraphs []*Paragraph, ignoreNeargood bool, inc int, boundary int) string {
	for i+inc != boundary {
		i += inc
		var c string = paragraphs[i].Class
		if c == "good" || c == "bad" {
			return c
		}
		if c == "neargood" && !ignoreNeargood {
			return c
		}
	}
	return "bad"
}
