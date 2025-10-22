using DSPUsers as service from '../../srv/service';

annotate service.Users with @(
    UI: {
        LineItem: [
            {Value: userName, Label: 'Username'},
            {Value: displayName, Label: 'Display Name'},
            {Value: email, Label: 'Email'},
            {Value: firstName, Label: 'First Name'},
            {Value: lastName, Label: 'Last Name'},
            {
                $Type: 'UI.DataFieldForAction',
                Label: 'Sincronizza utenti',
                Action: 'DSPUsers.SyncUsersVHToUsers',
                InvocationGrouping: 'UI.OperationGroupingType/Isolated'
            }
        ]
    }
);

annotate service.Users with @UI.HeaderInfo : {
  TypeName: 'Utente',
  Title: { Value: userName },
  Description: { Value: displayName }
};

annotate service.Roles with @(
    UI: {
        LineItem: [
            {Value: roleValue, Label: 'Role Value'},
            {Value: roleDisplay, Label: 'Role Display'},
            {Value: userCount, Label: 'User Count'},
            {
                $Type: 'UI.DataFieldForAction',
                Label: 'Sincronizza ruoli',
                Action: 'DSPUsers.SyncRolesFromSCIM',
                InvocationGrouping: 'UI.OperationGroupingType/Isolated'
            }
        ]
    }
);

annotate service.Roles with @UI.HeaderInfo : {
  TypeName: 'Ruolo',
  Title: { Value: roleValue },
  Description: { Value: roleDisplay }
};

annotate service.UserRoles with @(
    UI: {
        LineItem: [
           // {Value: userName, Label: 'User Name'},
            {Value: userId, Label: 'User ID'},
           // {Value: displayName, Label: 'Display Name'},
           // {Value: email, Label: 'Email'},
            {Value: roleValue, Label: 'Role Value'},
           // {Value: roleDisplay, Label: 'Role Display'},
            {
                $Type: 'UI.DataFieldForAction',
                Label: 'Sincronizza associazioni',
                Action: 'DSPUsers.SyncUserRolesFromSCIM',
                InvocationGrouping: 'UI.OperationGroupingType/Isolated'
            }
        ]
    }
);

annotate service.UserRoles with @UI.HeaderInfo : {
  TypeName: 'Associazione',
  Title: { Value: userId },
  Description: { Value: roleValue }
};

