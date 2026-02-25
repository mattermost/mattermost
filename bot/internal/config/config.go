package config

import (
	"os"
	"strings"
)

type Config struct {
	Port                string
	Env                 string
	BotURL              string
	MongoURI            string
	MongoDB             string
	MattermostURL       string
	AttendanceBotToken  string
	BudgetBotToken      string
	BlockMobile         bool
}

func Load() *Config {
	return &Config{
		Port:               getEnv("PORT", "3000"),
		Env:                getEnv("ENV", "development"),
		BotURL:             getEnv("BOT_URL", "http://bot-service:3000"),
		MongoURI:           getEnv("MONGODB_URI", "mongodb://localhost:27017"),
		MongoDB:            getEnv("MONGODB_DATABASE", "oktel"),
		MattermostURL:      strings.TrimRight(getEnv("MATTERMOST_URL", "http://localhost:8065"), "/"),
		AttendanceBotToken: getEnv("ATTENDANCE_BOT_TOKEN", ""),
		BudgetBotToken:     getEnv("BUDGET_BOT_TOKEN", ""),
		BlockMobile:        getEnv("ATTENDANCE_BLOCK_MOBILE", "true") == "true",
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
