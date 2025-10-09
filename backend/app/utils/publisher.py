# app/utils/publisher.py
import os
import json
import asyncio

RABBITMQ_URL = os.getenv("RABBITMQ_URL", None)

async def publish_to_queue(routing_key: str, payload: dict):
    if not RABBITMQ_URL:
        # fallback for local dev / tests
        print("PUBLISH (fallback)", routing_key, json.dumps(payload))
        return
    try:
        import aio_pika
        connection = await aio_pika.connect_robust(RABBITMQ_URL)
        async with connection:
            channel = await connection.channel()
            await channel.default_exchange.publish(
                aio_pika.Message(body=json.dumps(payload).encode()),
                routing_key=routing_key
            )
    except Exception as e:
        # don't crash ingestion if publish fails; log and continue
        print("Publish failed:", e)
def publish_event(routing_key: str, payload: dict):
    pass