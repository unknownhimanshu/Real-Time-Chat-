# Real-Time Chat Application

A modern, full-featured real-time chat application built with React, Express, Socket.io, and PostgreSQL. Features personal messaging, group chats, video/audio calls, and real-time presence notifications.

**Live Demo:** [https://real-time-chat-server-nine.vercel.app](https://real-time-chat-server-nine.vercel.app)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [Docker Setup](#-docker-setup)
- [API Documentation](#-api-documentation)
- [Socket Events](#-socket-events)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Chat Features
- **Personal Messaging**: One-on-one chat with real-time message delivery
- **Group Chats**: Create and manage group conversations with multiple participants
- **Message Editing**: Edit sent messages in real-time
- **Message Deletion**: Delete messages for yourself or for everyone
- **Message Status**: Track sent, delivered, and read status
- **Typing Indicators**: See when someone is typing
- **Message Attachments**: Support for file attachments and images

### User Features
- **User Authentication**: Secure signup and login with JWT tokens
- **Profile Management**: Update profile picture, bio, and full name
- **Friend Management**: Add friends, send/accept friend requests
- **Online Status**: Real-time presence notifications showing who's online
- **User Search**: Find and connect with other users

### Communication Features
- **Video/Audio Calls**: WebRTC-based peer-to-peer calls (video and audio)
- **Call Notifications**: Real-time incoming call alerts
- **ICE Candidate Exchange**: Robust connection with TURN/STUN servers

### Technical Features
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Rate Limiting**: API rate limiting to prevent abuse
- **Cookie-Based Sessions**: Secure JWT token management via cookies
- **Real-time Sync**: Socket.io for instant updates across clients

---

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **Vite** - Build tool and dev server
- **React Router v7** - Client-side routing
- **Socket.io Client** - Real-time communication
- **Axios** - HTTP client
- **Tailwind CSS** - Utility-first CSS framework
- **React Hot Toast** - Toast notifications

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.io** - WebSocket library for real-time communication
- **Prisma ORM** - Database ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching and session management
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Cloudinary** - Image storage and CDN
- **Nodemon** - Development auto-reload

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **COTURN** - TURN server for WebRTC
- **Vercel** - Production deployment

---

## 📁 Project Structure

```
Real-Time-Chat-/
├── client/                          # Frontend React application
│   ├── src/
│   │   ├── App.jsx                 # Main app component with routing
│   │   ├── main.jsx                # Entry point with context providers
│   │   ├── index.css               # Global styles
│   │   ├── pages/
│   │   │   ├── HomePage.jsx        # Main chat interface
│   │   │   ├── LoginPage.jsx       # Auth page (signup/login)
│   │   │   └── ProfilePage.jsx     # User profile page
│   │   ├── components/
│   │   │   ├── Sidebar.jsx         # Left sidebar with conversations
│   │   │   ├── ChatContainer.jsx   # Main chat area
│   │   │   ├── RightSidebar.jsx    # Right sidebar for group/user info
│   │   │   └── CallOverlay.jsx     # Video/audio call interface
│   │   ├── lib/                    # Utility functions
│   │   └── assets/                 # Images and static files
│   ├── context/
│   │   ├── AuthContext.jsx         # Authentication state management
│   │   ├── ChatContext.jsx         # Chat state management
│   │   └── CallContext.jsx         # Call state management
│   ├── package.json
│   └── vite.config.js
│
├── server/                          # Backend Node.js application
│   ├── server.js                   # Main server file with Socket.io
│   ├── package.json
│   ├── controllers/
│   │   ├── userController.js       # User auth and profile logic
│   │   ├── messageController.js    # Message CRUD operations
│   │   ├── friendController.js     # Friend request handling
│   │   └── groupController.js      # Group chat logic
│   ├── routes/
│   │   ├── userRoutes.js           # Auth endpoints
│   │   ├── messageRoutes.js        # Message endpoints
│   │   ├── friendRoutes.js         # Friend endpoints
│   │   └── groupRoutes.js          # Group endpoints
│   ├── middleware/
│   │   ├── auth.js                 # JWT authentication middleware
│   │   └── rateLimiter.js          # Rate limiting middleware
│   ├── lib/
│   │   ├── db.js                   # Database connection
│   │   ├── redis.js                # Redis client setup
│   │   ├── cloudinary.js           # Cloudinary configuration
│   │   ├── chat.js                 # Chat utility functions
│   │   └── utils.js                # General utilities
│   ├── prisma/
│   │   └── schema.prisma           # Database schema
│   ├── .env.example                # Environment variables template
│   └── Dockerfile
│
├── infra/                           # Infrastructure files
│   └── coturn/
│       └── turnserver.conf         # TURN server configuration
│
├── docker-compose.yml              # Docker Compose configuration
├── .gitignore
└── README.md
```

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** v18 or higher
- **npm** or **yarn** package manager
- **PostgreSQL** 13 or higher
- **Redis** 7 or higher (optional for local development without Docker)
- **Docker & Docker Compose** (for containerized setup)
- **Cloudinary Account** (for image storage)
- **Git**

---

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/unknownhimanshu/Real-Time-Chat-.git
cd Real-Time-Chat-
```

### 2. Backend Setup

```bash
cd server

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Edit .env with your configurations
nano .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

### 3. Frontend Setup

```bash
cd ../client

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Edit .env with your configurations
nano .env
```

---

## 🔐 Environment Variables

### Server (.env)

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Settings
CLIENT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Body Size Limit
JSON_BODY_LIMIT=25mb

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Database
DATABASE_URL=postgresql://quickchat:quickchat-secret@localhost:5432/quickchat?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Rate Limiting
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=100

# WebRTC Configuration
RTC_STUN_SERVERS=stun:stun.l.google.com:19302
RTC_TURN_SERVERS=turn:localhost:3478?transport=udp,turn:localhost:3478?transport=tcp
RTC_TURN_USERNAME=quickchat
RTC_TURN_CREDENTIAL=quickchat-secret
```

### Client (.env)

```env
VITE_BACKEND_URL=http://localhost:5000
```

---

## 🚀 Running the Application

### Development Mode (Without Docker)

**Terminal 1 - Backend:**
```bash
cd server
npm run server    # Starts with nodemon for auto-reload
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev       # Starts Vite dev server on http://localhost:5173
```

The application will be available at `http://localhost:5173`

### Production Build

**Backend:**
```bash
cd server
npm run start     # Runs with node
```

**Frontend:**
```bash
cd client
npm run build     # Builds optimized bundle
npm run preview   # Preview production build
```

---

## 🐳 Docker Setup

### Using Docker Compose

```bash
# Start all services (PostgreSQL, Redis, COTURN, Backend, Frontend)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

The application will be available at `http://localhost:5173`

### Services Started:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **COTURN**: localhost:3478

---

## 📡 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/check` | Check authentication status |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/rtc-config` | Get WebRTC config |
| PUT | `/api/auth/profile` | Update user profile |

### Message Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/conversation/:conversationKey` | Get conversation messages |
| POST | `/api/messages` | Send a message |
| PUT | `/api/messages/:messageId` | Edit a message |
| DELETE | `/api/messages/:messageId` | Delete a message |
| POST | `/api/messages/:messageId/delete-for-all` | Delete for everyone |

### Friend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/friends` | Get user's friends |
| GET | `/api/friends/requests` | Get friend requests |
| POST | `/api/friends/request` | Send friend request |
| POST | `/api/friends/accept` | Accept friend request |
| POST | `/api/friends/reject` | Reject friend request |
| DELETE | `/api/friends/:friendId` | Remove friend |

### Group Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | Get user's groups |
| POST | `/api/groups` | Create a new group |
| PUT | `/api/groups/:groupId` | Update group details |
| POST | `/api/groups/:groupId/members` | Add member to group |
| DELETE | `/api/groups/:groupId/members/:userId` | Remove member from group |
| POST | `/api/groups/:inviteToken/join` | Join group via invite token |

---

## 🔌 Socket Events

### Presence Events
- **`presence:online-users`** - List of currently online users
- **`conversation:typing`** - User typing indicator

### Call Events
- **`call:start`** - Initiate a call
- **`call:incoming`** - Incoming call notification
- **`call:answer`** - Call answered
- **`call:answered`** - Call answered confirmation
- **`call:ice-candidate`** - ICE candidate for WebRTC
- **`call:end`** - End call

### Message Events (Handled via REST API)
- Real-time message delivery via Socket.io
- Read receipts and delivery confirmations

---

## 🗄️ Database Schema

### User Model
- Profile information (name, email, bio, profile picture)
- Relationships with friends, groups, and messages
- Authentication credentials

### Message Model
- Message content and metadata
- Sender and receiver information
- Read/delivery status
- Edit and delete history
- Support for personal and group messages

### FriendRequest Model
- Pending friend requests between users
- Request status tracking

### Group Model
- Group details and settings
- Member and admin management
- Group messages and settings

---

## 🎨 UI Components

### Pages
- **LoginPage**: User authentication (signup/login)
- **HomePage**: Main chat interface with conversations and messages
- **ProfilePage**: User profile management

### Components
- **Sidebar**: List of conversations and friends
- **ChatContainer**: Message display and input area
- **RightSidebar**: Group/user information panel
- **CallOverlay**: Video/audio call interface

---

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt for password storage
- **Rate Limiting**: API endpoint rate limiting (100 requests/60s)
- **CORS Protection**: Configurable CORS for frontend origins
- **Secure Cookies**: HttpOnly, Secure, SameSite flags
- **Input Validation**: Server-side validation for all inputs

---

## 📱 Features in Detail

### Real-time Messaging
- Instant message delivery using WebSocket
- Message persistence in database
- Offline message queuing support

### Video/Audio Calls
- WebRTC peer-to-peer communication
- STUN/TURN server support
- Multiple simultaneous calls support

### Presence System
- Real-time online/offline status
- Support for multiple device connections per user
- Automatic reconnection handling

---

## 🚧 Development

### Code Quality
- ESLint for JavaScript code quality
- Vite for fast development builds
- Prisma for type-safe database queries

### Debugging
- Server runs with Nodemon for auto-reload
- Browser DevTools support
- Console logging for socket events

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License.

---

## 📞 Support

For support, please open an issue on the GitHub repository or contact the maintainer.

---

## 🙏 Acknowledgments

- Socket.io for real-time communication
- Prisma for excellent ORM experience
- Tailwind CSS for utility-first styling
- WebRTC for peer-to-peer communication
- React community for amazing tools and libraries

---

## 📚 Resources

- [React Documentation](https://react.dev)
- [Socket.io Documentation](https://socket.io/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [WebRTC Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Made with ❤️ by [unknownhimanshu](https://github.com/unknownhimanshu)**
