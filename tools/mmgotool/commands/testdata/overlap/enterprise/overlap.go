package enterprise

func overlapEntFunc(T func(string) string) string {
	return T("shared.overlap.key")
}
