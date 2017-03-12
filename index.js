const firebaseConfig = require('./fb_configs.js');
const firebase = require('firebase');
const asyncq = require('async-q');
const initializeDb = require('./tests/initializeDb.js');
const presenseTest = require('./tests/presense.js');
const clientFanOutTest = require('./tests/client_fanout.js');
const fbFunctionFanout = require('./tests/function_fanout.js');

const MAX_USER = 10;

const app = firebase.initializeApp(firebaseConfig);

let users = [];
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
    // () => { return clientFanOutTest(users) },
    () => { return fbFunctionFanout(users) }
]).then(results => {
    console.log(`\n\n tests results: \n\n ${JSON.stringify(results, null, 2)}`)
}).done(() => {
    console.log('\n all tests are done \n');
    app.delete();
})
