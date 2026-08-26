# External Request Test Visual

A Power BI custom visual used to test how the host handles **external requests** made from inside a visual.

It is a diagnostic tool, not a data visualization: it exercises two independent mechanisms and reports whether each one succeeded or was blocked.

## What it tests

| Mechanism | How it is exercised | Requires `WebAccess`? |
| --- | --- | --- |
| `host.launchUrl()` | Opens a URL in a new browser tab through the host API | No |
| `fetch()` to a **non-whitelisted** host | Direct network request from the visual's iframe | Blocked |
| `fetch()` to a **whitelisted** host | Direct network request, result rendered as an image | Yes |

Custom visuals run in a sandboxed iframe, and the host applies a Content Security Policy derived from the `privileges` section of `capabilities.json`. Only origins listed there can be reached:

```json
"privileges": [
    {
        "name": "WebAccess",
        "essential": true,
        "parameters": ["https://*.thecatapi.com", "https://*.thedogapi.com"]
    }
]
```

Masks are matched against the request **origin** only - the path is not taken into account, and a wildcard covers subdomains but not the bare domain.

## Running locally

```bash
npm install
npm start
```

Then enable developer visual in Power BI Service and add **Developer Visual** to a report. See the [official guide](https://learn.microsoft.com/en-us/power-bi/developer/visuals/environment-setup) for the full setup.

To build a package:

```bash
npm run package
```

## Known limitations

- The image endpoints currently in use serve their images from third-party buckets (`s3.us-west-2.amazonaws.com`, `storage.googleapis.com`) rather than from a subdomain of the API. Those origins are not whitelisted, so the image is blocked by CSP.
- The visual only reports the outcome of the `fetch` call. Assigning `image.src` is synchronous and never throws - an image load failure surfaces as an asynchronous `error` event and is therefore not caught by the surrounding `try/catch`. As a result the visual can report success while displaying nothing.
- The "without Web Access" button targets a host that returns no CORS headers, so its failure does not isolate the `WebAccess` privilege from a plain CORS rejection.

## License

MIT
