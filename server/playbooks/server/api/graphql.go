// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	_ "embed"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/graph-gophers/dataloader/v7"
	graphql "github.com/graph-gophers/graphql-go"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/config"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/playbooks"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

type GraphQLHandler struct {
	*ErrorHandler
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
	categoryService    app.CategoryService
	api                playbooks.ServicesAPI
	config             config.Service
	permissions        *app.PermissionsService
	playbookStore      app.PlaybookStore
	licenceChecker     app.LicenseChecker

	schema *graphql.Schema
}

//go:embed schema.graphqls
var SchemaFile string

func NewGraphQLHandler(
	router *mux.Router,
	playbookService app.PlaybookService,
	playbookRunService app.PlaybookRunService,
	categoryService app.CategoryService,
	api playbooks.ServicesAPI,
	configService config.Service,
	permissions *app.PermissionsService,
	playbookStore app.PlaybookStore,
	licenceChecker app.LicenseChecker,
) *GraphQLHandler {
	handler := &GraphQLHandler{
		ErrorHandler:       &ErrorHandler{},
		playbookService:    playbookService,
		playbookRunService: playbookRunService,
		categoryService:    categoryService,
		api:                api,
		config:             configService,
		permissions:        permissions,
		playbookStore:      playbookStore,
		licenceChecker:     licenceChecker,
	}

	opts := []graphql.SchemaOpt{
		graphql.UseFieldResolvers(),
		graphql.MaxParallelism(5),
	}

	if !configService.IsConfiguredForDevelopmentAndTesting() {
		opts = append(opts,
			graphql.MaxDepth(8),
			graphql.DisableIntrospection(),
		)
	}

	root := &RootResolver{}
	var err error
	handler.schema, err = graphql.ParseSchema(SchemaFile, root, opts...)
	if err != nil {
		logrus.WithError(err).Error("unable to parse graphql schema")
		return nil
	}

	router.HandleFunc("/query", withContext(graphiQL)).Methods("GET")
	router.HandleFunc("/query", withContext(handler.graphQL)).Methods("POST")

	return handler
}

type ctxKey struct{}

type GraphQLContext struct {
	r                  *http.Request
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
	playbookStore      app.PlaybookStore
	categoryService    app.CategoryService
	api                playbooks.ServicesAPI
	logger             logrus.FieldLogger
	config             config.Service
	permissions        *app.PermissionsService
	licenceChecker     app.LicenseChecker
	favoritesLoader    *dataloader.Loader[favoriteInfo, bool]
	playbooksLoader    *dataloader.Loader[playbookInfo, *app.Playbook]
}

// When moving over to the multi-product architecture this should be handled by the server.
func (h *GraphQLHandler) graphQL(c *Context, w http.ResponseWriter, r *http.Request) {
	// Limit bodies to 300KiB.
	r.Body = http.MaxBytesReader(w, r.Body, 300*1024)

	var params struct {
		Query         string                 `json:"query"`
		OperationName string                 `json:"operationName"`
		Variables     map[string]interface{} `json:"variables"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		c.logger.WithError(err).Error("Unable to decode graphql query")
		return
	}

	if !h.config.IsConfiguredForDevelopmentAndTesting() {
		if params.OperationName == "" {
			c.logger.Warn("Invalid blank operation name")
			return
		}
	}

	// dataloaders
	favoritesLoader := dataloader.NewBatchedLoader(graphQLFavoritesLoader[bool], dataloader.WithBatchCapacity[favoriteInfo, bool](loaderBatchCapacity))
	playbooksLoader := dataloader.NewBatchedLoader(graphQLPlaybooksLoader[*app.Playbook], dataloader.WithBatchCapacity[playbookInfo, *app.Playbook](loaderBatchCapacity))

	graphQLContext := &GraphQLContext{
		r:                  r,
		playbookService:    h.playbookService,
		playbookRunService: h.playbookRunService,
		categoryService:    h.categoryService,
		api:                h.api,
		logger:             c.logger,
		config:             h.config,
		permissions:        h.permissions,
		playbookStore:      h.playbookStore,
		licenceChecker:     h.licenceChecker,
		favoritesLoader:    favoritesLoader,
		playbooksLoader:    playbooksLoader,
	}

	// Populate the context with required info.
	reqCtx := r.Context()
	reqCtx = context.WithValue(reqCtx, ctxKey{}, graphQLContext)

	response := h.schema.Exec(reqCtx,
		params.Query,
		params.OperationName,
		params.Variables,
	)
	r.Header.Set("X-GQL-Operation", params.OperationName)

	for _, err := range response.Errors {
		errLogger := c.logger.WithError(err).WithField("operation", params.OperationName)

		if errors.Is(err, app.ErrNoPermissions) {
			errLogger.Warn("Warning executing request")
		} else if err.Rule == "FieldsOnCorrectType" {
			errLogger.Warn("Query for non existent field")
		} else {
			errLogger.Error("Error executing request")
		}
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.logger.WithError(err).Warn("Error while writing response")
	}
}

func getContext(ctx context.Context) (*GraphQLContext, error) {
	c, ok := ctx.Value(ctxKey{}).(*GraphQLContext)
	if !ok {
		return nil, errors.New("custom context not found in context")
	}

	return c, nil
}

// GraphiqlPage is the html base code for the graphiQL query runner
//
//go:embed graphqli.html
var GraphiqlPage []byte

func graphiQL(c *Context, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	_, _ = w.Write(GraphiqlPage)
}
