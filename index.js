const firebaseConfig = require('./fb_configs.js');
const firebase = require('firebase');
const asyncq = require('async-q');
const fs = require('fs');
const initializeDb = require('./tests/initializeDb.js');
const presenseTest = require('./tests/presense.js');
const clientFanOutTest = require('./tests/client_fanout.js');
const fbFunctionFanout = require('./tests/function_fanout.js');

const MAX_USER = 40;

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
    () => { return clientFanOutTest(users) },
    () => { return fbFunctionFanout(users) }
]).then(results => {
    // console.log(`\n\n tests results: \n\n ${JSON.stringify(results, null, 2)}`)
    const json = JSON.stringify(results, null, 2);
    const d = new Date();
    const file_name = `results_${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}_${d.getHours()}${d.getMinutes()}${d.getSeconds()}_${d.getTime()}.json`;
    fs.writeFile(file_name, json, 'utf8', () => {
        console.log(`test logs filename: ${file_name}`);
    });
}).done(() => {
    console.log('\n all tests are done \n');
    app.delete();
})
