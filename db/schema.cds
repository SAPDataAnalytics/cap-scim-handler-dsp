namespace dsp.scim;

using {
    cuid,
    managed
} from '@sap/cds/common';

entity Users : cuid, managed {
    familyName  : String(100);
    givenName   : String(100);
    displayName : String(100);
    email       : String(100);
    userName    : String(100);
}

entity Roles : managed {
    key value     : String(200);
        display   : String(150);
        userCount : Integer;
}

entity UserRoles : cuid, managed {
    key user : Association to Users;
    key role : Association to Roles;
}

entity AuthObjectRoles : cuid, managed {
    key authObject : String(200);
    key role       : Association to Roles;
}