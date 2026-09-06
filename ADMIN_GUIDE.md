# Manara Academy — Admin & Teacher Guide

Sign in at `/login` with a teacher or admin account, then open `/admin`.

## Roles

- **Teacher (Content Admin)** — curriculum builder and blog CMS.
- **Super Admin** — everything teachers can do, plus analytics and user management.

## Curriculum management (`/admin/curriculum`)

- **Subjects** — create subjects with Arabic/English names, icon and color.
- **Units** — belong to a subject and one age band (`explorers` 4–7, `builders` 8–11, `achievers` 12–15, `graduates` 16–18). Units start as `draft`; only `published` units appear to families.
- **Lessons** — belong to a unit: bilingual title/description, video (YouTube/Vimeo/MP4 URL), duration, position, `isFreeSample` flag (free samples appear on the public curriculum page), and exercises.
- **Exercises** — 4 auto-graded types: `multiple_choice`, `matching`, `fill_blank`, `picture_select`. Options are stored as a string list; `correctAnswer` must match one option (matching uses `pair1|pair2|...`).

## Analytics (`/admin`)

- MRR (SAR), active/trialing subscriptions, trial conversion rate, churn rate
- Total parents/children, daily active children
- Top lessons by completions with average scores

## User management (`/admin/users`, super admin only)

- Search by name or email
- Extend a family's trial by N days
- Change subscription status (e.g. mark `past_due`, reactivate)

## Blog (`/admin/blog`)

Create Arabic posts (slug, title, excerpt, content). Published immediately at `/blog/<slug>`.

## Safety & privacy operations

- Child profiles store only: name, avatar, birth month/year, PIN. No email, no chat, no external links in child screens.
- Exiting a child session requires the parent PIN (parent gate).
- Parents can file data-deletion requests from settings; they are stored in `data_deletion_requests` for processing within 30 days.
