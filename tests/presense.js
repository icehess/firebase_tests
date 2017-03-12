var firebase = require('firebase');
var asyncq = require('async-q');
var _ = require('lodash');

let isOn = false;

module.exports = (users) => {
    const t0 = _.now();
    console.log('[presence] testing presence');
    return asyncq.each(users, (user, index, arr) => {
        return asyncq.series([
            () => amOnline(user),
            () => listenOnUserGroups(user),
        ]).then(r => {
            // maybe instrument each item
        });
    }).then(r => {
        now = _.now();
        console.log('[presence] done')
        return {
            test: 'presense',
            started: t0,
            done: now,
            elapsed: now - t0
        }
    });
}

const amOnline = (user) => {
    // console.log('[presence] amOnline');
    const amOnlineRef = firebase.database().ref('.info/connected');
    const presenceRef = firebase.database().ref('presence/' + user.id);
    return amOnlineRef.once('value').then((snapshot) => {
        if (snapshot.val()) {
            // console.log('user ', user.id, 'is now online');
            presenceRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
            isOn = true;
            presenceRef.set(true);
        } else {
            // if (isOn) console.log('user ', user.id, ' disconnected');
        }
    })

}

const listenOnUserGroups = (user) => {
    // console.log('[presence] listenOnUserGroups');
    const presenceRef = firebase.database().ref('presence/' + user.id);
    return firebase.database().ref(`/users/${user.id}/groups`)
        .once('child_added')
        .then(group => {
            return firebase.database().ref(`/groups/${group.key}`)
                .once('value')
                .then(snapshot2 => {
                    // console.log(`read user ${user.id} groups`);
                })
        });
}
