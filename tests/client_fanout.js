var firebase = require('firebase');
var asyncq = require('async-q');
var _ = require('lodash');

const MAX_MESSAGE_SEND = 20;

let messageRefs = [];
let isListening = false;


module.exports = (users) => {
    const t0 = _.now();
    return asyncq.series([
        () => listenOnMessages(users),
        () => clientFanOut(users, MAX_MESSAGE_SEND),
        removeListener
    ]).then(r => {
        now = _.now();
        console.log(JSON.stringify(r, null, 2))
        return {
            test: 'client_fanout',
            started: t0,
            done: now,
            elapsed: now - t0
        }
    });
}

let fanoutStats = {
    started: null,
    messages: {}
};

const listenOnMessages = (users) => {
    const t0 = _.now();
    return asyncq.each(users, (user, index, arr) => {
        return new Promise((resolve, reject) => {
            const uRef = firebase.database().ref(`/messages/${user.id}`);
            messageRefs.push(uRef);
            uRef.orderByChild('sent_at')
                .limitToLast(1)
                .on('child_added', snapshot => {
                    if (isListening) {
                        const message_id = snapshot.val().id;
                        const sent_at = fanoutStats.messages[`${message_id}`].sent_at
                        const delivered_at = _.now();
                        fanoutStats.messages[`${message_id}`].users[`${user.id}`] = {
                            delivery_elapsed: delivered_at - sent_at,
                            delivered_at: delivered_at
                        };
                        // console.log(`user ${user.id} recieved ${message_id} at ${_.now()}`);
                    }
                    resolve()
                });
        });
    }).then((r) => {
        isListening = true;
        now = _.now();
        return {
            type: 'listen',
            elapsed: now - t0
        }
    })
}

const removeListener = (users) => {
    return new Promise((resolve, reject) => {
        messageRefs.forEach((ref) => {
            ref.off();
        });
        resolve({ type: 'remove_listeners' });
    })
}


const clientFanOut = (users, count = 1) => {
    fanoutStats.started = _.now();
    return asyncq.times(count, () => {
        const message_id = firebase.database().ref().child(`/messages/${users[0].id}/`).push().key;
        fanoutStats.messages[`${message_id}`] = { users: {} };
        const sentAt = new Date().getTime();
        let message = {
            id: message_id,
            text: `Hello from ${users[0].id} at ${sentAt}`,
            sent_by: users[0].id,
            sent_at: sentAt,
            group_id: 'group_01'
        };
        let updates = {};
        const start_loop_users = _.now();
        users.forEach(u => {
            updates[`/messages/${u.id}/${message_id}`] = message;
        });
        const end_loop_users = _.now();
        fanoutStats.messages[`${message_id}`].loop_users_start = start_loop_users;
        fanoutStats.messages[`${message_id}`].loop_users_end = end_loop_users;
        fanoutStats.messages[`${message_id}`].loop_users_elapsed = end_loop_users - start_loop_users;
        updates[`/pn_worker/${message_id}`] = message;
        const stats_sent_at = _.now();
        // console.log(`sending message ${message_id} at ${stats_sent_at}`)
        fanoutStats.messages[`${message_id}`].sent_at = stats_sent_at;
        return firebase.database().ref().update(updates).then(() => {
            const delivered = _.now();
            fanoutStats.messages[`${message_id}`].all_delivered = delivered;
            fanoutStats.messages[`${message_id}`].all_delivered_elapsed = delivered - stats_sent_at;
            // console.log(`message ${message_id} delivered at ${delivered}\n`);
        });
    }).then((r) => {
        return {
            type: 'fanout',
            total_elapsed: _.now() - fanoutStats.started,
            total_users: MAX_MESSAGE_SEND,
            internal_stats: fanoutStats // TODO: process internal_stats to output max, min, median times
        }
    })
}
