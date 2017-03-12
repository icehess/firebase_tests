const firebaseConfig = require('./fb_configs.js');
var firebase = require('firebase');
var asyncq = require('async-q');
var initializeDb = require('./tests/initializeDb.js');
var presenseTest = require('./tests/presense.js');
var clientFanOutTest = require('./tests/client_fanout.js');


const MAX_USER = 2;

const app = firebase.initializeApp(firebaseConfig);

var users = [];
for (let i = 0; i < MAX_USER; i++) {
    let user_id = 'user_';
    if (i < 9) {
        user_id = 'user_0' + (i + 1);
    } else {
        user_id = 'user_' + (i + 1);
    }
    users[i] = {
        id: user_id
    };
}

asyncq.series([
    () => { return initializeDb(users) },
    () => { return presenseTest(users) },
    () => { return clientFanOutTest(users) }
]).then(results => {
    console.log(`\n\n tests results: \n\n ${JSON.stringify(results, null, 2)}`)
}).done(() => {
    console.log('\n all tests are done \n');
    app.delete();
})

// // fan-out (user_01 sends to all)
// setTimeout(() => {
//     console.log('\n');
//     console.log('\n');
//     console.log('Client fan-out test run');
//     workers[0].clientFanOut(users, 10);
// }, 4000);
