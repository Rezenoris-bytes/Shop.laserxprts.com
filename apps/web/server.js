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

// Phusion Passenger (Hostinger) requires listen() to be called within 3 seconds.
// Next.js prepare() can take longer than 3 seconds on shared hosting CPUs.
// We must start the HTTP server immediately to satisfy the timeout, then boot Next.
let appHandler = null;

const server = createServer(async (req, res) => {
  if (appHandler) {
    try {
      await appHandler(req, res);
    } catch (err) {
      console.error('Error handling request', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  } else {
    // If requests come in during the 5-15 seconds Next.js is still booting:
    res.statusCode = 503;
    res.setHeader('Retry-After', '5');
    res.end('Server is starting up. Please refresh in a few seconds.');
  }
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`LEI web early listener started on port ${port}`);
});

app
  .prepare()
  .then(() => {
    appHandler = handle;
    // eslint-disable-next-line no-console
    console.log(`LEI web fully ready and handling requests on port ${port}`);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('LEI web failed to start:', error);
    process.exit(1);
  });
