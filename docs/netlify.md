# Website deployment

Production: https://agent-oscode.netlify.app

The existing Netlify `agent-oscode` project is connected to this repository's
`main` branch. Pushes use the root `netlify.toml`: Node.js 22 builds the static
landing page with `node scripts/build-website.js` and publishes only `site-dist`.
The CLI itself does not run on the website server.

The build copies `website/dist` assets, sets canonical/Open Graph/sitemap URLs
from Netlify's `URL` environment variable, and reads the software version from
`package.json`. Deploy previews use `noindex` and disallow crawling.

To build locally:

```sh
node scripts/build-website.js
```

For an authenticated manual production deployment to the existing project:

```sh
netlify deploy --prod --no-build --dir site-dist --site feacacec-0fcf-4a7c-b7a5-165c8387cb7a
```
