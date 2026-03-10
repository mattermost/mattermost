# View User Group Modal

## Application Overview

The View User Group Modal (view_user_group_modal.tsx) is a React modal that displays members of a custom user group. It renders the group @mention name, a member count heading, a search-box (data-testid='searchInput'), and a scrollable list of ViewUserGroupListItem rows. The modal is opened by clicking a group row in the User Groups product-switch dialog. This plan covers the primary interaction: open the modal for a freshly-created custom group and verify the member list and in-modal member search.

## Test Scenarios

### 1. view_user_group_modal

**Seed:** `specs/seed.spec.ts`

#### 1.1. user can view group members and search within the view user group modal @ai-assisted

**File:** `specs/functional/ai-assisted/view_user_group_modal/view_user_group_modal.spec.ts`

**Steps:**

1. Call pw.initSetup() to create an admin client and a regular user


    - expect: adminClient and user are returned without errors

2. Create a second user via adminClient.createUser(await pw.random.user(), '', '')


    - expect: secondUser profile is returned

3. Create a custom group via adminClient.createGroupWithUserIds({name, display_name, allow_reference: true, source: 'custom', user_ids: [user.id, secondUser.id]})


    - expect: group object with .name and .display_name is returned

4. Login the regular user via pw.testBrowser.login(user), go to channelsPage and call toBeVisible()


    - expect: Channels page is fully visible

5. Click channelsPage.globalHeader.productSwitchMenu, then click the 'User Groups' menu item


    - expect: A dialog with role 'dialog' and name 'User Groups' becomes visible

6. Click on the group's display_name text inside the User Groups dialog


    - expect: The .view-user-groups-modal locator becomes visible

7. Assert that viewGroupModal.getByText('@' + group.name) is visible


    - expect: The @mention group name is shown in the modal header area

8. Assert that viewGroupModal.getByText(/2\s\*Members/i) is visible


    - expect: Member count heading shows '2 Members'

9. Assert that viewGroupModal.getByTestId('searchInput') is visible


    - expect: Search input is rendered inside the modal

10. Fill searchInput with secondUser.username


    - expect: The search term is entered in the input

11. Assert that viewGroupModal.getByText(secondUser.username) is visible and viewGroupModal.getByText(user.username) is NOT visible


    - expect: Search filters the list to show only secondUser, excluding the logged-in user
