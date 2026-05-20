// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/*
Package store provides the data persistence layer for Mattermost channels.

The store package implements a layered architecture that abstracts database operations
and provides a clean interface for data access. It follows the repository pattern with advanced features
like caching, search indexing, retry logic, and metrics collection.

# Architecture Overview

The store package uses a multi-layered architecture where each layer adds specific
functionality:

	Application Layer (app/)
	        ↓
	Store Interface (store.Store)
	        ↓
	    Timer Layer (metrics/timing)
	        ↓
	    Retry Layer (deadlock/error handling)
	        ↓
	  Local Cache Layer (in-memory caching)
	        ↓
	   Search Layer (search indexing)
	        ↓
	    SQL Store (database operations)

Each layer wraps the layer below it, following the decorator pattern to add
cross-cutting concerns without modifying the core business logic.

# Store Interface

The main Store interface provides access to all domain-specific stores:

	type Store interface {
		Team() TeamStore
		Channel() ChannelStore
		Post() PostStore
		User() UserStore
		// ... and many more
	}

Each domain store interface defines operations for a specific entity type,
following CRUD patterns and domain-specific operations.

# Key Components

## SQL Store (sqlstore/)
The foundation layer that handles direct database operations:
- Connection management with master/replica support
- Query building using Squirrel
- Transaction handling
- Database migration support
- Schema management

## Local Cache Layer (localcachelayer/)
Provides in-memory caching for frequently accessed data:
- LRU cache implementation
- Cache invalidation strategies
- Cluster-aware cache invalidation
- Configurable cache sizes and TTLs
- Metrics collection for hit/miss ratios

## Search Layer (searchlayer/)
Integrates with search engines for full-text search:
- Elasticsearch integration
- Bleve search engine support
- Automatic indexing of content
- Search result ranking and filtering

## Retry Layer (retrylayer/)
Handles transient failures and database deadlocks:
- Automatic retry logic for database deadlocks
- Configurable retry policies
- Dead letter queue handling

## Timer Layer (timerlayer/)
Provides performance monitoring and metrics:
- Method execution timing
- Database query performance metrics
- Integration with Prometheus metrics
- Performance bottleneck identification

## Store Test Framework (storetest/)
Comprehensive testing infrastructure:
- Mock implementations for all store interfaces
- Test data factories and builders
- Database setup and teardown utilities
- Integration test helpers

## Cache Operations

The cache layer is transparent to callers but provides significant performance
benefits for read-heavy operations:

	// This call may be served from cache
	user, err := store.User().Get(ctx, userID)

	// Cache is automatically invalidated on updates
	updatedUser, err := store.User().Update(ctx, user, allowRoleUpdate)

## Error Handling

The store package defines custom error types for common scenarios:

	// Check for specific error types
	if err != nil {
		var notFoundErr *store.ErrNotFound
		if errors.As(err, &notFoundErr) {
			// Handle not found case
		}

		var conflictErr *store.ErrConflict
		if errors.As(err, &conflictErr) {
			// Handle conflict case
		}
	}

# Migration and Schema

The store package includes a robust migration system:
- Version-controlled schema migrations
- Automatic migration execution
- Rollback support
- Schema validation

For detailed information about specific store implementations, see the
documentation in the respective subdirectories (sqlstore/, localcachelayer/, etc.).
*/
package store
