**DEPRECATED** I did a thing and ported this all into scala.js, it now lives here:
https://github.com/Chandler/orbits-scala

Visualize Planet Lab's satellites using [TLE orbital projections](https://en.wikipedia.org/wiki/Two-line_element_set)

**DEMO:** http://hipsterdatascience.com/satellites

So far it includes Planet Labs Flock E and C, which are colored differently to highlight the different orbits
http://spaceflight101.com/flock/

TLE data comes from from https://www.space-track.org

Projection calculations are from the amazing: https://github.com/shashwatak/satellite-js

3D earth modeling inspired by: http://blog.thematicmapping.org/2013/09/creating-webgl-earth-with-threejs.html

The sun calculations are a work in progress, right now the sun moves around the earth perfectly above the equator, which is good enough to highlight the sun syncronous orbits at least.
