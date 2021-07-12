package common

// Partition create partitions considering the passed amount
func Partition(items []string, maxItems int) [][]string {
	var splitted [][]string

	for i := 0; i < len(items); i += maxItems {
		end := i + maxItems

		if end > len(items) {
			end = len(items)
		}

		splitted = append(splitted, items[i:end])
	}

	return splitted
}
