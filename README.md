# Fire Danger phone app

A small web app that installs on your home screen. It reads fire danger ratings for Zones 238, 215 and 218 straight from your ArcGIS Online layer. It doesn't load the Dashboards framework, so it opens in about a second, and it keeps the last result so you still see the morning's ratings with no signal.

It costs nothing to run. There's no build step, so every file can be edited as-is.

| File | What it is |
|---|---|
| `config.js` | **The only file you normally edit.** Layer URL, field names, sign-in. |
| `index.html`, `app.js`, `styles.css` | The app itself |
| `manifest.webmanifest`, `icons/` | Home-screen name and icon |
| `sw.js` | Lets the app open offline |

---

## Step 1: Put it online (GitHub Pages, free)

1. Create a free GitHub account if you don't have one, then click **New repository**. Name it `fire-danger`, choose **Public**, and create it.
2. Click **Add file → Upload files** and drag in everything from this folder, including the `icons` folder. Click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**, Branch **main**, folder **/ (root)**, and click **Save**.
4. After a minute your app is at `https://<your-github-name>.github.io/fire-danger/`.

The app starts in **demo mode** with the Nov 18 sample data, so you can install it and try it before turning on sign-in.

Making the repository public only publishes the code. Your fire danger data stays behind ArcGIS sign-in (Step 3), and `config.js` holds no passwords or secrets. If county IT would rather host it, any web server that serves static files over HTTPS works the same way.

## Step 2: The data connection (already set)

`config.js` already points to the **FireRestriction_Zones** item (`0e12da304d034822a1080b76006ded91`) and reads the same v7 **internal** fields as the Fire Management dashboard:

| App shows | Field and rule (same as the dashboard cards) |
|---|---|
| Today's rating | `fdr7_internal_level` |
| What's driving it | `fdr7_internal_drivers` ("-" shows as "Near or below normal") |
| × normal | `fdr7_internal_ratio` |
| Tomorrow, 7-day chart, peak | `fdr7_d1_internal` … `fdr7_d7_internal` (day 1 = tomorrow); peak shows "+N more days" on ties |
| Outlook | Average of today + days 1–2 vs days 5–7: half a level higher = Worsening, half a level lower = Improving, otherwise Stable |
| Snow on fuels | drivers = "snow on fuels" → Snow on fuels; `fdr7_flags` contains it → Snow at some stations |
| Alert banner | NWS first (`rfw_today`, `rfw_day1-3`, `watch_today`, `watch3`, text from `rfw_status_text`), then Chinook from `fdr7_chinook_strength` (STRONG or MODERATE) |
| Stale check | `fdr7_run_ts` older than 30 hours |

If the engine's field names change, edit the `fields` section of `config.js`.

## Step 3: Turn on ArcGIS sign-in (keeps the internal rating private)

The layer holds the internal staff rating, so the app signs in rather than reading a public layer.

1. In ArcGIS Online, go to **Content → New item → Developer credentials → OAuth credentials**. The wording varies a little between ArcGIS Online releases.
2. Add both of these as **redirect URLs**:
   - `https://<your-github-name>.github.io/fire-danger/`
   - `https://<your-github-name>.github.io/fire-danger/index.html`
3. Save, then copy the **Client ID**. It isn't a secret.
4. In `config.js`, set `oauthClientId` to the Client ID, check that `portalUrl` matches the address in your browser when you're signed in to ArcGIS Online, and set `demo: false`. Upload the file again.

When you open the app it asks you to sign in once with your county ArcGIS account. After that it renews the sign-in in the background for about two weeks. When that runs out, you tap **Sign in again**. Anyone who opens the app needs an ArcGIS account that can see the layer.

## Step 4: Install on your phone

- **iPhone:** open the URL in **Safari**, tap **Share → Add to Home Screen**.
- **Android:** open it in **Chrome**, tap **⋮ → Add to Home screen** (or **Install app**).

On iPhone, sign in from the home-screen icon itself, not from Safari. iPhone keeps the installed app's login separate from Safari's.

## Updating the app later

Whenever you change any file other than `config.js`, open `sw.js` and bump `VERSION` (for example `fda-v1.0.1`), then upload both files. Phones pick up the new version the next time the app opens with a signal.

## How it behaves

- **Opening the app:** shows the last saved data right away, then fetches fresh data. It also refreshes when you come back to it after 10 minutes or more, and when you tap the refresh button.
- **Offline or a failed fetch:** you keep seeing the saved data with a yellow note saying when it was saved.
- **Old data:** if a zone's `fdr7_run_ts` is more than 30 hours old, that zone shows "Stale - check engine run" instead of a rating, the same rule as the dashboard. The app never fills in missing values. A blank field shows as "—" or is hidden.
