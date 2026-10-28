---
title: "Two-Dimensional Point Particle Dynamics Simulation"
date: 2026-10-27
author: david-makarczyk
collaborators: []
timeCommitted: 3
images:
  - src: /img/work-log/2026-10-27-david-makarczyk-i22-1.png
    alt: "Photo for \"Two-Dimensional Point Particle Dynamics Simulation\""
# Posted from issue #22 by @DavidM2004
draft: false
---

## What I worked on
As suggested in the meeting with Prof. Devaud, a good starting point for the glider design is an analytical two-dimensional simulation based on Newton's laws. Assuming the glider is a point particle, based on the previously derived equations, I implemented an ODE-solver in MATLAB to give the trajectory of the glider based on wing parameters.

## Results
- Glide ratio can be computed as a function of starting altitude and wing size. 
- Assuming no control inputs, flight path is oscillatory before reaching steady-state terminal velocity.
- The simulation computes in real time the density of the air surrounding the glider, which is then substituted into the lift model.
- A major drawback of the existing simulation is that it assumes the glider is a point particle, meaning that the angle of attack is always assumed to be zero.
- Lift and drag coefficients are currently assumed constant, based on a single run of XFOIL for the chosen airfoil.

## Next steps
- Separate center of pressure and center of mass to account for angle of attack and pitching of the airframe
- XFOIL runs are slow, create a lookup table with precomputed results of XFOIL runs for lift and drag coefficients for improved performance
- Calculate Reynolds number, Mach number in real time at each timestep
- Identify stall conditions
