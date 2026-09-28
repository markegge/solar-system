# Orrery: an interactive 3D solar system

Live: https://markegge.github.io/solar-system/

A static, no-build three.js model of the solar system driven by real data, built to answer questions like *"how long is a day on the Moon?"*

- Sun, 8 planets, Pluto, and the Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Titan and Triton; Saturn's rings
- Planet positions from JPL J2000 Keplerian elements for the simulated date; spin axes from the IAU; retrograde spin for Venus, Uranus, Pluto and Triton
- Tidally locked moons (with libration), surface markers and spin axes
- Playback from real time to 10 years per second, in either direction; date picker and "Now"
- Orbit camera (click to follow any body) and free-fly mode (WASD/QE + drag, touch pad on mobile)
- Visible (exaggerated) scale or true scale
- Info panel with sidereal day, **solar day** (1 / (1/sidereal − 1/year)), year, tilt, radius and live distance
- Preset questions that set up the scene and explain the answer

Run locally: `python3 -m http.server` in this directory, then open http://localhost:8000. `node tools/check.mjs` prints the computed day lengths.

## Data sources
- Standish, *Keplerian Elements for Approximate Positions of the Major Planets* (JPL SSD)
- NASA GSFC Planetary and satellite fact sheets
- Archinal et al. 2018, IAU WGCCRE report (pole orientation, prime meridians)
- Meeus, *Astronomical Algorithms* (lunar mean elements)

## Credits
Planet, Sun, Moon, ring and star textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0 (based on NASA imagery). Smaller moons and Pluto use procedural textures. Rendering: [three.js](https://threejs.org) r170.
