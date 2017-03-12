const firebaseConfig = require('./fb_configs.js');
const firebase = require('firebase');

var app = firebase.initializeApp(firebaseConfig);

firebase.database().ref('/groups').remove();
firebase.database().ref('/messages').remove();
firebase.database().ref('/pn_workers').remove();
firebase.database().ref('/users').remove();
firebase.database().ref('/group_chats').remove();
firebase.database().ref('/presence').remove();

app.delete();
