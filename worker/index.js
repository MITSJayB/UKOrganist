// Sends every other domain pointed at this Worker (ukorganist.com, jamesrobert.uk,
// organistjames.co.uk and any www. version) to https://jamesrobert.co.uk with the same
// path and query, as a permanent 301. Requests on jamesrobert.co.uk itself are served from
// the built site in dist/ as normal (public/_redirects still handles old WordPress URLs).
// workers.dev and local addresses are left alone so previews keep working.
const CANONICAL = "jamesrobert.co.uk";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;
    const preview = host.endsWith(".workers.dev") || host === "localhost" || host === "127.0.0.1";
    if (host !== CANONICAL && !preview) {
      url.protocol = "https:";
      url.hostname = CANONICAL;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
