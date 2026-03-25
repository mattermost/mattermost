package server

func overlapFunc(T func(string) string) string {
	return T("shared.overlap.key")
}
