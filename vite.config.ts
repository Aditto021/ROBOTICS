import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages serves this repo at /ROBOTICS/, not the domain root, so
// asset paths need that prefix there. Netlify and local dev serve from
// root, so this only changes when the GH Pages workflow sets the flag.
const isGithubPages = process.env.GITHUB_PAGES === 'true'

// https://vite.dev/config/
export default defineConfig({
  base: isGithubPages ? '/ROBOTICS/' : '/',
  plugins: [react(), tailwindcss()],
})
