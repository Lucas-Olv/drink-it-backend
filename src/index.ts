require("dotenv").config();
const Fastify = require('fastify');
const cron = require('node-cron');
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
  res.header("Access-Control-Allow-Headers", "*");

  const isPreflight = /options/i.test(req.method);
  if (isPreflight) {
    return res.send();
  }

  done();
})

fastify.listen({ host: host, port: port }), function (error, address) {
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log("Server running. ", address);
};

fastify.post("/createReminder", (request, reply) => {
  const userHasTask = cron.getTasks().get(request.body.userUid);
  userHasTask ? userHasTask.stop() : console.log('No schedule found.');

  try {
    const schedule = cron.schedule(createCronDateTime('*/2', '*', '*', '*', '*', '*'), async () => {
      const authUsers = db.collection('/authenticated-users').doc(request.body.userUid);
      const userRef = await authUsers.get();

      const notificationTitle = "Tá na hora de beber água!";
      const notificationBody = "Vira um gole aí, gatinha!";

      if (!userRef.exists) {
        reply.code(400);
        reply.send({ error: "User is not registered" });
        schedule.stop();
      } else {
        const userData = userRef.data();
        const message = {
          notification: {
            title: notificationTitle,
            body: notificationBody
          },
          token: userData.firebaseMessagingToken
        };
        getMessaging().send(message).then((response) => {
          console.log('Successfully sent message:', response);
        }).catch((error) => {
          console.log('Error sending message:', error);
        });
      }
    }, { name: request.body.userUid });
    schedule.start();
    reply.code(200);
    reply.send({ result: 'Schedule registered with success' });
  } catch (error) {
    reply.send({ error: error })
  }
})

function createCronDateTime(seconds, minutes, hour, dayOfTheMonth, month, dayOfTheWeek) {
  return seconds + " " + minutes + " " + hour + " " + dayOfTheMonth + " " + month + " " + dayOfTheWeek;
}
