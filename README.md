# Emergency Response System

A comprehensive multi-role emergency response management system built with React, Supabase, and modern web technologies.

## 🚀 Features

### Core Workflows
- **Admin Dashboard** - System overview with statistics and quick actions
- **User Management** - Full CRUD operations with ID validation and approval
- **Department Management** - Organize responders by department with hierarchy
- **Report Management** - Accept, decline, and turnover emergency reports
- **Emergency Reporting** - Submit incident reports with images and location
- **Broadcasting System** - Send emergency broadcasts to all users
- **Emergency Contacts** - Manage personal and emergency contacts
- **Notifications** - Real-time system notifications
- **Account Management** - Profile settings, password change, department requests

### User Roles
- **Admin** - Full system management and oversight
- **Dispatcher** - Handle and route emergency reports
- **Responder** - View and respond to assigned incidents
- **Resident/Boarder** - Report emergencies and receive broadcasts

### Technical Features
- **React 18** - Modern React with concurrent features
- **Vite** - Lightning-fast build tool and HMR
- **Supabase** - Backend-as-a-service (auth, database, storage)
- **TailwindCSS** - Utility-first CSS framework
- **React Router v6** - Declarative routing with protected routes
- **Role-Based Access Control** - Secure route protection
- **Geofence Validation** - Location-based access control
- **Performance Optimized** - React.memo, useCallback for efficiency
- **Security Hardened** - localStorage/sessionStorage cleanup, data sanitization

## 📋 Prerequisites

- Node.js (v18.x or higher)
- npm or yarn
- Supabase account (free tier works)

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/adrshawn23/emergency_response_system_8979.git
   cd emergency_response_system_8979-main
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Supabase:**
   - Create a Supabase project at https://supabase.com/dashboard
   - Copy `.env.example` to `.env`
   - Add your Supabase credentials:
     ```
     VITE_SUPABASE_URL=your-supabase-project-url
     VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
     ```

4. **Set up database tables:**
   Run the SQL from `DATABASE_SCHEMA.md` in your Supabase SQL editor to create required tables:
   - `user_profiles`
   - `departments`
   - `emergency_reports`
   - `emergency_contacts`
   - `broadcasts`

5. **Set up storage buckets:**
   Create these buckets in Supabase Storage:
   - `report-images` (public)
   - `id-documents` (private)

6. **Start the development server:**
   ```bash
   npm start
   ```
   The app will be available at http://localhost:4028

## 📁 Project Structure

```
emergency_response_system_8979-main/
├── public/                    # Static assets
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── ui/               # UI components (Button, Input, etc.)
│   │   ├── AppIcon.jsx       # Icon component
│   │   ├── AppImage.jsx      # Image component
│   │   ├── GeofenceGuard.jsx # Location validation
│   │   ├── Header.jsx        # Application header
│   │   └── Sidebar.jsx       # Navigation sidebar
│   ├── contexts/             # React contexts
│   │   └── AuthContext.jsx   # Authentication context
│   ├── lib/                  # Utilities and configurations
│   │   └── supabase.js       # Supabase client
│   ├── pages/                # Page components
│   │   ├── dashboard/        # Dashboard page
│   │   ├── user-management/  # User management
│   │   ├── department-management/ # Department management
│   │   ├── report-management/ # Report management
│   │   ├── emergency-report/ # Emergency report submission
│   │   ├── broadcasting/     # Broadcasting system
│   │   ├── emergency-contacts/ # Emergency contacts
│   │   ├── notifications/    # Notifications
│   │   ├── account-management/ # Account settings
│   │   ├── login/           # Login page
│   │   └── register/        # Registration page
│   ├── services/            # API services
│   │   └── supabaseService.js
│   ├── styles/              # Global styles
│   │   └── tailwind.css
│   ├── App.jsx              # Main application component
│   ├── Routes.jsx           # Application routes
│   └── index.jsx            # Entry point
├── .env.example             # Environment variables template
├── .env                     # Your environment variables (not in git)
├── DATABASE_SCHEMA.md       # Database schema documentation
├── TESTING_GUIDE.md         # End-to-end testing guide
├── PROGRESS.md              # Implementation progress
├── package.json            # Dependencies and scripts
├── tailwind.config.js       # Tailwind CSS configuration
└── vite.config.mjs         # Vite configuration
```

## 🔐 Security Features

- **Role-Based Access Control** - Protected routes for each user role
- **Geofence Validation** - Location-based access restrictions
- **ID Verification** - Document upload and approval workflow
- **Secure Authentication** - Supabase Auth with email verification
- **Data Sanitization** - Input validation and XSS prevention
- **Session Management** - Automatic token refresh and cleanup

## 🧪 Testing

See `TESTING_GUIDE.md` for comprehensive end-to-end testing instructions covering:
- Registration flow
- Login flow
- Admin workflow
- Resident workflow
- Responder workflow
- Dispatcher workflow
- Shared features
- Role-based access control
- Responsive design

## 📦 Deployment

### Build for Production:
```bash
npm run build
```

### Deploy to Vercel:
```bash
npm install -g vercel
vercel
```

### Deploy to Netlify:
```bash
npm run build
# Deploy the `dist` folder
```

### Environment Variables:
Ensure your production environment has:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📊 Database Schema

See `DATABASE_SCHEMA.md` for complete database schema including:
- Table structures
- Relationships
- Indexes
- RLS policies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with React and Vite
- Powered by Supabase
- Styled with Tailwind CSS
- Icons from Lucide React

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

**Status:** ✅ Implementation Complete (100%)
**Version:** 1.0.0
**Last Updated:** September 28, 2026
