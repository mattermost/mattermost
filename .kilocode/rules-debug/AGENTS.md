# AGENTS.md - Debug Mode

This file provides debugging-specific guidance for agents working in Debug mode in this repository.

## Server (Go) Debugging

### Debug Server with Delve
```bash
cd server/
make debug-server           # Interactive debugging
make debug-server-headless  # Headless for IDE integration (listens on :2345)
```

### Gotestsum Debugging
When tests fail with gotestsum, get more output:
```bash
cd server/
./bin/gotestsum -- -v -run TestFunctionName ./path/to/package
```

### Server Log Output
- Server logs to stdout by default
- Log level controlled by `MM_LOGSETTINGS_CONSOLELEVEL` env var
- Check `LogSettings` in config for file logging options

### Common Gotchas
- **Docker must be running** before starting server or tests
- Tests need `MM_SERVER_PATH` set when running outside Makefile
- Mock files are generated - don't edit `*_mocks.go` files directly
- Database state: `make nuke` resets everything (including docker volumes)

## Webapp (React) Debugging

### Browser DevTools
- React DevTools extension useful for component inspection
- Redux DevTools extension configured for state debugging

### Webpack Dev Server
```bash
cd webapp/
npm run dev-server  # Includes source maps and HMR
```

### Jest Debugging
```bash
cd webapp/channels/
npm run test:debug  # Verbose output with open handles detection
npm test -- --detectOpenHandles  # For async issues
```

### Console Logs
- Check browser console for frontend errors
- Check terminal running webpack for build errors
- Server API errors appear in server logs

## E2E Test Debugging

### Cypress
```bash
cd e2e-tests/cypress/
npm run cypress:open  # Interactive mode for debugging
```

### Playwright
```bash
cd e2e-tests/playwright/
npx playwright test --debug  # Step-through debugging
npx playwright test --headed  # See browser while running
```

## Docker Services Debugging

### Check Service Status
```bash
cd server/
docker compose ps
docker compose logs <service-name>
```

### Common Issues
- **MySQL/Postgres connection refused**: Ensure `make start-docker` ran first
- **Elasticsearch errors**: Check `ENABLED_DOCKER_SERVICES` includes elasticsearch
- **MinIO file uploads fail**: Verify minio container is running
- **LDAP auth issues**: Check openldap container and data load

## Configuration Debugging

### Environment Override
Create `server/config.override.mk` or `webapp/config.override.mk` for local settings without modifying tracked files.

### Disable Enterprise Features
```bash
export BUILD_ENTERPRISE=false
make run-server
```

### Disable Docker
```bash
export MM_NO_DOCKER=true
make run-server  # Requires manually configured database
```
