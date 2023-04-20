export enum PlaybookRole {
    Member = 'playbook_member',
    Admin = 'playbook_admin',
}

export type Permission = RunPermission | PlaybookPermission

export enum RunPermission {
    ManageProperties = 'run_manage_properties',
    ManageMembers = 'run_manage_members',
    View = 'run_view',
}

export enum PlaybookPermissionGeneral {
    Create = 'create',
    ManageProperties = 'manage_properties',
    ManageMembers = 'manage_members',
    ManageRoles = 'manage_roles',
    View = 'view',
    Convert = 'convert',
    RunCreate = 'run_create',
}

export enum PlaybookPermission {
    PublicCreate = 'playbook_public_create',
    PublicManageProperties = 'playbook_public_manage_properties',
    PublicManageMembers = 'playbook_public_manage_members',
    PublicManageRoles = 'playbook_public_manage_roles',
    PublicView = 'playbook_public_view',
    PublicMakePrivate = 'playbook_public_make_private',

    PrivateCreate = 'playbook_private_create',
    PrivateManageProperties = 'playbook_private_manage_properties',
    PrivateManageMembers = 'playbook_private_manage_members',
    PrivateManageRoles = 'playbook_private_manage_roles',
    PrivateView = 'playbook_private_view',
    PrivateMakePublic = 'playbook_private_make_public',

    RunCreate = 'run_create',
}

export function makeGeneralPermissionSpecific(permission: PlaybookPermissionGeneral, isPublic: boolean): PlaybookPermission {
    if (permission === PlaybookPermissionGeneral.RunCreate) {
        return PlaybookPermission.RunCreate;
    }

    if (permission === PlaybookPermissionGeneral.Convert) {
        return isPublic ? PlaybookPermission.PublicMakePrivate : PlaybookPermission.PrivateMakePublic;
    }

    if (isPublic) {
        return 'playbook_public_' + permission as PlaybookPermission;
    }
    return 'playbook_private_' + permission as PlaybookPermission;
}
