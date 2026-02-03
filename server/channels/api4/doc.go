// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/*
Package api4 implements the HTTP REST API layer for Mattermost server.

This package provides the primary interface between client applications
(web, mobile, desktop) and the Mattermost server backend. It exposes
HTTP endpoints that follow REST conventions for managing users, teams,
channels, posts, and other Mattermost resources.

# Architecture

The API is structured around resource-based endpoints under the /api/v4/ path.
Each endpoint is handled by specific handler functions that provide different
levels of authentication and authorization:

  - APIHandler: Public endpoints requiring no authentication
  - APISessionRequired: Endpoints requiring authenticated user sessions
  - APISessionRequiredTrustRequester: Authenticated endpoints for trusted requests
  - CloudAPIKeyRequired: Cloud installation webhook endpoints
  - RemoteClusterTokenRequired: Remote cluster communication endpoints
  - APILocal: Local mode access via UNIX socket

# Key Responsibilities

  - Input validation: Validate request parameters and body content
  - Permission checks: Verify user has required permissions for the operation
  - HTTP handling: Parse requests, format responses, set appropriate status codes
  - Error formatting: Convert app layer errors to appropriate HTTP responses
  - Audit logging: Log security-relevant operations

# Error Handling

The API uses consistent error responses with appropriate HTTP status codes.
All handlers use the Context object for standardized error reporting and
audit logging. Errors are returned in a structured JSON format with
error codes, messages, and additional context when available.

# Security

Security is implemented through multiple layers:

  - Authentication via sessions, tokens, or API keys
  - Role-based access control and permission checking
  - CSRF protection through request validation
  - Rate limiting to prevent abuse
  - Multi-factor authentication support
  - Secure session management

The api4 package serves as the HTTP interface layer in Mattermost's
layered architecture, providing a stable, versioned API for client
applications while maintaining clear separation from business logic
and data persistence concerns.
*/
package api4
