# External Request Test Visual

A Power BI custom visual used to test how the host handles **external requests** made from inside a visual.

It is a diagnostic tool, not a data visualization: it exercises three independent mechanisms and reports the outcome of each step separately.

## What it tests

| Button | What it does | Expected outcome |
| --- | --- | --- |
| **Launch URL** | Calls `host.launchUrl()` with the [launchUrl docs page](https://learn.microsoft.com/en-us/power-bi/developer/visuals/launch-url) | ✔ Power BI shows its own confirmation dialog; a new browser tab opens once you accept it. The host API is used, so no `WebAccess` privilege is involved |
| **WITHOUT Web Access** | `fetch()` to `https://api.thecatapi.com/v1/images/search` - a **CORS-enabled** host that is deliberately **not** in the whitelist | ✔ *Blocked as expected*. The endpoint sends `Access-Control-Allow-Origin: *`, so a failure can only come from the `WebAccess` CSP policy, not from CORS |
| **WITH Web Access** | `fetch()` to `https://dog.ceo/api/breeds/image/random`, then loads the returned image from `https://images.dog.ceo/...` | ✔ Two green lines: *API request succeeded* and *Image loaded* |

The **WITH Web Access** button reports the API call and the image load as two separate results, because they are two separate network requests and either one can be blocked on its own:

| Reported outcome | Meaning |
| --- | --- |
| ✘ `API request failed - request rejected (CSP or network)` | The `fetch` never reached the server: blocked by the `WebAccess` policy, or the network is down |
| ✘ `API request failed - HTTP <status>` | The server answered with an error status. `WebAccess` is working; the API is not |
| ✘ `API request failed - response is not valid JSON` / `unexpected response shape` | The request went through, but the API changed its contract |
| ✔ `API request succeeded` + ✘ `Image blocked` | The whitelist covers the API origin but **not** the origin the image is served from |
| ✔ `API request succeeded` + ✔ `Image loaded` | Everything works |

Use the **Breed** setting in the format pane to switch between a random image and a specific breed (`https://dog.ceo/api/breed/{breed}/images/random`). Both endpoints live on the same origin, so the whitelist is unaffected.

## Why dog.ceo

Custom visuals run in a sandboxed iframe, and the host applies a Content Security Policy derived from the `privileges` section of `capabilities.json`. Only origins listed there can be reached:

```json
"privileges": [
    {
        "name": "WebAccess",
        "essential": true,
        "parameters": ["https://dog.ceo", "https://*.dog.ceo"]
    }
]
```

Masks are matched against the request **origin** only - the path is not taken into account, and a wildcard covers subdomains but not the bare domain. Both entries are therefore required: `https://*.dog.ceo` covers `images.dog.ceo`, while `https://dog.ceo` covers the API itself.

The visual previously used the Cat/Dog APIs, which moved their images to third-party buckets (`s3.us-west-2.amazonaws.com`, `storage.googleapis.com`). The old subdomain survived only as a path segment, so the whitelist no longer covered the image request. `dog.ceo` serves images from a subdomain of the API's own domain, which makes that class of CDN migration structurally impossible.

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

## How to verify

Each scenario can be reproduced by hand. This is the visual's primary purpose: a misconfigured whitelist must produce a **distinct, clearly identifiable message**, never a silent success.

1. **Happy path.** Click **WITH Web Access**. Both status lines turn green and an image appears. Click again - the previous result is cleared while the request is in flight, so what you see always belongs to the latest click.
2. **Image origin not whitelisted.** Remove `"https://*.dog.ceo"` from `parameters` in [capabilities.json](capabilities.json), restart, and click **WITH Web Access**. Expected: ✔ *API request succeeded* followed by ✘ *Image blocked*. Reporting ✔ alone here would be the regression this visual exists to catch.
3. **API origin not whitelisted.** Remove `"https://dog.ceo"` instead. Expected: ✘ *API request failed - request rejected (CSP or network)*, and no image request at all.
4. **Privilege vs. CORS.** Click **WITHOUT Web Access**. It must report *Blocked as expected*. Since that endpoint returns `Access-Control-Allow-Origin: *`, a success here would mean the `WebAccess` policy is not being enforced. Confirm the CORS headers of any replacement URL with an explicit `Origin` header - many servers stay silent without one:

   ```bash
   curl -s -o /dev/null -D - -H "Origin: https://example.com" https://api.thecatapi.com/v1/images/search
   ```
5. **launchUrl.** Click **Launch URL**. Power BI asks for confirmation before leaving the report; accept it and a new tab must open. The host API is not affected by the `WebAccess` whitelist.

## Known limitations

- The **Launch URL** button reports that `host.launchUrl()` was called, not that a tab actually opened - the host API returns no result and the user still has to accept Power BI's confirmation dialog, so the outcome has to be confirmed visually.
- The behaviour of `"essential": true` when the `WebAccess` privilege is denied (tenant switch off) is not documented in detail and has not been measured yet. Comparing rendering with `true` and `false` under a disabled tenant switch, and recording the result here, is still open.
- The visual declares no data roles, so `pbiviz package` reports it as not supporting the recommended *Landing Page* feature. This is expected for a diagnostic visual that renders without data.

## License

MIT
