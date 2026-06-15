// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type Page} from "@playwright/test";
import {type Logger} from "@mattermost/loadtest-browser-lib";

export async function createNewPlaybook(
  page: Page,
  log: Logger,
): Promise<void> {
  log.info("run--createNewPlaybook");

  try {
    // # Click on "+" dropdown button
    const createPlaybookDropdownToggle = page.getByTestId(
      "create-playbook-dropdown-toggle",
    );
    await createPlaybookDropdownToggle.waitFor({state: "visible"});
    await createPlaybookDropdownToggle.click();

    // # Click on "Create New Playbook" menu item once the dropdown is open
    const menuItemForCreatePlaybook = page.getByTestId("createPlaybook");
    await menuItemForCreatePlaybook.waitFor({state: "visible"});
    await menuItemForCreatePlaybook.click();

    // # Wait for the create playbook modal to be visible
    const createPlaybookModal = page.getByRole("dialog", {
      name: "Create Playbook",
    });
    await createPlaybookModal.waitFor({state: "visible"});

    // # Fill in a playbook name
    const playbookNameInput = page.getByLabel("Playbook name");
    await playbookNameInput.fill(getRandomPlaybookName());

    // # Click on create playbook button
    const createPlaybookButton = page.getByTestId("modal-confirm-button");
    await createPlaybookButton.click();

    log.info("pass--createNewPlaybook");
  } catch (error) {
    throw {error, testId: "createNewPlaybook"};
  }
}

function getRandomPlaybookName(): string {
  return `PlaybooksBrowserLoadTest-${Math.random().toString(36).substring(2, 15)}`;
}
