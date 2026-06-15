// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
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
	graphql_errors "github.com/graph-gophers/graphql-go/errors"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

// graphQLErrorable is an interface for errors that should be returned to the GraphQL client with their actual message.
type graphQLErrorable interface {
	error
	IsGraphQLErrorable() bool
}

// graphQLError wraps an error and marks it as safe to return to GraphQL clients.
type graphQLError struct {
	err error
}

func (e *graphQLError) Error() string {
	return e.err.Error()
}

func (e *graphQLError) IsGraphQLErrorable() bool {
	return true
}

func (e *graphQLError) Unwrap() error {
	return e.err
}

// newGraphQLError wraps an error to make it returnable to GraphQL clients.
func newGraphQLError(err error) error {
	return &graphQLError{err: err}
}

// isGraphQLErrorable checks if an error or any error in its chain implements GraphQLErrorable.
func isGraphQLErrorable(err error) bool {
	var graphqlErr graphQLErrorable
	return errors.As(err, &graphqlErr) && graphqlErr.IsGraphQLErrorable()
}

type GraphQLHandler struct {
	*ErrorHandler
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
	categoryService    app.CategoryService
	propertyService    app.PropertyService
	pluginAPI          *pluginapi.Client
	config             config.Service
	permissions        *app.PermissionsService
	playbookStore      app.PlaybookStore
	runStore           app.PlaybookRunStore
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
	propertyService app.PropertyService,
	api *pluginapi.Client,
	configService config.Service,
	permissions *app.PermissionsService,
	playbookStore app.PlaybookStore,
	runStore app.PlaybookRunStore,
	licenceChecker app.LicenseChecker,
) *GraphQLHandler {
	handler := &GraphQLHandler{
		ErrorHandler:       &ErrorHandler{},
		playbookService:    playbookService,
		playbookRunService: playbookRunService,
		categoryService:    categoryService,
		propertyService:    propertyService,
		pluginAPI:          api,
		config:             configService,
		permissions:        permissions,
		playbookStore:      playbookStore,
		runStore:           runStore,
		licenceChecker:     licenceChecker,
	}

	opts := []graphql.SchemaOpt{
		graphql.UseFieldResolvers(),
		graphql.MaxParallelism(5),
	}

	if !configService.IsConfiguredForDevelopmentAndTesting() {
		opts = append(opts,
			graphql.MaxDepth(8),
			graphql.RestrictIntrospection(func(context.Context) bool { return false }),
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
	r                    *http.Request
	playbookService      app.PlaybookService
	playbookRunService   app.PlaybookRunService
	playbookStore        app.PlaybookStore
	runStore             app.PlaybookRunStore
	categoryService      app.CategoryService
	propertyService      app.PropertyService
	pluginAPI            *pluginapi.Client
	logger               logrus.FieldLogger
	config               config.Service
	permissions          *app.PermissionsService
	licenceChecker       app.LicenseChecker
	favoritesLoader      *dataloader.Loader[favoriteInfo, bool]
	playbooksLoader      *dataloader.Loader[playbookInfo, *app.Playbook]
	statusPostsLoader    *dataloader.Loader[string, []app.StatusPost]
	timelineEventsLoader *dataloader.Loader[string, []app.TimelineEvent]
	runMetricsLoader     *dataloader.Loader[string, []app.RunMetricData]
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
	statusPostsLoader := dataloader.NewBatchedLoader(graphQLStatusPostsLoader[[]app.StatusPost], dataloader.WithBatchCapacity[string, []app.StatusPost](loaderBatchCapacity))
	timelineEventsLoader := dataloader.NewBatchedLoader(graphQLTimelineEventsLoader[[]app.TimelineEvent], dataloader.WithBatchCapacity[string, []app.TimelineEvent](loaderBatchCapacity))
	runMetricsLoader := dataloader.NewBatchedLoader(graphQLRunMetricsLoader[[]app.RunMetricData], dataloader.WithBatchCapacity[string, []app.RunMetricData](loaderBatchCapacity))

	graphQLContext := &GraphQLContext{
		r:                    r,
		playbookService:      h.playbookService,
		playbookRunService:   h.playbookRunService,
		categoryService:      h.categoryService,
		propertyService:      h.propertyService,
		pluginAPI:            h.pluginAPI,
		logger:               c.logger,
		config:               h.config,
		permissions:          h.permissions,
		playbookStore:        h.playbookStore,
		runStore:             h.runStore,
		licenceChecker:       h.licenceChecker,
		favoritesLoader:      favoritesLoader,
		playbooksLoader:      playbooksLoader,
		statusPostsLoader:    statusPostsLoader,
		timelineEventsLoader: timelineEventsLoader,
		runMetricsLoader:     runMetricsLoader,
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

	if len(response.Errors) > 0 {
		for i, err := range response.Errors {
			errLogger := c.logger.WithError(err).WithField("operation", params.OperationName)

			if errors.Is(err, app.ErrNoPermissions) {
				errLogger.Warn("Warning executing request")
			} else if err.Rule == "FieldsOnCorrectType" {
				errLogger.Warn("Query for non existent field")
			} else {
				errLogger.Error("Error executing request")
			}

			if i == 9 {
				errLogger.Warnf("Too many errors, not logging %d more", len(response.Errors)-10)
				break
			}
		}

		// Check if the underlying error (Err field) is graphQLErrorable, not the QueryError wrapper
		var isErrorable bool
		if response.Errors[0].Err != nil {
			isErrorable = isGraphQLErrorable(response.Errors[0].Err)
		} else {
			isErrorable = isGraphQLErrorable(response.Errors[0])
		}

		if !isErrorable {
			response.Errors[0].Message = "Error while executing your request"
		}
		response.Errors[0].Locations = []graphql_errors.Location{{Line: 0, Column: 0}}
		// remove all other errors
		response.Errors = response.Errors[:1]
		if err := json.NewEncoder(w).Encode(response); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			c.logger.WithError(err).Warn("Error while writing error response")
		}
		return
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
