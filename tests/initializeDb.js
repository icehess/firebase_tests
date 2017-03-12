var firebase = require('firebase');
var _ = require('lodash');

module.exports = (users) => {
    console.log('[initializeDb] initializing database...');
    const t0 = _.now();
    return firebase.database().ref(`/users/${users[users.length - 1].id}/groups`).once('value').then(usersGroups => {
        return firebase.database().ref(`/users/${users[users.length - 1].id}/groups`).once('value').then(groups => {
            if (usersGroups.val() === null || groups.val() === null) {
                const createdAt = new Date().getTime();
                const group_id = 'group_01'
                let groupInfo = {
                    id: group_id,
                    name: 'Group 1',
                    members: {},
                    group_id: group_id,
                    created: createdAt,
                    created_by: 'user_01',
                };
                let updates = {};
                users.forEach(u => {
                    groupInfo.members[u.id] = { user_id: u.id, added_by: 'user_01', created: createdAt };
                    updates[`/users/${u.id}/groups/${group_id}`] = { group_id: group_id, last_visit: createdAt };
                });
                updates[`/groups/${group_id}`] = groupInfo;
                return firebase.database().ref().update(updates).then(() => {
                    console.log('[initializeDb] database initialized succesfully!\n');
                });
            } else {
                console.log('[initializeDb] database is initialized before!\n');
                Promise.resolve();
            }
        }).then(() => {
            const now = _.now();
            return {
                test: 'init_db',
                started: t0,
                done: now,
                elapsed: now - t0
            }
        })
    });
}
