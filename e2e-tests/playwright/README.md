## Local development

#### 1. Start local server in a separate terminal.

```
# Typically run the local server with:
cd server && make run

# Or build and distribute webapp including channels and playbooks
# so that their product URLs do not rely on Webpack dev server.
# Especially important when running tests inside the Playwright's docker container.
cd webapp && make dist
cd server && make run-server
```

#### 2. Install dependencies and run the test.

```
# Install npm packages
npm i

# Install browser binaries as prompted if Playwright is just installed or updated
# See https://playwright.dev/docs/browsers
npx playwright install

# Run a specific test of all projects -- Chrome, Firefox, iPhone and iPad.
# See https://playwright.dev/docs/test-cli.
npm run test -- login

# Run a specific test of a project
npm run test -- login --project=chrome

# Or run all tests
npm run test
```

#### 3. Inspect test results at `/results/output` folder when something fails unexpectedly.

## Updating screenshots is done strictly via Playwright's docker container for consistency

#### 1. Run docker container using latest focal version

Change to the `e2e-tests/playwright` directory, then run the docker container. (See https://playwright.dev/docs/docker for reference.)

```
docker run -it --rm -v "$(pwd):/mattermost/" --ipc=host mcr.microsoft.com/playwright:v1.51.1-noble /bin/bash
```

#### 2. Inside the docker container

```
export PW_BASE_URL=http://host.docker.internal:8065
export PW_HEADLESS=true
cd mattermost/e2e-tests/playwright

# Install npm packages. Use "npm ci" to match the automated environment
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

# Run specific test. See https://playwright.dev/docs/test-cli.
npm run test -- login --project=chrome

# Or run all tests
npm run test

# Run visual tests
npm run test -- visual

# Update snapshots of visual tests
npm run test -- visual --update-snapshots
```

## Page/Component Object Model

See https://playwright.dev/docs/test-pom.

Page and component abstractions are in shared library located at `./lib/src/ui`. They should be established before writing a spec file so that any future changes in the DOM structure will be made in one place only. No static UI text or fixed locator should be written in the spec file.
