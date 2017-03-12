const functions = require('firebase-functions');
const admin = require('firebase-admin');
const _ = require('lodash');

admin.initializeApp(functions.config().firebase);

/**
 * Triggers when a group gets a new message and sends a message to all group members.
 *
 * User add the message to `/group_chats/{groupid}/{messageid}`.
 */
exports.sendMessagetoGroup = functions.database.ref('/group_chats/{groupid}/{messageid}').onWrite(event => {
    const group_id = event.params.groupid;
    const message_id = event.params.messageid;

    if (!event.data.val()) {
        return console.log('no payload in message');
    }
    console.log(`group ${group_id} has a new message: ${message_id}`);

    const message = event.data.val();
    const sender_id = message.send_by;

    // Get the list of members
    return admin.database().ref(`/groups/${group_id}/members`).once('value').then(result => {
        if (!result.hasChildren()) {
            return console.log(`group ${group_id} has no members`);
        }

        const memberIds = [];
        let updates = {};
        console.log(JSON.stringify(result.val(), null, 2))

        _.map(result.val(), (member) => {
                memberIds.push(member.user_id);
                updates[`/messages/${member.user_id}/${message_id}`] = message;
        })

        if (memberIds.length === 0) {
            return console.log(`group ${group_id} has no members`);
        }

        console.log(`there are ${memberIds.length} memberIds in ${group_id}`);

        updates[`/pn_worker/${message_id}`] = message;
        return admin.database().ref().update(updates).then(() => {
            console.log(`[fanout] message ${message_id} delivered at ${_.now()}`);
        });
    })
});
