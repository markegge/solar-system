# Orrery: an interactive 3D solar system

Live: https://markegge.github.io/solar-system/

A static, no-build three.js model of the solar system driven by real data, built to answer questions like *"how long is a day on the Moon?"*

- Sun, 8 planets, Pluto, and the Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Titan and Triton; Saturn's rings
- Planet positions from JPL J2000 Keplerian elements for the simulated date; spin axes from the IAU; retrograde spin for Venus, Uranus, Pluto and Triton
- The Moon from a full lunar theory (astronomy-engine, vendored) with the IAU lunar orientation model: within 0.01° of JPL Horizons and ~2 minutes of USNO new/full moon times, 2020-2030, with real physical libration
- Tidally locked moons, surface markers (the Moon's marks its mean sub-Earth point) and spin axes
- Playback from real time to 10 years per second, in either direction; date picker and "Now"
- Orbit camera (click to follow any body) and free-fly mode (WASD/QE + drag, touch pad on mobile)
- Visible (exaggerated) scale or true scale
- Info panel with sidereal day, **solar day** (1 / (1/sidereal − 1/year)), year, tilt, radius and live distance
- Preset questions that set up the scene and explain the answer

Run locally: `python3 -m http.server` in this directory, then open http://localhost:8000. `node tools/check.mjs` checks the day lengths, and the Moon against JPL Horizons (position, libration) and USNO phase times; reference data is in `tools/reference/`.

## Data sources
- Standish, *Keplerian Elements for Approximate Positions of the Major Planets* (JPL SSD)
- NASA GSFC Planetary and satellite fact sheets
- Archinal et al. 2018, IAU WGCCRE report (pole orientation, prime meridians)
- [astronomy-engine](https://github.com/cosinekitty/astronomy) v2.1.19 (MIT, vendored in `js/vendor/`) for the Moon's position and IAU orientation

## Known limitations
- No shadows or eclipses are rendered.
- Moons other than ours use simple Keplerian orbits in their planet's equatorial plane with illustrative starting positions, so they are not at their real positions on a given date.
- The planetary elements are fitted for 1800 to 2050; outside that range positions are approximate (the app flags this).

## Credits
Planet, Sun, Moon, ring and star textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0 (based on NASA imagery). Smaller moons and Pluto use procedural textures. Rendering: [three.js](https://threejs.org) r170.
