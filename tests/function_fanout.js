var firebase = require('firebase');
var asyncq = require('async-q');
var _ = require('lodash');

const MAX_MESSAGE_SEND = 2;

let messageRefs = [];
let isListening = false;


module.exports = (users) => {
    const t0 = _.now();
    console.log(`[fb_function_fanout] sending ${MAX_MESSAGE_SEND} to ${users.length} users`)
    return asyncq.series([
        () => listenOnMessages(users),
        () => sendMessages(users, MAX_MESSAGE_SEND),
        removeListener
    ]).then(r => {
        now = _.now();
        console.log(JSON.stringify(r, null, 2))
        return {
            test: 'fb_function__fanout',
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
    console.log('[fb_function_fanout] listening for messages');
    return asyncq.each(users, (user, index, arr) => {
        return new Promise((resolve, reject) => {
            const uRef = firebase.database().ref(`/messages/${user.id}`);
            messageRefs.push(uRef);
            uRef.orderByChild('sent_at')
                .limitToLast(1)
                .on('child_added', snapshot => {
                    if (isListening) {
                        const message_id = snapshot.val().id;
                        // console.log(`[fb_function_fanout] user ${user.id} recieved ${message_id} at ${_.now()}`);
                        if (fanoutStats.messages[`${message_id}`]) {
                            // only process the message that this worker was sent
                            const sent_at = fanoutStats.messages[`${message_id}`].sent_at
                            const delivered_at = _.now();
                            fanoutStats.messages[`${message_id}`].users[`${user.id}`] = {
                                delivery_elapsed: delivered_at - sent_at,
                                delivered_at: delivered_at
                            };
                        }
                    }
                    resolve()
                });
            resolve()
        });
    }).then((r) => {
        now = _.now();
        console.log('[fb_function_fanout] finished listening on messages');
        return {
            type: 'listen',
            elapsed: now - t0
        }
    })
}

const removeListener = (users) => {
    console.log('[fb_function_fanout] remove listeners from messages');
    return new Promise((resolve, reject) => {
        messageRefs.forEach((ref) => {
            ref.off();
        });
        console.log('[fb_function_fanout] finished remove listeners');
        resolve({ type: 'remove_listeners' });
    })
}


const sendMessages = (users, count = 1) => {
    fanoutStats.started = _.now();
    isListening = true;
    console.log('[fb_function_fanout] sending messages');
    return asyncq.times(count, () => {
        const messageRef = firebase.database().ref().child(`/group_chats/group_01/`).push();
        const message_id = messageRef.key;
        fanoutStats.messages[`${message_id}`] = { users: {} };
        const sentAt = new Date().getTime();
        let message = {
            id: message_id,
            text: `Hello from ${users[0].id} at ${sentAt}`,
            sent_by: users[0].id,
            sent_at: sentAt,
            group_id: 'group_01'
        };
        const stats_sent_at = _.now();
        // console.log(`[fb_function_fanout] sending message ${message_id} at ${stats_sent_at}`)
        fanoutStats.messages[`${message_id}`].sent_at = stats_sent_at;
        // console.log(fanoutStats.messages);
        // console.log('\n');
        return messageRef.set(message).then(() => {
            const delivered = _.now();
            fanoutStats.messages[`${message_id}`].all_delivered = delivered;
            fanoutStats.messages[`${message_id}`].all_delivered_elapsed = delivered - stats_sent_at;
            // console.log(`[fb_function_fanout] message ${message_id} delivered at ${delivered}\n`);
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
