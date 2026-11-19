# Telangana BSE Student PDF Automation

A Node.js-based browser automation tool that automates the generation of student verification sheets from the Telangana Board of Secondary Education (BSE) portal.

## Features

- Opens the official Telangana BSE website.
- Navigates to the SSC School Login portal.
- Supports manual login and persistent browser sessions.
- Automatically navigates to Confirm Student Details.
- Identifies confirmed student records.
- Extracts student PEN numbers.
- Generates individual student verification PDFs named using their PEN.
- Merges all generated student PDFs into one document.

## Tech Stack

- Node.js
- Playwright
- Chromium
- pdf-lib
- dotenv

## Project Structure

```text
Printing-Automate/
├── generate-student-pdfs.js
├── merge-pdfs.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── README.md
├── student-pdfs/       # Generated PDFs
└── browser-profile/    # Persistent browser session
```

## Setup

### 1. Clone the repository

```bash
git clone YOUR_REPOSITORY_URL
cd Printing-Automate
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
BSE_START_URL=https://www.bse.telangana.gov.in/
```

### 4. Generate student PDFs

```bash
node generate-student-pdfs.js
```

The browser opens automatically. Log in manually and press Enter in the terminal once the dashboard is visible.

Generated PDFs are saved in the `student-pdfs/` directory.

### 5. Merge PDFs

```bash
node merge-pdfs.js
```

The merged document is saved as `all-students-merged.pdf`.

## Configuration

The maximum number of students processed per run can be configured in `generate-student-pdfs.js`:

```javascript
const MAX_STUDENTS = 1;
```

Increase this value as required.

## Privacy and Security

- Student records and generated PDFs are not intended to be committed to Git.
- Browser session data and cookies should remain local.
- Never commit school credentials or confidential student information.
- Use this automation only with authorized access to student records.

## Disclaimer

This project is an independent automation utility and is not officially affiliated with the Telangana Board of Secondary Education.