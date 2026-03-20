// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserInstance, Logger} from "@mattermost/loadtest-browser-lib";
import {
  performLogin,
  handleLandingPage,
  performTeamSelection,
} from "@mattermost/loadtest-browser-lib";

import {createNewPlaybook} from "./create_new_playbook.js";
import {runPlaybook} from "./run_playbook.js";
import {openAndScrollRuns} from "./open_and_scroll_runs.js";
import {openAndScrollPlaybooks} from "./open_and_scroll_playbooks.js";

export async function createAndRunPlaybookScenario(
  {page, userId, password}: BrowserInstance,
  serverURL: string,
  log: Logger,
  runInLoop = true,
) {
  if (!page) {
    throw new Error("Page is not initialized");
  }

  // # Go to all playbooks page
  await page.goto(`${serverURL}/playbooks/playbooks`);

  // # If on landing page, click the "View in Browser" button
  await handleLandingPage(page, log);

  // # Login with received credentials
  await performLogin(page, log, {userId, password});

  // # Select the first team if team selection is required
  await performTeamSelection(page, log, {teamName: ""});

  do {
    // # Create a new playbook
    await createNewPlaybook(page, log);

    // # Run the newly created playbook
    await runPlaybook(page, log);

    // # Open and scroll through the runs
    await openAndScrollRuns(page, log, {scrollDistance: 500});

    // # Open and scroll through the playbooks
    await openAndScrollPlaybooks(page, log, {scrollDistance: 300});
  } while (runInLoop);
}
