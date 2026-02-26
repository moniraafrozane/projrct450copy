# Event Marketplace API Documentation

## Overview

Complete backend API for Event Marketplace where users can create events and register for them.

## Database Models

### Event Model

- `id`: Unique identifier
- `title`: Event name
- `description`: Event details
- `category`: Event category (optional)
- `venue`: Event location
- `eventDate`: Date of the event
- `startTime`: Event start time
- `endTime`: Event end time
- `maxParticipants`: Maximum number of participants (optional)
- `registrationDeadline`: Last date to register (optional)
- `registrationFee`: Fee amount (default: 0)
- `organizerId`: User who created the event
- `organizerName`: Name of organizer
- `organizerContact`: Contact information (optional)
- `status`: upcoming | ongoing | completed | cancelled
- `isPublished`: Whether event is visible
- `bannerImage`: Event banner URL (optional)

### EventRegistration Model

- `id`: Unique identifier
- `userId`: Registered user ID
- `userName`: Participant name
- `userEmail`: Participant email
- `userPhone`: Participant phone (optional)
- `eventId`: Reference to event
- `registrationDate`: When registration was made
- `status`: confirmed | waitlisted | cancelled
- `paymentStatus`: pending | paid | refunded
- `remarks`: Additional notes (optional)

## API Endpoints

### Base URL: `/api/events`

---

### 1. Get All Events (Public)

**GET** `/api/events`

**Query Parameters:**

- `status` - Filter by event status (upcoming/ongoing/completed/cancelled)
- `category` - Filter by category
- `search` - Search in title and description
- `upcoming` - true/false (shows only future events)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Response:**

```json
{
  "success": true,
  "events": [
    {
      "id": "uuid",
      "title": "Tech Conference 2026",
      "description": "Annual technology conference",
      "category": "Technology",
      "venue": "Main Auditorium",
      "eventDate": "2026-03-15T00:00:00.000Z",
      "startTime": "09:00",
      "endTime": "17:00",
      "maxParticipants": 100,
      "registrationDeadline": "2026-03-10T00:00:00.000Z",
      "registrationFee": 500,
      "organizerName": "CSE Society",
      "status": "upcoming",
      "_count": {
        "registrations": 45
      }
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "pages": 5
  }
}
```

---

### 2. Get Single Event (Public)

**GET** `/api/events/:id`

**Response:**

```json
{
  "success": true,
  "event": {
    "id": "uuid",
    "title": "Tech Conference 2026",
    "description": "Annual technology conference",
    "venue": "Main Auditorium",
    "eventDate": "2026-03-15T00:00:00.000Z",
    "registrations": [
      {
        "id": "uuid",
        "userName": "John Doe",
        "userEmail": "john@example.com",
        "registrationDate": "2026-02-20T10:30:00.000Z",
        "status": "confirmed",
        "paymentStatus": "paid"
      }
    ],
    "_count": {
      "registrations": 45
    }
  }
}
```

---

### 3. Create Event (Protected)

**POST** `/api/events`

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "title": "Tech Conference 2026",
  "description": "Annual technology conference",
  "category": "Technology",
  "venue": "Main Auditorium",
  "eventDate": "2026-03-15",
  "startTime": "09:00",
  "endTime": "17:00",
  "maxParticipants": 100,
  "registrationDeadline": "2026-03-10",
  "registrationFee": 500,
  "organizerName": "CSE Society",
  "organizerContact": "cse@example.com",
  "bannerImage": "https://example.com/banner.jpg"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Event created successfully",
  "event": {
    /* event object */
  }
}
```

---

### 4. Update Event (Protected)

**PUT** `/api/events/:id`

**Headers:**

```
Authorization: Bearer <token>
```

**Authorization:** Only event organizer or admin

**Request Body:** (All fields optional)

```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "ongoing"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Event updated successfully",
  "event": {
    /* updated event object */
  }
}
```

---

### 5. Delete Event (Protected)

**DELETE** `/api/events/:id`

**Headers:**

```
Authorization: Bearer <token>
```

**Authorization:** Only event organizer or admin

**Response:**

```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

---

### 6. Register for Event (Protected)

**POST** `/api/events/:eventId/register`

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "remarks": "Looking forward to attending!"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Successfully registered for the event",
  "registration": {
    "id": "uuid",
    "userId": "uuid",
    "userName": "John Doe",
    "userEmail": "john@example.com",
    "eventId": "uuid",
    "status": "confirmed",
    "paymentStatus": "pending"
  }
}
```

**Validations:**

- Event must be published
- Registration deadline must not have passed
- Event must not be full
- User cannot register twice for the same event

---

### 7. Cancel Registration (Protected)

**DELETE** `/api/events/:eventId/register`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Registration cancelled successfully"
}
```

---

### 8. Get My Registrations (Protected)

**GET** `/api/events/my/registrations`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "registrations": [
    {
      "id": "uuid",
      "userName": "John Doe",
      "status": "confirmed",
      "paymentStatus": "paid",
      "registrationDate": "2026-02-20T10:30:00.000Z",
      "event": {
        "id": "uuid",
        "title": "Tech Conference 2026",
        "eventDate": "2026-03-15T00:00:00.000Z",
        "venue": "Main Auditorium"
      }
    }
  ]
}
```

---

### 9. Get My Events (Protected)

**GET** `/api/events/my/events`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "events": [
    {
      "id": "uuid",
      "title": "My Event",
      "eventDate": "2026-03-15T00:00:00.000Z",
      "status": "upcoming",
      "_count": {
        "registrations": 25
      }
    }
  ]
}
```

---

### 10. Get Event Statistics (Protected)

**GET** `/api/events/:id/stats`

**Headers:**

```
Authorization: Bearer <token>
```

**Authorization:** Only event organizer or admin

**Response:**

```json
{
  "success": true,
  "stats": {
    "totalRegistrations": 45,
    "breakdown": [
      {
        "status": "confirmed",
        "paymentStatus": "paid",
        "_count": 40
      },
      {
        "status": "confirmed",
        "paymentStatus": "pending",
        "_count": 5
      }
    ],
    "capacity": 100,
    "spotsRemaining": 55
  }
}
```

---

## Error Responses

All endpoints may return error responses in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Usage Examples

### Example 1: List upcoming events

```bash
GET /api/events?upcoming=true&limit=20
```

### Example 2: Search for technology events

```bash
GET /api/events?category=Technology&search=conference
```

### Example 3: Create an event

```bash
POST /api/events
Authorization: Bearer eyJhbGc...

{
  "title": "Coding Workshop",
  "description": "Learn Python programming",
  "venue": "Lab 101",
  "eventDate": "2026-04-01",
  "startTime": "14:00",
  "endTime": "16:00",
  "organizerName": "CS Department",
  "maxParticipants": 30
}
```

### Example 4: Register for an event

```bash
POST /api/events/abc123/register
Authorization: Bearer eyJhbGc...

{
  "remarks": "Excited to learn!"
}
```

---

## Features

✅ Create and manage events
✅ Public event listing with filters and search
✅ Event registration with capacity limits
✅ Registration deadline validation
✅ Payment status tracking
✅ User registration history
✅ Event organizer dashboard
✅ Event statistics for organizers
✅ Role-based access control
✅ Automatic user information population
✅ Prevent duplicate registrations
✅ Pagination support

---

## Next Steps

To use this API:

1. ✅ Database migrations are complete
2. ✅ API endpoints are ready
3. Start the backend server: `npm run dev`
4. Test the endpoints using Postman or similar tool
5. Integrate with your frontend application

## Notes

- All authenticated routes require a valid JWT token
- Event organizerId is automatically set from the authenticated user
- User information (name, email, phone) is automatically populated from the authenticated user's profile
- Events cascade delete their registrations when deleted
