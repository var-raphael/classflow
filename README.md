# ClassFlow

> A full stack assignment management platform for teachers and students — built with Next.js, TypeScript, and Supabase.

![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0+-06B6D4?style=flat-square&logo=tailwindcss)

---

## Overview

ClassFlow is a production-ready assignment management system that streamlines how teachers create, distribute, and grade assignments — and how students submit work and track their academic progress. Built with a modern full stack architecture and a clean role-based UI for both teachers and students.

---

## Features

### Teacher
- Create rich assignments with a WYSIWYG editor (TipTap) and file attachments
- Manage student roster by email — add or remove students
- View real-time submission stats per assignment
- Grade submissions with scores and written feedback
- Filter assignments by status — Active, Draft, Closed, Overdue
- Edit or delete existing assignments

### Student
- View all assigned work with due date countdowns
- Submit assignments with text editor and file uploads
- Save submissions as drafts before final submission
- Track grades, trends, and class ranking on a visual dashboard
- Filter assignments by status — Pending, Submitted, Graded, Overdue

### Shared
- Google OAuth authentication
- Role-based routing and access control
- Light and dark mode
- Responsive design for mobile and desktop
- Real-time data from Supabase

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + Google OAuth |
| Storage | Supabase Storage |
| Styling | TailwindCSS |
| Editor | TipTap (WYSIWYG) |
| Charts | Recharts |

---

## Project Structure

```
classflow/
├── app/
│   ├── auth/                        # Google OAuth sign in
│   ├── teacher/
│   │   ├── dashboard/               # Teacher overview + stats
│   │   ├── students/                # Student roster management
│   │   ├── assignments/             # Assignment list + filters
│   │   ├── assignment-create/       # Create + edit assignments
│   │   └── grading/                 # Grade student submissions
│   ├── student/
│   │   ├── dashboard/               # Student stats + charts
│   │   ├── assignments/             # Assignment list
│   │   │   └── [id]/                # View + submit assignment
│   │   └── grades/                  # Grade history + trends
│   └── page.tsx                     # Landing page
├── components/
│   ├── AuthContext.tsx              # Global auth state
│   ├── ProtectedRoute.tsx           # Role-based route guard
│   ├── TeacherSidebar.tsx           # Teacher navigation
│   └── StudentSidebar.tsx           # Student navigation
├── lib/
│   └── supabaseClient.ts            # Supabase client instance
└── hooks/
    └── useAuth.ts                   # Auth hook
```

---

## Database Schema

```
profiles              — User accounts (id, email, full_name, role, avatar_url)
teacher_students      — Teacher to student relationships
assignments           — Assignment details (title, description, due_date, status)
assignment_students   — Assignment to student mapping
assignment_attachments — Teacher uploaded files
submissions           — Student submissions (content, grade, submitted_at)
submission_attachments — Student uploaded files
comments              — Discussion threads on assignments
```

### Storage Buckets
- `assignment-files` — Teacher attachments
- `submission-files` — Student submission files

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project
- Google OAuth credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/classflow.git
cd classflow

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.local` file in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

Run the SQL schema file against your Supabase project:

```bash
# In your Supabase SQL editor, run:
classflow-complete-schema.sql
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Auth Flow

1. User visits `/auth` and selects their role — Teacher or Student
2. Signs in with Google OAuth via Supabase
3. A profile is auto-created in the `profiles` table on first sign in
4. User is redirected to their role-specific dashboard

---

## Screenshots

> Coming soon

---

## Roadmap

- [ ] Real-time notifications with Supabase subscriptions
- [ ] Email notifications for new assignments and grades
- [ ] Mobile app (React Native)
- [ ] Bulk student import via CSV
- [ ] Assignment analytics per class

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Author

Built by [RAPHAEL](https://phantomm-portfolio.vercel.app) — 18 year old full stack developer from Nigeria.

> Open to full stack and backend remote opportunities. Reach out via [samuelraphael925@gmail.com] or [LinkedIn].
