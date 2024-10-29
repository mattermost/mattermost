import { test, expect } from '@playwright/test';

const pluginPage = 'http://localhost:8065/admin_console/plugins/plugin_com.mattermost.plugin-legal-hold'


test('create a legal hold successfully' , async ({ page }) => {

  await page.goto(pluginPage);
  await expect (page.getByText('/Legal Hold Plugin/')).toBeVisible

  //click the create new button
  await page.getByText('create new').first().click();
  await expect (page.getByText ('Create a new legal hold')).toBeVisible
  
  //enter legal hold name
  await page.getByPlaceholder('Name').click();
  await page.getByPlaceholder('New Legal Hold...').fill('Sample Legal Hold');

   // select user
  await page.locator('.css-19bb58m').click();
  await page.locator('#react-select-2-input').fill('s');
  await page.getByRole('option', { name: '@sheila' }).click();
  
  //enter start date
  await page.getByPlaceholder('Starting from').fill('2024-10-28');

  //click the create legal hold button
  await page.getByRole('button', { name: 'Create legal hold' }).click();

  //verify that the create legal hold modal is no longer visible
  await expect (page.getByText ('Create a new legal hold')).toBeDisabled

});

test ('Check newly created plugin', async ({page}) =>{
  await page.goto(pluginPage);

  expect (page.getByText('Sample Legal Hold')).toBeVisible;
  expect (page.getByText('Release')).toBeVisible;

})