/* Migration 000054_create_crt_channelmembership_count.up sets
   ChannelMembers.LastUpdateAt to the results of SELECT ROUND(UNIX_TIMESTAMP(NOW(3))*1000)
   which will be different each time the migration is run. Thus, the column will always be
   different when comparing the server and script migrations. To bypass this, we update all
   rows in ChannelMembers so that they contain the same value for such column. */
UPDATE ChannelMembers SET LastUpdateAt = 1;

/* Migration 000055_create_crt_thread_count_and_unreads.up sets
   ThreadMemberships.LastUpdated to the results of SELECT ROUND(UNIX_TIMESTAMP(NOW(3))*1000)
   which will be different each time the migration is run. Thus, the column will always be
   different when comparing the server and script migrations. To bypass this, we update all
   rows in ThreadMemberships so that they contain the same value for such column. */
UPDATE ThreadMemberships SET LastUpdated = 1;

/* The security update check in the server may update the LastSecurityTime system value. To
   avoid any spurious difference in the migrations, we update it to a fixed value. */
UPDATE Systems SET Value = 1 WHERE Name = 'LastSecurityTime';

/* The server migration may contain a row in the Systems table marking the onboarding as complete.
   There are no migrations related to this, so we can simply drop it here */
DELETE FROM Systems WHERE Name = 'FirstAdminSetupComplete';

/* When migrating through the server, Playbooks adds some new rows to the Roles and Systems tables,
   which are not present in the script migration. We drop such rows here */
DELETE FROM Roles WHERE Name = 'playbook_member';
DELETE FROM Roles WHERE Name = 'playbook_admin';
DELETE FROM Roles WHERE Name = 'run_member';
DELETE FROM Roles WHERE Name = 'run_admin';
DELETE FROM Systems WHERE Name = 'PlaybookRolesCreationMigrationComplete';
DELETE FROM Systems WHERE Name = 'playbooks_manage_roles';
DELETE FROM Systems WHERE Name = 'playbooks_permissions';

/* When migrating through the server, Boards adds a row to the Systems table. We drop it here */
DELETE FROM Systems WHERE Name = 'products_boards';

/* doRemainingSchemaMigrations adds an ID to the TeamInviteId column in the Teams table. Something like:
       Get all affected teams with SELECT * FROM Teams WHERE InviteId = ''
       For each of the previous team, generate a newID and run UPDATE Teams SET InviteId = newID WHERE ...
   At the end of such migration, a new row to the Systems table is added. We drop it here */
DELETE FROM Systems WHERE Name = 'RemainingSchemaMigrations';

/* doCustomGroupAdminRoleCreationMigration adds a new role and mark this migration as complete. The new role is:
       roles[SystemCustomGroupAdminRoleId] = &Role{
           Name:          "system_custom_group_admin",
           DisplayName:   "authentication.roles.system_custom_group_admin.name",
           Description:   "authentication.roles.system_custom_group_admin.description",
           Permissions:   SystemCustomGroupAdminDefaultPermissions,
           SchemeManaged: false,
           BuiltIn:       true,
       }

   The permissions contain:
       SystemCustomGroupAdminDefaultPermissions = []string{
           PermissionCreateCustomGroup.Id,         // create_custom_group
           PermissionEditCustomGroup.Id,           // edit_custom_group
           PermissionDeleteCustomGroup.Id,         // delete_custom_group
           PermissionRestoreCustomGroup.Id,        // restore_custom_group
           PermissionManageCustomGroupMembers.Id,  // manage_custom_group_members
       }
   The ID of the role will change, so we need to standardize it */
DELETE FROM Roles WHERE Name = 'system_custom_group_admin';
DELETE FROM Systems WHERE Name = 'CustomGroupAdminRoleCreationMigrationComplete';


/* doPostPriorityConfigDefaultTrueMigration updates the config, setting ServiceSettings.PostPriority to true,
   and marking this migration as complete in the Systems table. The migration script will not contain this
   migration, so it's safe to clean it up here. */
DELETE FROM Systems WHERE Name = 'PostPriorityConfigDefaultTrueMigrationComplete';

/* getAddCustomUserGroupsPermissions and getAddCustomUserGroupsPermissionRestore adds two rows to the Systems
   table to mark those migrations as complete. The migrations are the following:
       func (a *App) getAddCustomUserGroupsPermissions() (permissionsMap, error) {
           t := []permissionTransformation{}

           customGroupPermissions := []string{
               model.PermissionCreateCustomGroup.Id,
               model.PermissionManageCustomGroupMembers.Id,
               model.PermissionEditCustomGroup.Id,
               model.PermissionDeleteCustomGroup.Id,
           }

           t = append(t, permissionTransformation{
               On:  isExactRole(model.SystemUserRoleId),
               Add: customGroupPermissions,
           })

           t = append(t, permissionTransformation{
               On:  isExactRole(model.SystemAdminRoleId),
               Add: customGroupPermissions,
           })

           return t, nil
       }


       func (a *App) getAddCustomUserGroupsPermissionRestore() (permissionsMap, error) {
           t := []permissionTransformation{}

           customGroupPermissions := []string{
               model.PermissionRestoreCustomGroup.Id,
           }

           t = append(t, permissionTransformation{
               On:  isExactRole(model.SystemUserRoleId),
               Add: customGroupPermissions,
           })

           t = append(t, permissionTransformation{
               On:  isExactRole(model.SystemAdminRoleId),
               Add: customGroupPermissions,
           })

           t = append(t, permissionTransformation{
               On:  isExactRole(model.SystemCustomGroupAdminRoleId),
               Add: customGroupPermissions,
           })
           return t, nil
   It's safe to let these migrations run only in the server, so we can remove the Systems rows for diff. */
DELETE FROM Systems WHERE Name = 'custom_groups_permissions';
DELETE FROM Systems WHERE Name = 'custom_groups_permission_restore';
