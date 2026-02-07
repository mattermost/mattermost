package model

type Config struct {
	ScanRoot    string            `yaml:"scan_root"`
	MaxLogLines int               `yaml:"max_log_lines"`
	Hotkeys     map[string]Hotkey `yaml:"hotkeys"`
}

type Hotkey struct {
	Key    string `yaml:"key"`
	Repo   string `yaml:"repo"`
	Target string `yaml:"target"`
	Label  string `yaml:"label"`
}
