using dsp.scim as db from '../db/schema';

service DSPUsers @(
    path    : '/data',
    requires: 'authenticated-user'
) {
    entity Users     as projection on db.Users;
    entity Roles     as projection on db.Roles;
    entity UserRoles as projection on db.UserRoles;

    @readonly
    entity UsersVH {
        key id          : UUID;
            email       : String;
            firstName   : String;
            lastName    : String;
            displayName : String;
            userName    : String;
    }

    @readonly
    entity RolesVH {
        key roleValue   : String;
            roleDisplay : String;
            userCount   : Integer;
    }

    @readonly
    entity UserRolesVH {
        key userId      : UUID;
        key roleValue   : String;
            userName    : String;
            displayName : String;
            email       : String;
            roleDisplay : String;
    }

    // Action that writes UsersVH -> Users
    action SyncUsersVHToUsers() returns Integer;
    action SyncRolesFromSCIM() returns Integer;
    action SyncUserRolesFromSCIM() returns Integer;

    @odata.draft.enabled
    entity AuthObjectRoles as projection on db.AuthObjectRoles;
}
