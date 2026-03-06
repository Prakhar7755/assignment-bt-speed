# Identity Reconciliation API

Backend service for the Bitespeed Identity Reconciliation assignment.

Live Deployment: https://bite-speed-api.onrender.com (/ for health check and /identify for backend service endpoint)

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM

## API Endpoint

POST /identify

### Request

{
"email": "doc@flux.com",
"phoneNumber": "999"
}

### Response

{
"contact": {
"primaryContatctId": 7,
"emails": ["doc@flux.com","doc2@flux.com"],
"phoneNumbers": ["999","888"],
"secondaryContactIds": [8,9]
}
}

## How to Run Locally

1. Clone repo
2. Install dependencies

npm install

3. Setup .env

DATABASE_URL="postgresql://..."

4. Run migrations

npx prisma migrate dev

5. Start server

node index.js

Server runs on:
http://localhost:3000
