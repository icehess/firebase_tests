var firebase = require('firebase');
var asyncq = require('async-q');
var _ = require('lodash');

const MAX_MESSAGE_SEND = 1;

let messageRefs = [];
let isListening = false;

let message_status = {
    type: 'message_status',
    started: null,
    messages: {}
};

module.exports = (users) => {
    const t0 = _.now();
    console.log(`[fanout] sending ${MAX_MESSAGE_SEND} messages to ${users.length} users`);
    return asyncq.series([
        () => listenOnMessages(users),
        () => clientFanOut(users, MAX_MESSAGE_SEND),
        removeListener
    ]).then(r => {
        now = _.now();
        return {
            test: 'client_fanout',
            started: t0,
            done: now,
            elapsed: now - t0 - 4000 - 5000,
            internal_results: Object.assign({}, { testsStats: r }, { message_status: message_status })
        }
    });
}

const listenOnMessages = (users) => {
    const t0 = _.now();
    console.log('[fanout] listening for messages');
    users.forEach(user => {
        const uRef = firebase.database().ref(`/messages/${user.id}`);
        messageRefs.push(uRef);
        uRef.orderByChild('sent_at')
            .limitToLast(1)
            .on('child_added', snapshot => {
                listenerCallback(user, snapshot)
            });
    });
    const now = _.now();
    return new Promise((resolve) => {
        console.log('[fanout] waiting 4s for Firebase to fire the events for the first time...');
        setTimeout(() => {
            isListening = true;
            resolve({
                type: 'listen',
                elapsed: now - t0
            })
        }, 4000);
    })
}

const listenerCallback = (user, snapshot) => {
    if (isListening) {
        const message_id = snapshot.val().id;
        // console.log(`[fanout] user ${user.id} recieved ${message_id} at ${_.now()}`);
        if (message_status.messages[`${message_id}`]) {
            // only process the message that this worker was sent
            const sent_at = message_status.messages[`${message_id}`].sent_at
            const delivered_at = _.now();
            message_status.messages[`${message_id}`].users[`${user.id}`] = {
                delivery_elapsed: delivered_at - sent_at,
                delivered_at: delivered_at
            };
        }
    }
}

const removeListener = () => {
    return new Promise((resolve) => {
        console.log('waiting 5s for recieving messages....');
        setTimeout(() => {
            console.log('[fanout] remove listeners from messages');
            messageRefs.forEach((ref) => {
                ref.off();
            });
            console.log('[fanout] finished remove listeners');
            resolve({
                type: 'remove_listeners'
            });
        }, 5000);
    });
}


const clientFanOut = (users, count = 1) => {
    message_status.started = _.now();
    console.log('[fanout] sending messages');
    return asyncq.times(count, () => {
        doSendMessage(users);
    }).then((r) => {
        return {
            type: 'fanout',
            total_elapsed: _.now() - message_status.started,
            total_users: MAX_MESSAGE_SEND,
            sent_msg_ids: r,
        }
    })
}

const doSendMessage = (users) => {
    const message_id = firebase.database().ref().child(`/messages/${users[0].id}/`).push().key;
    message_status.messages[`${message_id}`] = { users: {} };
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
    message_status.messages[`${message_id}`].loop_users_start = start_loop_users;
    message_status.messages[`${message_id}`].loop_users_end = end_loop_users;
    message_status.messages[`${message_id}`].loop_users_elapsed = end_loop_users - start_loop_users;
    updates[`/pn_worker/${message_id}`] = message;
    const stats_sent_at = _.now();
    // console.log(`[fanout] sending message ${message_id} at ${stats_sent_at}`)
    message_status.messages[`${message_id}`].sent_at = stats_sent_at;
    return firebase.database().ref().update(updates).then(() => {
        const delivered = _.now();
        message_status.messages[`${message_id}`].sent_done = delivered;
        message_status.messages[`${message_id}`].sent_done_elapsed = delivered - stats_sent_at;
        // console.log(`[fanout] message ${message_id} delivered at ${delivered}\n`);
        return message_id;
    });
}
