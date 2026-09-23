# second — Neon Coast

An original Vice City-inspired, top-down arcade driving prototype built with native JavaScript modules and HTML Canvas. No dependencies, external assets, build step, account or network services are required to play once served locally.

This is a small original game, not a recreation of GTA Vice City. It contains no Rockstar assets, characters, map, music or story. It is not affiliated with Rockstar Games.

## Run locally

Requires Git and Python 3 for these setup commands. Use a modern browser with Canvas, ES modules and Pointer Events support.

```sh
git clone --branch feature/neon-coast https://github.com/truelifevillage2/second.git
cd second
python3 -m http.server 8000 --bind 127.0.0.1
```

On Windows, use `py -m http.server 8000 --bind 127.0.0.1` if `python3` is unavailable.

Open **http://localhost:8000** and choose **Hit the streets**. Do not open `index.html` using a `file://` URL: browsers generally block module imports that way. Any static HTTP server that correctly serves `.mjs` as JavaScript also works.

## Gameplay

Complete three delivery contracts before the timer runs out. Stop inside a cyan pickup beacon for 0.6 seconds to load cargo, then stop inside the pink delivery beacon to unload. Every delivery pays cash, adds 45 seconds and restores 18 vehicle-health points.

Traffic collisions and sustained high-speed driving raise wanted heat. Police navigate the street grid toward your position. Get away from nearby patrols and drive below the speeding threshold to cool down. Delivery requires heat below 0.5; the HUD indicates when you are clear. Vehicle destruction or an expired timer ends the run. Completing all contracts wins.

| Feature | Implementation |
| --- | --- |
| City | Original 2,240 × 2,240-unit street grid with neon rooftops, palms and coast |
| Driving | Acceleration, reverse, steering, friction and handbrake |
| Traffic | 32 deterministic AI vehicles with collision damage |
| Police | Up to three grid-following patrol cars and decaying wanted heat |
| Contracts | Three timed pickup-and-delivery missions |
| Navigation | Desktop minimap, route hint, objective distance and on-screen direction arrow |
| Interface | Speedometer, health, timer, wanted level and earnings |
| Mobile | Multitouch steering, accelerator, reverse and brake buttons |
| Session | Pause, restart and automatic pause on blur or tab hiding |
| Records | Optional localStorage personal-best earnings; storage failures are tolerated |

The minimap is hidden on touch devices and short screens to preserve driving space; beacons, direction arrows and objective distance remain available. The route line is a grid hint, not turn-by-turn navigation.

## Controls

| Action | Keyboard or input |
| --- | --- |
| Accelerate | W / Up arrow |
| Reverse or slow forward motion | S / Down arrow |
| Steer left | A / Left arrow |
| Steer right | D / Right arrow |
| Handbrake | Space |
| Pause / resume | P / Escape / Pause button |
| Restart run | R / Restart button |
| Mobile driving | Hold the on-screen controls; steering and acceleration support simultaneous touches |

Steering requires movement. Keep some speed through corners, and brake before stopping inside an objective.

## Tests and validation

The dependency-free tests use **Node.js 20+** and its built-in test runner:

```sh
node --check game.mjs
node --check tests/game.test.mjs
node --test tests/game.test.mjs
```

The 16 tests cover road boundaries, clamping, nearest intersections, deterministic independent state, acceleration, braking, building collisions, timestep validation, bounded simulation updates, pickup, delivery rewards and repair, wanted-level delivery lockout, mission completion, loss conditions, terminal-state immutability and fixed-step accumulation.

**Validation status at implementation:** these commands and browser smoke tests have not been run in the authoring session. Committing tests does not establish that they pass. No lint configuration, TypeScript configuration or CI workflow is included in the original repository or added by this change. Syntax checks are not a replacement for lint or type-checking. Run the commands above and the smoke checks below before treating this prototype as validated.

| Manual check | Expected result |
| --- | --- |
| Start through a local HTTP server | Intro loads without module or console errors |
| Drive and brake | Car responds; speed falls with handbrake |
| Drive into a block | Car stays outside buildings and takes damage |
| Stop at both mission beacons | Pickup loads; delivery pays and repairs |
| Gain wanted heat | Patrols appear and delivery is blocked until heat cools |
| Hide the browser tab | Game pauses without stuck input |
| Complete all contracts | Results screen displays earnings |
| Let timer expire or lose all health | Appropriate loss screen displays |
| Restart a run | Timer, health, missions and heat reset |
| Mobile portrait and landscape | Touch inputs work simultaneously; HUD does not block driving controls |
| Disable persistent storage | Game remains playable without saved records |

## File layout

| Path | Purpose |
| --- | --- |
| `index.html` | Responsive game UI, CSS and module entry point |
| `game.mjs` | Pure exported simulation and DOM-guarded Canvas renderer |
| `tests/game.test.mjs` | Built-in Node gameplay tests |
| `README.md` | Setup, gameplay and validation guidance |

Simulation uses fixed 60 Hz steps and caps catch-up time to avoid huge jumps after stalls. Seeded traffic supports repeatable tests. Exported simulation functions can be imported in Node without accessing browser globals. No existing public API or deployment is replaced; the original repository contained only its title README.

## Deployment and limitations

Serve `index.html` and `game.mjs` from the same directory on any static host with JavaScript module MIME support. There are no secrets, environment variables or migrations. This change is on `feature/neon-coast`; `main` is not modified. Hosting, GitHub Pages configuration, a pull request and merging are not performed automatically.

This is a 2D single-player prototype, not a full 3D open-world game. There is no walking, combat, multiplayer, audio or saved mission progress. Best earnings are saved locally when a run ends or restarts. Some graphics continue animating while simulation is paused. Gameplay is visual and is not fully screen-reader accessible, although controls and status elements have text labels.
