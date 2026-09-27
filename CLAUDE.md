# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The project website for Mechatronics Capstone 2027, Group 27. It's a GitHub Pages user/org site (`<org>.github.io` repo), so whatever is on `main` gets served at https://mechatronics-capstone-2027-group-27.github.io/.

## Structure

- It's a single hand-written static `index.html`. There's no build step, package manager, framework, linter or tests.
- There's no CSS or JS yet. The page uses browser default styling.
- The page is organized as `<section>` blocks inside `<main>`: About, Project, Team, Documentation and Monday. Most of them hold placeholder text, and the team list is still "Team Member 1–4".
- The "Monday" section embeds a monday.com board view through an `<iframe>` (`view.monday.com/embed/...`). The team tracks its project work there, so keep the embed when you restructure the page.

## Development

- **Preview locally:** open `index.html` directly in a browser, or serve the folder (for example `python -m http.server`).
- **Deploy:** push to `main`. GitHub Pages publishes it automatically, so every push to `main` goes live.
- Several team members commit to this repo, so pull before you make changes.

## Rules
- Never run git commit, push, or create branches. I handle all git myself.
- Run the site locally with: npm run dev
- Keep styling in /css, no inline styles.