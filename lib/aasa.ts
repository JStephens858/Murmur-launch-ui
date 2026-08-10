/**
 * Apple App Site Association — the universal-link and shared-webcredentials
 * declaration for murmurmd.com.
 *
 * Reconciled against what production actually serves — verify with
 *   curl https://app-site-association.cdn-apple.com/a/v1/murmurmd.com
 * rather than against Murmur-express's checked-in file, which has drifted from
 * the deployed copy. Both AASA URLs serve this one object, so the malformed root
 * copy on the old box (three missing commas) stops being a second answer.
 *
 * Changing `paths` breaks universal links in the shipped iOS app, and Apple's
 * CDN caches the response for around a day, so edits here need the iOS team.
 * The three paths correspond to app-handled routes: /invite/*, /post/*, and
 * /user/* — which is why /user/* matters even though it has no server-rendered
 * page. On a device with the app installed, iOS intercepts the URL and the
 * server is never reached.
 */

const APP_ID = "6L582Z5SW6.com.murmurmd.murmur";

/**
 * The dev build of the app also shares webcredentials on this domain.
 *
 * This entry exists nowhere in the Murmur-express repo — the file deployed on
 * the box was hand-edited and never committed. It is only visible in what Apple
 * actually serves:
 *   curl https://app-site-association.cdn-apple.com/a/v1/murmurmd.com
 * Treat that CDN response, not the old repo, as the source of truth for what
 * production currently declares. Dropping this would break password autofill
 * for the dev app.
 */
const DEV_APP_ID = "6L582Z5SW6.com.murmurmd.murmur-dev";

/**
 * Universal-link paths, in the order production lists them.
 *
 * `/app/*` needs a note. It appears only in the root
 * /apple-app-site-association on the old box, which is invalid JSON — three
 * missing commas, one of them immediately before "/app/*" itself. Apple fetches
 * /.well-known/apple-app-site-association, which never had it, and Apple's CDN
 * confirms devices have never been told about it. genAASA.js does not emit it,
 * and nothing in this site, the Express server, or the Apollo backend references
 * a /app/ URL.
 *
 * It is included here at the owner's request. Serving it from valid JSON makes
 * it live for the first time, so expect iOS to begin intercepting
 * murmurmd.com/app/... and handing those URLs to the app. Two things follow:
 * nothing on this site may live under /app/ without app-installed visitors
 * losing it, and if the app has no handler for that path the link may open the
 * app to a default state rather than a web page.
 */
const APP_LINK_PATHS = ["/invite/*", "/post/*", "/user/*", "/app/*"];

export const appleAppSiteAssociation = {
  applinks: {
    apps: [],
    details: [
      {
        appID: APP_ID,
        paths: APP_LINK_PATHS,
        appIDs: [APP_ID],
        components: APP_LINK_PATHS.map((path) => ({ "/": path })),
      },
    ],
  },
  webcredentials: {
    // Order matches what production serves today.
    apps: [APP_ID, DEV_APP_ID],
  },
};
