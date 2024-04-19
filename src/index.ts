require("dotenv").config();
const Fastify = require('fastify');
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
  logger: true
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

fastify.get("/healthCheck", (request, reply) => {
  reply.code(200);
  reply.send({status: "ok"});
})

fastify.post("/createReminder", async (request, reply) => {
  try {
      const authUsers = db.collection('/authenticated-users');
      const userRef = await authUsers.get();
      userRef.forEach(doc => {
        let document = doc.data();
        const notificationTitle = process.env.NOTIFICATION_TITLE;
        const notificationBody = process.env.NOTIFICATION_BODY;

        if (!document) {
          reply.code(400);
          reply.send({ error: "User is not registered" });
        } else {
          const message = {
            "notification": {
              "title": notificationTitle,
              "body": notificationBody
            },
            "token": document.firebaseMessagingToken
          };
          getMessaging().send(message).then((response) => {
            console.log('Successfully sent message:', response);
          }).catch((error) => {
            console.log('Error sending message:', error);
          });
        }
      })
      reply.code(200);
      reply.send({result: "Notification has been sent."})
  } catch (error) {
    reply.send({ error: error })
  }
})
