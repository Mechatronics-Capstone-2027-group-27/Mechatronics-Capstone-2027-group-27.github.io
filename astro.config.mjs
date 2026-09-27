// @ts-check
import { defineConfig } from 'astro/config';

// User/org GitHub Pages site: served from the domain root, so base is '/'.
export default defineConfig({
  site: 'https://mechatronics-capstone-2027-group-27.github.io',
  base: '/',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
