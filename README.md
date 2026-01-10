# Visual Bridge Assistance

A React application built with Vite, TypeScript, and Google Gemini API.

## Project Setup

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
To start the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:3000` (or the port shown in your terminal).

## Deployment

This project uses **GitHub Actions** to deploy to **GitHub Pages**.

### How it works
On every push to the `main` or `master` branch, the workflow `.github/workflows/deploy.yml` will:
1. Install dependencies.
2. Build the project.
3. Deploy the `dist` folder to the `gh-pages` branch.

### Initial Setup for GitHub Pages
1. Go to your repository **Settings**.
2. Navigate to **Pages** (on the left sidebar).
3. Under **Source**, select **Deploy from a branch**.
4. Select `gh-pages` branch and `/ (root)` folder (Note: The `gh-pages` branch will be created after the first successful Action run).
5. Click **Save**.

## Configuration
- **Vite Config**: `vite.config.ts` is configured with `base: './'` for relative path deployment, ensuring it works on any subdirectory.
- **Environment Variables**: Create a `.env` file for secrets like `GEMINI_API_KEY`. (Note: This file is git-ignored).
