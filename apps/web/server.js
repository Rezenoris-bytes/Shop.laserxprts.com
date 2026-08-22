// Passenger (Hostinger's Node.js App feature) requires an entry file it can
// `require()` directly, that binds itself to the port Passenger assigns via
// process.env.PORT — `next start` is a CLI command, not requireable, and
// ignores PORT. This wrapper boots Next programmatically instead. Only used
// for the Passenger-managed production path; `npm start` / `npm run dev`
// remain unaffected for local/manual use.
const { createServer } = require('http');
const next = require('next');

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, '0.0.0.0', () => {
      // eslint-disable-next-line no-console
      console.log(`LEI web listening on port ${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('LEI web failed to start:', error);
    process.exit(1);
  });
