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

    const t0 = _.now();

    if (!event.data.val()) {
        return console.log('no payload in message');
    }
    console.log(`group ${group_id} has a new message: ${message_id}`);

    const message = event.data.val();
    const sender_id = message.send_by;

    // Get the list of members
    return admin.database().ref(`/groups/${group_id}/members`).once('value').then(result => {
        const t1 = _.now();
        let t2;
        if (!result.hasChildren()) {
            return console.log(`group ${group_id} has no members`);
        }

        const memberIds = [];
        let updates = {};
        console.log(JSON.stringify(result.val(), null, 2))

        _.map(result.val(), (member) => {
                t2 = _.now();
                memberIds.push(member.user_id);
                updates[`/messages/${member.user_id}/${message_id}`] = message;
        })

        if (memberIds.length === 0) {
            return console.log(`group ${group_id} has no members`);
        }

        console.log(`there are ${memberIds.length} memberIds in ${group_id}`);
        const t3 = _.now();
        updates[`/pn_worker/${message_id}`] = message;
        return admin.database().ref().update(updates).then(() => {
            const t4 = _.now();
            console.log(`[fanout] message ${message_id} delivered at ${_.now()}`);
            console.log(`elapsed: start=${t0} total=${t4 - t0} members_fetch=${t1 - t0} loop=${t2 - t1} update=${t4 - t3} end=${t4}`);
        });
    })
});
