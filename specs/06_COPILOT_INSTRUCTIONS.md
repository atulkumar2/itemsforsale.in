# Copilot Instructions

Follow specs folder strictly.

Do not change tech stack.

Use:

Next.js
TypeScript
Tailwind
Zod
React Hook Form
local-first JSON storage first
Supabase-ready schema and interfaces
Vercel-ready deployment

Steps to generate code:

1. create project structure
2. create local-first data layer and seed data
3. create env template
4. support local-first development before cloud setup
5. create public pages
6. create admin auth
7. create admin dashboard
8. create item CRUD
9. create storage upload support
10. create leads form
11. create contact seller page with captcha
12. add strict frontend+backend validation
13. add CSV export endpoints where needed
14. add tests for validators/captcha logic
15. add error handling
16. add loading states
17. add SEO metadata
18. prepare for Vercel deploy

Rules:

- keep code simple
- no overengineering
- add libraries only when justified and lightweight
- no marketplace features
- no payments
- no buyer accounts
- keep local development usable before Supabase is configured
- keep validation limits centralized in constants
- keep question banks in separate files when content is expected to grow

Output in small steps.
