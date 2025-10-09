# Authentication Setup Guide

This guide explains how to set up and use the authentication system in SmartHealth.

## Features Implemented

### Backend
- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ User registration endpoint
- ✅ User login endpoint
- ✅ Protected routes with token verification
- ✅ User roles (admin/regular user)
- ✅ User model with email, username, and profile info

### Frontend
- ✅ Login component
- ✅ Register component
- ✅ Authentication context (React Context API)
- ✅ Token management with localStorage
- ✅ Protected routes
- ✅ Logout functionality
- ✅ User info display in navigation

## Setup Instructions

### 1. Backend Setup

#### Install Dependencies
```powershell
cd backend
pip install -r requirements.txt
```

#### Configure Environment Variables
Create a `.env` file in the backend directory:
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/smarthealth
SECRET_KEY=your-very-long-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30
API_KEY=secret-key
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Important:** Change the `SECRET_KEY` to a secure random string in production!

#### Initialize Database Tables
```powershell
cd backend
python init_auth_db.py
```

#### Create Admin User
```powershell
cd backend
python create_admin.py
```

Follow the prompts to create your admin account.

### 2. Frontend Setup

#### Install Dependencies
```powershell
cd frontend
npm install
```

#### Configure Environment Variables
Create a `.env` file in the frontend directory:
```env
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Running the Application

#### Start Backend
```powershell
cd backend
uvicorn app.main:app --reload
```

#### Start Frontend
```powershell
cd frontend
npm run dev
```

## API Endpoints

### Authentication Endpoints

#### Register New User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "full_name": "Full Name (optional)"
}
```

#### Login (JSON)
```http
POST /api/auth/login/json
Content-Type: application/json

{
  "username": "username",
  "password": "password123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username",
    "full_name": "Full Name",
    "is_active": true,
    "is_admin": false,
    "created_at": "2025-10-09T12:00:00"
  }
}
```

#### Login (Form Data - OAuth2 compatible)
```http
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

username=username&password=password123
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### Logout
```http
POST /api/auth/logout
```

Note: Logout is handled client-side by removing the token from localStorage.

## Using Protected Routes

### Backend - Protecting Endpoints

To protect an endpoint, use the dependency injection:

```python
from fastapi import Depends
from app.utils.auth import get_current_active_user, get_current_admin_user
from app import models

# Require authenticated user
@router.get("/protected")
async def protected_route(current_user: models.User = Depends(get_current_active_user)):
    return {"message": f"Hello {current_user.username}!"}

# Require admin user
@router.get("/admin-only")
async def admin_route(current_user: models.User = Depends(get_current_admin_user)):
    return {"message": "Admin access granted"}
```

### Frontend - Using Authentication

```tsx
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please login</div>;
  }

  return (
    <div>
      <p>Welcome {user.username}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Making Authenticated API Calls

```tsx
const { token } = useAuth();

const response = await fetch(`${API_URL}/api/protected`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## Testing

### Test Credentials
After running `create_admin.py` with test user option:
- Username: `testuser`
- Password: `password123`
- Email: `test@example.com`

### Manual Testing with curl

```powershell
# Register
curl -X POST http://localhost:8000/api/auth/register -H "Content-Type: application/json" -d '{\"email\":\"test@test.com\",\"username\":\"testuser2\",\"password\":\"password123\"}'

# Login
curl -X POST http://localhost:8000/api/auth/login/json -H "Content-Type: application/json" -d '{\"username\":\"testuser\",\"password\":\"password123\"}'

# Get current user (replace TOKEN with actual token)
curl -X GET http://localhost:8000/api/auth/me -H "Authorization: Bearer TOKEN"
```

## Security Best Practices

1. **SECRET_KEY**: Use a long, random string (at least 32 characters) in production
2. **HTTPS**: Always use HTTPS in production
3. **Token Expiry**: Tokens expire after 30 minutes by default (configurable)
4. **Password Policy**: Minimum 6 characters (consider strengthening for production)
5. **CORS**: Configure proper CORS origins for production

## Troubleshooting

### "Could not validate credentials" error
- Check if token has expired (default: 30 minutes)
- Verify token is being sent in Authorization header
- Ensure SECRET_KEY matches between token creation and validation

### Registration fails with "already registered"
- Username or email already exists in database
- Try different credentials

### Frontend can't connect to backend
- Verify backend is running on correct port
- Check VITE_API_BASE_URL in frontend/.env
- Verify CORS is configured correctly in backend

## Next Steps

You can now:
1. ✅ Add authentication to existing endpoints
2. ✅ Create role-based access control
3. ✅ Add password reset functionality
4. ✅ Implement refresh tokens
5. ✅ Add OAuth2 social login (Google, GitHub, etc.)
6. ✅ Add email verification
7. ✅ Implement rate limiting

## File Structure

```
backend/
├── app/
│   ├── routes/
│   │   └── auth.py          # Authentication endpoints
│   ├── utils/
│   │   └── auth.py          # Auth utilities (JWT, password hashing)
│   ├── models.py            # User model
│   └── schemas.py           # User schemas
├── create_admin.py          # Admin user creation script
└── init_auth_db.py          # Database initialization

frontend/
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx  # Authentication context
│   ├── components/
│   │   ├── Login.tsx        # Login component
│   │   ├── Register.tsx     # Register component
│   │   └── Navigation.tsx   # Updated with logout
│   └── App.tsx              # Updated with auth flow
└── .env                     # Frontend config
```
