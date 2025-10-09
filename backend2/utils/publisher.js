const amqp = require("amqplib");
const RABBITMQ_URL = process.env.RABBITMQ_URL || "";

async function publishToQueue(routingKey, payload) {
  if (!RABBITMQ_URL) {
    console.log("PUBLISH (fallback)", routingKey, JSON.stringify(payload));
    return;
  }
  let conn;
  try {
    conn = await amqp.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();
    // ensure queue exists
    await ch.assertQueue(routingKey, { durable: true });
    ch.sendToQueue(routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });
    await ch.close();
    await conn.close();
  } catch (e) {
    console.error("Publish failed:", e.message);
    try {
      if (conn) await conn.close();
    } catch (e) {}
  }
}

module.exports = publishToQueue;
