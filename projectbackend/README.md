# Authentication Backend API

A Node.js/Express authentication backend with role-based access control for students, admins, and society members.

## Features

- ✅ User registration and login with role-based access (student, admin, society)
- ✅ JWT token authentication
- ✅ Password hashing with bcrypt
- ✅ Protected routes with middleware
- ✅ Role-specific user data (student ID, society name, etc.)
- ✅ Rate limiting for security
- ✅ CORS enabled for frontend integration
- ✅ MongoDB database integration

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

## Installation

1. Install dependencies:

```bash
cd projectbackend
npm install
```

2. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/student_management
JWT_SECRET=your_very_secure_secret_key_here
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
```

## Running the Server

### Development mode (with auto-restart):

```bash
npm run dev
```

### Production mode:

```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication Routes

#### 1. Register User

- **POST** `/api/auth/register`
- **Public**
- **Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "student",
  "studentId": "S12345",
  "program": "Computer Science",
  "year": 3
}
```

For society members:

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "password123",
  "role": "society",
  "societyName": "Tech Society",
  "societyRole": "President"
}
```

For admin (phone number is required):

```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "phone": "1234567890",
  "password": "password123",
  "role": "admin"
}
```

#### 2. Login User

- **POST** `/api/auth/login`
- **Public**
- **Body:**

```json
{
  "email": "john@example.com",
  "password": "password123",
  "role": "student"
}
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "studentId": "S12345",
    "isActive": true
  }
}
```

#### 3. Get Current User

- **GET** `/api/auth/me`
- **Private** (requires authentication)
- **Headers:** `Authorization: Bearer <token>`

#### 4. Update User Details

- **PUT** `/api/auth/update`
- **Private**
- **Headers:** `Authorization: Bearer <token>`
- **Body:**

```json
{
  "name": "John Updated",
  "program": "Software Engineering"
}
```

#### 5. Update Password

- **PUT** `/api/auth/updatepassword`
- **Private**
- **Headers:** `Authorization: Bearer <token>`
- **Body:**

```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

#### 6. Logout

- **POST** `/api/auth/logout`
- **Private**
- **Headers:** `Authorization: Bearer <token>`

### Health Check

- **GET** `/api/health`
- **Public**

## User Roles

The system supports three user roles:

1. **student** - Students with student ID, program, and year
2. **admin** - Administrators with full access
3. **society** - Society members with society name and role

## Security Features

- Password hashing using bcrypt
- JWT token authentication
- Rate limiting on all API routes (100 requests per 15 minutes)
- Stricter rate limiting on auth routes (5 requests per 15 minutes)
- CORS protection
- Helmet.js for HTTP header security
- Input validation and sanitization

## Database Schema

### User Model

```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (student/admin/society),
  studentId: String (for students),
  program: String (for students),
  year: Number (for students),
  societyName: String (for society),
  societyRole: String (for society),
  isActive: Boolean,
  isEmailVerified: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Frontend Integration

To integrate with your Next.js frontend, use the following example:

```typescript
// Login function
const login = async (email: string, password: string, role: string) => {
  try {
    const response = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await response.json();

    if (data.success) {
      // Store token in localStorage or cookie
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

// Protected API call example
const fetchProtectedData = async () => {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:5000/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error message here"
}
```

Common HTTP status codes:

- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

## Testing

You can test the API using tools like:

- Postman
- Thunder Client (VS Code extension)
- curl
- Your frontend application

Example curl commands:

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"test123","role":"student","studentId":"S001"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","role":"student"}'
```

## Troubleshooting

### MongoDB Connection Issues

- Ensure MongoDB is running locally or your MongoDB Atlas connection string is correct
- Check firewall settings if using MongoDB Atlas

### CORS Issues

- Verify FRONTEND_URL in .env matches your frontend URL
- Check that the frontend is making requests to the correct backend URL

### Token Issues

- Ensure JWT_SECRET is set in .env
- Check token expiration settings

## License

ISC
