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
    console.log(`[fb_function_fanout] sending ${MAX_MESSAGE_SEND} messages to ${users.length} users`);
    return asyncq.series([
        () => listenOnMessages(users),
        () => sendMessages(users, MAX_MESSAGE_SEND),
        removeListener
    ]).then(r => {
        now = _.now();
        return {
            test: 'cloud_function',
            started: t0,
            done: now,
            elapsed: now - t0 - 4000 - 5000,
            internal_results: Object.assign({}, { testsStats: r }, { message_status: message_status })
        }
    });
}

const listenOnMessages = (users) => {
    const t0 = _.now();
    console.log('[fb_function_fanout] start listening for messages');
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
        console.log('[fb_function_fanout] waiting 4s for Firebase to fire the events for the first time...');
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
        // console.log(`[fb_function_fanout] user ${user.id} recieved ${message_id} at ${_.now()}`);
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
            console.log('[fb_function_fanout] remove listeners from messages');
            messageRefs.forEach((ref) => {
                ref.off();
            });
            console.log('[fb_function_fanout] finished remove listeners');
            resolve({
                test: 'remove_listeners',
            })
        }, 5000);
    })
}


const sendMessages = (users, count = 1) => {
    message_status.started = _.now();
    console.log('[fb_function_fanout] sending messages');
    return asyncq.times(count, () => {
        doSendMessage(users[0]);
    }).then((r) => {
        return {
            type: 'send_message_cloud_functions',
            total_elapsed: _.now() - message_status.started,
            total_users: MAX_MESSAGE_SEND,
            sent_msg_ids: r
        }
    })
}

const doSendMessage = (user) => {
    const messageRef = firebase.database().ref().child(`/group_chats/group_01/`).push();
    const message_id = messageRef.key;
    message_status.messages[`${message_id}`] = { users: {} };
    const sentAt = new Date().getTime();
    let message = {
        id: message_id,
        text: `Hello from ${user.id} at ${sentAt}`,
        sent_by: user.id,
        sent_at: sentAt,
        group_id: 'group_01'
    };
    const stats_sent_at = _.now();
    // console.log(`[fb_function_fanout] sending message ${message_id} at ${stats_sent_at}`)
    message_status.messages[`${message_id}`].sent_at = stats_sent_at;
    return messageRef.set(message).then(() => {
        const delivered = _.now();
        message_status.messages[`${message_id}`].sent_done_time = delivered;
        message_status.messages[`${message_id}`].sent_done_elapsed = delivered - stats_sent_at;
        // console.log(`[fb_function_fanout] message ${message_id} delivered at ${delivered}\n`);
        return message_id;
    });
}
