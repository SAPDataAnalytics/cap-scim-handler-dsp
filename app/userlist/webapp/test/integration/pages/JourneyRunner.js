sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"userlist/test/integration/pages/UsersList",
	"userlist/test/integration/pages/UsersObjectPage"
], function (JourneyRunner, UsersList, UsersObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('userlist') + '/test/flpSandbox.html#userlist-tile',
        pages: {
			onTheUsersList: UsersList,
			onTheUsersObjectPage: UsersObjectPage
        },
        async: true
    });

    return runner;
});

