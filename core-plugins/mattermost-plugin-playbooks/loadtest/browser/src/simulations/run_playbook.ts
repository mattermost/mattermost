// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type Page} from "@playwright/test";
import {type Logger} from "@mattermost/loadtest-browser-lib";

export async function runPlaybook(page: Page, log: Logger): Promise<void> {
  log.info("run--runPlaybook");

  try {
    // # Wait for navigation to playbook outline page
    await page.waitForURL((url) =>
      url.pathname.startsWith("/playbooks/playbooks/"),
    );

    // # Click on run playbook button (PrimaryButtonLarger in editor controls)
    const runPlaybookButton = page.getByTestId("run-playbook");
    await runPlaybookButton.click();

    // # Wait for the run playbook modal to be visible
    const runPlaybookModal = page.getByRole("dialog", {
      name: "Run Playbook",
    });
    await runPlaybookModal.waitFor({state: "visible"});

    // # Fill in a run name
    const runNameInput = page.getByTestId("run-name-input");
    await runNameInput.waitFor({state: "visible"});
    await runNameInput.clear();
    await runNameInput.fill(getRandomRunName());

    // # Select "Create a public channel" option
    const createChannelRadio = page.getByTestId("create-public-channel-radio");
    await createChannelRadio.click();

    // # Click on start run button
    const startButton = page.getByTestId("modal-confirm-button");
    await startButton.waitFor({state: "visible"});
    await startButton.click();

    // # Wait for navigation to the run detail page
    await page.waitForURL((url) => url.pathname.startsWith("/playbooks/runs/"));

    log.info("pass--runPlaybook");
  } catch (error) {
    throw {error, testId: "runPlaybook"};
  }
}

function getRandomRunName(): string {
  return `RunPlaybooksBrowserLoadTest-${Math.random().toString(36).substring(2, 15)}`;
}
