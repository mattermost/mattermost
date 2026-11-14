// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type Page} from "@playwright/test";
import {type Logger} from "@mattermost/loadtest-browser-lib";

type ExtraArgs = {
  scrollDistance?: number;
};

export async function openAndScrollRuns(
  page: Page,
  log: Logger,
  {scrollDistance = 500}: ExtraArgs,
): Promise<void> {
  log.info("run--openAndScrollRuns");

  try {
    // # Click on view all runs left sidebar button
    const viewAllRunsLHSButton = page.getByTestId("playbookRunsLHSButton");
    await viewAllRunsLHSButton.click();

    // # Wait for search input to be visible in the all runs page
    const searchInput = page.getByPlaceholder("Search");
    await searchInput.waitFor({state: "visible"});

    // # Scroll gradually until reaching the bottom
    const scrollContainer = page.locator("#playbooks-backstageRoot");
    let hasReachedBottom = false;
    while (!hasReachedBottom) {
      hasReachedBottom = await scrollContainer.evaluate((el, distance) => {
        el.scrollBy(0, distance);
        // Check if we've reached the bottom (with small buffer for rounding)
        return el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
      }, scrollDistance);
      await page.waitForTimeout(300);
    }

    log.info("pass--openAndScrollRuns");
  } catch (error) {
    throw {error, testId: "openAndScrollRuns"};
  }
}
