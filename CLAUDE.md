# Signalog

## What This Is

A crowdsourced mobile app that maps real-world signal strength and dead zones.

## Tech Stack

- React Native (Android-first)
- Node.js (Express)
- MongoDB
- Mapbox

## MVP Scope

- Background signal logging
- Map visualization
- Manual reporting
- Offline logging

## Commands

npx react-native run-android

## Architecture Rules

- Feature-based structure
- No API logic in components
- Use hooks for logic
- Use services for signal, location, and API

## Important

Follow universal-build-discipline.md before building any feature.

Do NOT:

- Over-engineer
- Add login/auth yet
- Skip planning phase
