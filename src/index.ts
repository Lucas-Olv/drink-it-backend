require("dotenv").config();
const Fastify = require('fastify');
const cron = require ('node-cron');
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');
const admin = require("firebase-admin");
const port = process.env.PORT || 3000;
const host = ("RENDER" in process.env) ? `0.0.0.0` : `localhost`;


//FIREBASE INIT
const serviceAccount = require(process.env.FIREBASE_ADMIN_KEY || "");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = getFirestore();

//FASTIFY CONFIG
const fastify = Fastify({
  logger: false
})

fastify.addHook('preHandler', (req, res, done) => {

  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST");
  res.header("Access-Control-Allow-Headers",  "*");

  const isPreflight = /options/i.test(req.method);
  if (isPreflight) {
    return res.send();
  }
      
  done();
})

fastify.post("/scheduleReminder", (request, reply) => {
  try {
    createReminderTask(request.body.userUid);
    reply.send({result: 'ok'});
  } catch (error) {
    reply.send({error: error})
  }
})

fastify.listen({host: host, port: port}), function(error, address) {
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log("Server running. ", address);
};

//SCHEDULER
function createReminderTask(userId) {
  cron.schedule(createCronDateTime('*/10', '*', '*', '*', '*', '*'), async() => {
    let authUsers = db.collection('/authenticated-users').doc(userId);
    let userRef = await authUsers.get();

    if (!userRef.exists) {
      console.log('No such document!');
    } else {
      let userData = userRef.data();
      let message = {
        notification: {
          title: 'Tá na hora de beber água!',
          body: 'Vira um gole aí, gatinha!'
        },
        token: userData.firebaseMessagingToken
      };
      getMessaging().send(message).then((response) => {
        console.log('Successfully sent message:', response);
      }).catch((error) => {
        console.log('Error sending message:', error);
      });
    }
  })
}

function createCronDateTime(seconds, minutes, hour, dayOfTheMonth, month, dayOfTheWeek) {
  return seconds + " " + minutes + " " + hour + " " + dayOfTheMonth + " " + month + " " + dayOfTheWeek;
}
