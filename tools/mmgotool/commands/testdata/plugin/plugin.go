package plugin

func doPlugin(T func(string) string) string {
	return T("plugin.hook.error")
}
