# Requirements

## Public Pages

### Home page

Show list of items

Fields:

- title
- photos
- expected price
- purchase date
- available from
- status

Features:

- search by title
- filter by status
- filter by category
- switch between grid and table view
- export currently filtered catalogue as CSV
- seller location panel and map embed

---

### Item Detail Page

Show:

- title
- photos
- description
- category
- condition
- purchase date
- purchase price
- expected price
- available from
- location
- status

Include interest form

---

### Interest Form

Fields:

- name
- phone
- email
- message
- bid price

Save to database

No login required

---

### Contact Seller Page

Fields:

- name
- phone
- email
- location
- message
- captcha answer

Captcha requirements:

- simple math or basic India/Karnataka/Bengaluru geography questions
- questions managed from a dedicated question bank file

Validation requirements:

- phone must be exactly 10 digits and start with 6, 7, 8, or 9
- email must match valid regex pattern
- location is required
- field lengths enforced on frontend and backend using shared constants

Behavior:

- submission is stored
- direct contact options shown only after successful captcha verification

## Admin Pages

### Admin Dashboard

- summary cards for item count, leads count, contact submission count
- quick actions for item creation and data review
- inventory section with export catalogue CSV action

### Admin Inventory

- list, edit, and remove items
- support multiple images per listing

### Admin Leads

- view buyer interest form submissions

### Admin Contact Submissions

- view all contact seller submissions
- include location, captcha prompt, and submission timestamp
- export submissions as CSV

## API and Data Export

- `/api/catalogue/export` exports filtered catalogue with item links
- `/api/admin/contact-submissions/export` exports contact submissions log

## Quality and Testing

- unit tests required for captcha validation logic
- unit tests required for contact form schema validation rules
