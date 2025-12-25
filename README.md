# oura-workout-tcx
This is a Node.js app for converting a Oura workout to a TCX file.  It uses the Oura API to get workout and heart rate data, then converts it into a valid TCX file.  The resulting file can be imported into apps like Strava.

## Getting Started
Follow the Oura Authentication docs to get an OAuth token: https://cloud.ouraring.com/docs/authentication

(Optional) Set the `OURA_OAUTH_TOKEN` environment variable

Run `npm start` to begin the process

## TODOs
- [x] Working MVP
- [ ] Chrome extension for cloud.ouraring.com

## Links
- https://cloud.ouraring.com/v2/docs
