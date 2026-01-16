# Proto directories (relative to server/)
PROTO_SRC_DIR := public/pluginapi/grpc/proto
PROTO_OUT_DIR := public/pluginapi/grpc/generated/go
PROTO_GO_PKG := github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1

# Pin protobuf tools to versions matching go.mod dependencies
PROTOC_GEN_GO_VERSION := v1.36.6
PROTOC_GEN_GO_GRPC_VERSION := v1.5.1

.PHONY: proto-tools proto-gen test-public mocks-public

## Installs protoc-gen-go and protoc-gen-go-grpc at pinned versions
proto-tools:
	@echo Installing protobuf code generation tools...
	$(GO) install google.golang.org/protobuf/cmd/protoc-gen-go@$(PROTOC_GEN_GO_VERSION)
	$(GO) install google.golang.org/grpc/cmd/protoc-gen-go-grpc@$(PROTOC_GEN_GO_GRPC_VERSION)

## Generates Go code from .proto files
proto-gen: proto-tools
	@command -v protoc >/dev/null 2>&1 || { echo "ERROR: protoc is not installed. Please install Protocol Buffers compiler: https://grpc.io/docs/protoc-installation/"; exit 1; }
	@echo Generating Go code from proto files...
	@mkdir -p $(PROTO_OUT_DIR)/pluginapiv1
	protoc \
		--plugin=protoc-gen-go=$(GOBIN)/protoc-gen-go \
		--plugin=protoc-gen-go-grpc=$(GOBIN)/protoc-gen-go-grpc \
		--proto_path=$(PROTO_SRC_DIR) \
		--go_out=$(PROTO_OUT_DIR) \
		--go_opt=paths=source_relative \
		--go_opt=Mcommon.proto=$(PROTO_GO_PKG) \
		--go_opt=Muser.proto=$(PROTO_GO_PKG) \
		--go_opt=Mchannel.proto=$(PROTO_GO_PKG) \
		--go_opt=Mpost.proto=$(PROTO_GO_PKG) \
		--go_opt=Mteam.proto=$(PROTO_GO_PKG) \
		--go_opt=Mfile.proto=$(PROTO_GO_PKG) \
		--go_opt=Mhooks_common.proto=$(PROTO_GO_PKG) \
		--go_opt=Mhooks_lifecycle.proto=$(PROTO_GO_PKG) \
		--go_opt=Mhooks.proto=$(PROTO_GO_PKG) \
		--go-grpc_out=$(PROTO_OUT_DIR) \
		--go-grpc_opt=paths=source_relative \
		--go-grpc_opt=Mcommon.proto=$(PROTO_GO_PKG) \
		--go-grpc_opt=Muser.proto=$(PROTO_GO_PKG) \
		--go-grpc_opt=Mchannel.proto=$(PROTO_GO_PKG) \
		--go-grpc_opt=Mpost.proto=$(PROTO_GO_PKG) \
		--go-grpc_opt=Mteam.proto=$(PROTO_GO_PKG) \
		--go-grpc_opt=Mfile.proto=$(PROTO_GO_PKG) \
		--go-grpc_opt=Mhooks_common.proto=$(PROTO_GO_PKG) \
		--go-grpc_opt=Mhooks_lifecycle.proto=$(PROTO_GO_PKG) \
		--go-grpc_opt=Mhooks.proto=$(PROTO_GO_PKG) \
		$(PROTO_SRC_DIR)/*.proto
	@mv $(PROTO_OUT_DIR)/*.pb.go $(PROTO_OUT_DIR)/pluginapiv1/ 2>/dev/null || true
	@echo Proto generation complete.

test-public: gotestsum
	$(GOBIN)/gotestsum ./public/... -- $(GOFLAGS)

## Generates mock golang interfaces for testing
mocks-public:
	$(GO) install github.com/golang/mock/mockgen@v1.6.0
	$(GOBIN)/mockgen -destination public/pluginapi/experimental/panel/mocks/mock_panel.go -package mock_panel github.com/mattermost/mattermost/server/public/pluginapi/experimental/panel Panel
	$(GOBIN)/mockgen -destination public/pluginapi/experimental/panel/mocks/mock_panelStore.go -package mock_panel github.com/mattermost/mattermost/server/public/pluginapi/experimental/panel Store
	$(GOBIN)/mockgen -destination public/pluginapi/experimental/panel/mocks/mock_setting.go -package mock_panel github.com/mattermost/mattermost/server/public/pluginapi/experimental/panel/settings Setting
	$(GOBIN)/mockgen -destination public/pluginapi/experimental/bot/mocks/mock_bot.go -package mock_bot github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot Bot
	$(GOBIN)/mockgen -destination public/pluginapi/experimental/bot/mocks/mock_logger.go -package mock_bot github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot/logger Logger
	$(GOBIN)/mockgen -destination public/pluginapi/experimental/bot/mocks/mock_poster.go -package mock_bot github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot/poster Poster
	$(GOBIN)/mockgen -destination public/pluginapi/experimental/oauther/mocks/mock_oauther.go -package mock_oauther github.com/mattermost/mattermost/server/public/pluginapi/experimental/oauther OAuther
	$(GOBIN)/mockgen -destination public/pluginapi/experimental/bot/poster/mock_import/mock_postapi.go -package mock_import github.com/mattermost/mattermost/server/public/pluginapi/experimental/bot/poster PostAPI
