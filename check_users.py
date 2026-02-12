from pymongo import MongoClient

# Connect to MongoDB
client = MongoClient("mongodb+srv://Gomathi:Gomathi123@cluster0.2ddfd5q.mongodb.net/?appName=Cluster0")
db = client.smart_health

# Get users
users = db.users.find({}, {"username": 1, "email": 1, "role": 1, "_id": 0})

print("📋 Users in database:")
for user in users:
    print(f"   • Username: {user.get('username')}, Email: {user.get('email')}, Role: {user.get('role')}")

client.close()
