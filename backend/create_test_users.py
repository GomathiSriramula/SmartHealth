"""
Quick script to create a test user without prompts
"""
import asyncio
from app.database import async_session
from app.models import User
from app.utils.auth import get_password_hash, get_user_by_username

async def create_test_users():
    """Create test users."""
    test_users = [
        {
            "email": "admin@smarthealth.com",
            "username": "admin",
            "full_name": "Admin User",
            "password": "admin123",
            "is_admin": True
        },
        {
            "email": "test@smarthealth.com",
            "username": "testuser",
            "full_name": "Test User",
            "password": "test123",
            "is_admin": False
        }
    ]
    
    async with async_session() as db:
        for user_data in test_users:
            # Check if user exists
            existing = await get_user_by_username(db, user_data["username"])
            if existing:
                print(f"⚠ User '{user_data['username']}' already exists, skipping...")
                continue
            
            # Create user
            user = User(
                email=user_data["email"],
                username=user_data["username"],
                full_name=user_data["full_name"],
                hashed_password=get_password_hash(user_data["password"]),
                is_active=True,
                is_admin=user_data["is_admin"]
            )
            
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
            print(f"✓ Created {'admin' if user.is_admin else 'regular'} user:")
            print(f"  Username: {user.username}")
            print(f"  Password: {user_data['password']}")
            print(f"  Email: {user.email}")
            print()

if __name__ == "__main__":
    print("=== Creating Test Users ===\n")
    asyncio.run(create_test_users())
    print("✓ Done!")
