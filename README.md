# Group 27 Capstone — design log site

Project progress log for University of Waterloo MTE 481/482 (Mechatronics Engineering Capstone Design), Team 27:
*Balloon Lifted High-Altitude Gliding Rocket Launch System*.

**Live site:** https://mechatronics-capstone-2027-group-27.github.io/

## Run it locally

Requires Node 22.18 or newer.

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # production build to dist/, which also validates every log entry
```

## Where things are

| To change… | Edit |
|---|---|
| Team members, project text, links, section order, feature switches | `src/config/site.ts` |
| A work-log entry | `src/content/work-log/<member>/` (see [CONTRIBUTING.md](CONTRIBUTING.md)) |
| A major update | `src/content/updates/` |
| Timeline milestones | `src/data/timeline.json` |
| Colours, fonts, spacing | `src/styles/tokens.css` |
| Site images (hero, portraits, logo) | replace the file in `src/assets/img/` with one of the same name |

Posting instructions for team members are in [CONTRIBUTING.md](CONTRIBUTING.md). The site is built with
[Astro](https://astro.build) and deployed to GitHub Pages by `.github/workflows/deploy.yml`.
