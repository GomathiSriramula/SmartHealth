"""
Script to create an initial admin user.
Run this after initializing the database.
"""
import asyncio
import sys
import os
from getpass import getpass
from app.database import async_session
from app.models import User
from app.utils.auth import get_password_hash, get_user_by_username, get_user_by_email

async def create_admin_user():
    """Create an admin user interactively."""
    print("=== Create Admin User ===\n")
    
    # Get user details
    username = input("Enter admin username: ").strip()
    if not username:
        print("Username cannot be empty!")
        sys.exit(1)
    
    email = input("Enter admin email: ").strip()
    if not email:
        print("Email cannot be empty!")
        sys.exit(1)
    
    full_name = input("Enter full name (optional): ").strip() or None
    
    password = getpass("Enter password: ")
    password_confirm = getpass("Confirm password: ")
    
    if password != password_confirm:
        print("Passwords do not match!")
        sys.exit(1)
    
    if len(password) < 6:
        print("Password must be at least 6 characters long!")
        sys.exit(1)
    
    # Create user in database
    async with async_session() as db:
        # Check if username exists
        existing_user = await get_user_by_username(db, username)
        if existing_user:
            print(f"Error: Username '{username}' already exists!")
            sys.exit(1)
        
        # Check if email exists
        existing_email = await get_user_by_email(db, email)
        if existing_email:
            print(f"Error: Email '{email}' already exists!")
            sys.exit(1)
        
        # Create admin user
        hashed_password = get_password_hash(password)
        admin_user = User(
            email=email,
            username=username,
            full_name=full_name,
            hashed_password=hashed_password,
            is_active=True,
            is_admin=True
        )
        
        db.add(admin_user)
        await db.commit()
        await db.refresh(admin_user)
        
        print(f"\n✓ Admin user created successfully!")
        print(f"  Username: {admin_user.username}")
        print(f"  Email: {admin_user.email}")
        print(f"  ID: {admin_user.id}")
        print(f"  Admin: {admin_user.is_admin}")

async def create_test_user():
    """Create a test regular user."""
    print("\n=== Creating Test User ===\n")
    
    test_user = User(
        email="test@example.com",
        username="testuser",
        full_name="Test User",
        hashed_password=get_password_hash("password123"),
        is_active=True,
        is_admin=False
    )
    
    async with async_session() as db:
        # Check if user already exists
        existing = await get_user_by_username(db, test_user.username)
        if existing:
            print("Test user already exists!")
            return
        
        db.add(test_user)
        await db.commit()
        await db.refresh(test_user)
        
        print(f"✓ Test user created!")
        print(f"  Username: {test_user.username}")
        print(f"  Password: password123")
        print(f"  Email: {test_user.email}")

if __name__ == "__main__":
    try:
        # Create admin user
        asyncio.run(create_admin_user())
        
        # Ask if they want to create a test user
        create_test = input("\nCreate a test user? (y/n): ").strip().lower()
        if create_test == 'y':
            asyncio.run(create_test_user())
            
    except KeyboardInterrupt:
        print("\nOperation cancelled.")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
