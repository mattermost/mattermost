package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"oktel-bot/internal/config"
	"oktel-bot/internal/handler"
	"oktel-bot/internal/i18n"
	"oktel-bot/internal/mattermost"
	"oktel-bot/internal/service"
	"oktel-bot/internal/store"
)

func main() {
	cfg := config.Load()
	i18n.Init("")

	// Connect to MongoDB
	mainCtx := context.Background()
	db, err := store.NewMongoDB(cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer db.Close(mainCtx)

	// 2 Mattermost clients - one per bot identity
	attendanceMM := mattermost.NewClient(cfg.MattermostURL, cfg.AttendanceBotToken)
	budgetMM := mattermost.NewClient(cfg.MattermostURL, cfg.BudgetBotToken)
	botURL := cfg.BotURL

	// Stores (indexes are created inside each constructor)
	initCtx, cancel := context.WithTimeout(mainCtx, 10*time.Second)
	defer cancel()
	attendanceStore, err := store.NewAttendanceStore(initCtx, db)
	if err != nil {
		log.Fatalf("Failed to init attendance store: %v", err)
	}
	budgetStore, err := store.NewBudgetStore(initCtx, db)
	if err != nil {
		log.Fatalf("Failed to init budget store: %v", err)
	}

	// Services
	attendanceSvc := service.NewAttendanceService(attendanceStore, attendanceMM, botURL)
	budgetSvc := service.NewBudgetService(budgetStore, budgetMM, botURL)

	// Routes
	mux := http.NewServeMux()
	handler.NewAttendanceHandler(attendanceSvc, attendanceMM, botURL, cfg.BlockMobile).RegisterRoutes(mux)
	handler.NewBudgetHandler(budgetSvc, budgetMM, botURL).RegisterRoutes(mux)

	// Health checks
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Start server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler.LoggingMiddleware(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("Bot service started on :%s (env: %s)", cfg.Port, cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
