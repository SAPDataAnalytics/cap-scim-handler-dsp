namespace dsp.scim;

entity Users {
    key id          : UUID;
        email       : String;
        firstName   : String;
        lastName    : String;
        displayName : String;
        userName    : String;
}

entity Roles {
    key roleValue   : String;
        roleDisplay : String;
}

entity UserRoles {
    key userId      : UUID;
    key roleValue   : String;
}

entity AuthObjectRoles {
    key authObjectId : UUID;
    key roleValue    : String;
}