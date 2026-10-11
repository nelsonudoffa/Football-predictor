# Football Predictor

Responsive static football prediction app for GitHub Pages.

## Features
- Poisson score model with Dixon–Coles low-score adjustment
- Home/draw/away probabilities, expected goals and likely scorelines
- Over/under 2.5 and both-teams-to-score estimates
- Optional football-data.org standings lookup plus manual inputs
- Chronological backtest with Brier score, training-frequency baseline and calibration table
- Mobile-friendly layout

## Publish
1. Upload `index.html`, `.nojekyll`, and this README to the root of a public repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. Wait for the Pages deployment. The address format is `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## API key safety
The API key is entered in the browser for the current session and is not written to local storage. Requests go directly to football-data.org, so the key is still visible to the browser/device and its network environment. Do not embed a paid or secret production key in a public site. For production, proxy requests through a server-side service and keep the key in a secret. Competition access and rate limits depend on football-data.org.

## Model limitations
Team statistics and a simple goals model cannot account for every relevant factor. Backtest results are sample-dependent and do not guarantee future performance. This app does not place bets.
