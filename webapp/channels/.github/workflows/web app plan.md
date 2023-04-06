## Web App CI currently

Web App CI (channels-ci.yml):
```
    check-lint \
    check-i18n  >-- tests
    check-type /

    build

    run-performance-benchmarks # currently commented out
```

Results in the following checks:
- Web App CI/check-lint
- Web App CI/check-i18n
- Web App CI/check-type
- Web App CI/tests
- Web App CI/build

## Goals

1. Only run tests for code that has changed
2. Limit the number of jobs for each package
3. Roughly reflect web app package structure

## Methods

- Have a separate workflows for Channels, Boards, Playbooks
    - Use `paths` so that they run if there are changes in:
        - Their own files
        - In the platform packages
        - In mattermost-redux (for Playbooks)
        - TODO: Ma=ke sure this works with our required checks
- Combine check-lint, check-type, tests, and build
    - We should ensure that check-lint, check-type, and tests always all run even if the others fail
        - This could probably be done with a `steps[*].continue-on-error: true` for each of those steps and them a followup step which fails the whole job based on its outcome
        - Alternatively, we might be able to do something fancy with a strategy matrix with test-ci, check-lint and setting `strategy.matrix.fail-fast: false`
    - TODO: do we even need build still?
- Move check-i18n step into either its own web-specific workflow or a shared one with the server
    - If web-specific, use `paths` so that it only runs if web app files or i18n files change
    - TODO: Talk to Zubair about this
- There could probably be a shared workflow and then we define project-specific workflows that call that one for each project

## End result

Files:
- webapp-boards.yml
- webapp-channels.yml
- webapp-playbooks.yml
- webapp-shared.yml
- webapp-i18n.yml

The following checks:
- Web App CI/Channels
- Web App CI/Playbooks
- Web App CI/Boards
- Web App CI/I18n

## Tickets

1. Write up this proposal slightly nicer
2. Create a separate i18n pipeline (assign to Zubair?)
3. Create a Channels-specific pipeline
4. Refactor the Channels-specific one into a shareable one and use that for Playbooks and Boards
