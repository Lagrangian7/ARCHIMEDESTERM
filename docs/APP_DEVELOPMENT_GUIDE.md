
# Modern App Development Guide - ARCHIMEDES Workshop

## Philosophy
Build production-ready, maintainable applications that are easy to deploy and scale.

## Project Structure Standards

### Frontend-Only Apps (Static)
```
my-app/
├── index.html              # Entry point
├── css/
│   ├── main.css           # Core styles
│   ├── components.css     # Component-specific styles
│   └── responsive.css     # Media queries
├── js/
│   ├── main.js            # App initialization
│   ├── components/        # Reusable components
│   │   ├── header.js
│   │   ├── navigation.js
│   │   └── footer.js
│   ├── utils/             # Helper functions
│   │   ├── api.js
│   │   └── validators.js
│   └── config.js          # Configuration
├── assets/
│   ├── images/
│   ├── fonts/
│   └── icons/
├── package.json           # Dependencies
├── README.md             # Documentation
└── .gitignore            # Git ignore rules
```

### Full-Stack Apps (Frontend + Backend)
```
my-app/
├── client/                # Frontend code
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
├── server/                # Backend code
│   ├── index.js          # Server entry point
│   ├── routes/           # API routes
│   │   ├── users.js
│   │   └── posts.js
│   ├── middleware/       # Express middleware
│   │   ├── auth.js
│   │   └── validation.js
│   ├── models/           # Data models
│   ├── config/           # Server config
│   │   └── db.js
│   └── package.json      # Backend dependencies
├── package.json          # Root dependencies
├── README.md
├── .env.example          # Environment template
└── .gitignore
```

### React/Vue Apps
```
my-app/
├── public/               # Static assets
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/       # React/Vue components
│   │   ├── Header.jsx
│   │   ├── Footer.jsx
│   │   └── common/      # Shared components
│   ├── pages/           # Page components
│   │   ├── Home.jsx
│   │   └── About.jsx
│   ├── hooks/           # Custom hooks (React)
│   ├── services/        # API services
│   │   └── api.js
│   ├── utils/           # Helper functions
│   ├── styles/          # Global styles
│   │   └── globals.css
│   ├── App.jsx          # Root component
│   └── main.jsx         # Entry point
├── package.json
├── vite.config.js       # Vite config
├── README.md
└── .env.example
```

## Code Quality Standards

### 1. Modern JavaScript (ES6+)
```javascript
// ✅ GOOD - Modern, clean code
const API_URL = 'https://api.example.com';

const fetchUserData = async (userId) => {
  try {
    const response = await fetch(`${API_URL}/users/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

// ❌ BAD - Old-style code
var API_URL = 'https://api.example.com';
function fetchUserData(userId, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API_URL + '/users/' + userId);
  xhr.onload = function() {
    callback(null, JSON.parse(xhr.responseText));
  };
  xhr.send();
}
```

### 2. Semantic HTML5
```html
<!-- ✅ GOOD - Semantic, accessible -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="#home">Home</a></li>
      <li><a href="#about">About</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Article Title</h1>
    <p>Content goes here...</p>
  </article>
</main>

<footer>
  <p>&copy; 2024 Company Name</p>
</footer>

<!-- ❌ BAD - Non-semantic divs everywhere -->
<div class="header">
  <div class="nav">
    <div class="menu">...</div>
  </div>
</div>
```

### 3. Modern CSS (Flexbox/Grid)
```css
/* ✅ GOOD - Modern CSS with CSS variables */
:root {
  --primary-color: #007bff;
  --spacing-unit: 8px;
  --max-width: 1200px;
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: calc(var(--spacing-unit) * 2);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-unit);
}

/* Mobile-first responsive */
@media (max-width: 768px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
```

### 4. Component-Based Architecture
```javascript
// ✅ GOOD - Reusable component
class Card {
  constructor(title, content, imageUrl) {
    this.title = title;
    this.content = content;
    this.imageUrl = imageUrl;
  }

  render() {
    return `
      <article class="card">
        <img src="${this.imageUrl}" alt="${this.title}">
        <h2>${this.title}</h2>
        <p>${this.content}</p>
      </article>
    `;
  }
}

// Usage
const myCard = new Card('Title', 'Content', 'image.jpg');
document.getElementById('cards').innerHTML += myCard.render();
```

## Backend Best Practices

### 1. Express.js Server Structure
```javascript
// server/index.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
import userRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON
app.use(express.static('public')); // Serve static files

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

### 2. Environment Variables
```bash
# .env.example
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
JWT_SECRET=your-secret-key-change-this
API_KEY=your-api-key-here
```

## README Template

```markdown
# Project Name

Brief description of what this app does.

## Features

- Feature 1
- Feature 2
- Feature 3

## Tech Stack

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- [Framework if used: React, Vue, etc.]
- [UI Library if used: Tailwind, Bootstrap]

**Backend (if applicable):**
- Node.js + Express
- PostgreSQL/MongoDB
- JWT Authentication

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/project-name.git
   cd project-name
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. (If using database) Run migrations:
   ```bash
   npm run migrate
   ```

## Running Locally

### Frontend Only
Simply open `index.html` in your browser, or use a development server:
```bash
npm run dev
```

### Full Stack
```bash
# Start backend
cd server
npm start

# In another terminal, start frontend
cd client
npm run dev
```

## Deployment

### Replit (Recommended)
1. Import this repository to Replit
2. Add environment variables in Secrets tab
3. Click "Run" or "Deploy"

### Other Platforms
- **Vercel/Netlify**: For frontend-only apps
- **Railway/Render**: For full-stack apps with backend

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT tokens | Yes |
| `API_KEY` | External API key | No |

## API Documentation

### Endpoints

#### GET /api/users
Returns list of users.

**Response:**
```json
{
  "users": [
    { "id": 1, "name": "John Doe", "email": "john@example.com" }
  ]
}
```

## License

MIT

## Contact

Your Name - your.email@example.com
```

## Package.json Templates

### Frontend (Vanilla JS + Vite)
```json
{
  "name": "my-frontend-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  },
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

### Frontend (React + Vite)
```json
{
  "name": "my-react-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
```

### Backend (Express)
```json
{
  "name": "my-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.3.0",
    "pg": "^8.11.0",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

## Deployment Checklist

- [ ] All files organized in logical folders
- [ ] README.md with complete setup instructions
- [ ] .env.example with all required variables
- [ ] .gitignore includes node_modules, .env, dist
- [ ] package.json has all dependencies listed
- [ ] Code is well-commented
- [ ] No hardcoded secrets or API keys
- [ ] Error handling implemented
- [ ] Responsive design tested
- [ ] Works on mobile devices

## Common Pitfalls to Avoid

1. **Don't dump everything in one file** - Split into logical components
2. **Don't use var** - Use const/let
3. **Don't ignore errors** - Always handle errors properly
4. **Don't hardcode values** - Use environment variables
5. **Don't skip comments** - Explain complex logic
6. **Don't forget mobile** - Test responsive design
7. **Don't skip README** - Document everything
8. **Don't use inline styles** - Keep CSS separate
9. **Don't forget accessibility** - Use semantic HTML, ARIA labels
10. **Don't skip validation** - Validate all user inputs

## Quick Start Templates

When I generate apps for you, I'll follow this structure:

1. **File-by-file listing** with full code for each file
2. **Clear folder structure** 
3. **Complete package.json** with all dependencies
4. **Detailed README.md** with setup steps
5. **Environment template** (.env.example)
6. **Modern best practices** (ES6+, semantic HTML, responsive CSS)
7. **No internationalization** unless requested

Just tell me what app you want to build, and I'll generate the complete project structure!
