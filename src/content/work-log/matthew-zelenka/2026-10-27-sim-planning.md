---
title: "Flight Simulation Meeting"
date: 2026-10-27
author: matthew-zelenka
collaborators: [david-makarczyk]
timeCommitted: 1.0
tags: [Simulation]
draft: false
---

## Current State

[David](https://mechatronics-capstone-2027-group-27.github.io/work-log/david-makarczyk/) has developed a MATLAB script that simulates flight using Newtonian physics with constant lift and drag coefficients. The simulation currently has the following limitations:

- **2D simulation:** Flight is simulated in two dimensions only.
- **Point-mass aircraft model:** The aircraft is represented as a single point, without modelling its physical dimensions or rotational dynamics.
- **Fixed flight orientation:** The wings are assumed to always point in the direction of the velocity vector.
- **Constant aerodynamic coefficients:** Lift and drag coefficients remain constant throughout the simulation.

The next step is to integrate [XFOIL](https://web.mit.edu/drela/Public/web/xfoil/) to calculate lift and drag coefficients for the selected airfoil under the relevant flight conditions.

## Performance Challenges

Integrating XFOIL directly into the simulation introduces a significant performance bottleneck. Running aerodynamic calculations during each simulation step causes execution time to increase substantially.

The goal is to achieve a simulation that runs in real time or, ideally, faster than real time. This is important for testing flight controls and developing the control algorithms required for the aiming manoeuvre.

Focusing exclusively on aircraft body development and physical testing, without progressing the software and control systems in parallel, risks putting the project behind schedule.

### Proposed Solution: Precompute Aerodynamic Data

Rather than running XFOIL during every simulation step, the required aerodynamic data will be precomputed and stored in lookup tables.

The simulation can then use linear interpolation to estimate lift and drag coefficients for the current flight conditions.

This approach should significantly reduce computational overhead while retaining sufficient aerodynamic accuracy for simulation and control development.

## Improving the XFOIL Wrapper

The current programmatic interface to XFOIL introduces unnecessary overhead for every calculation. Its current workflow is approximately:

1. Write calculation inputs to disk.
2. Launch a new XFOIL process.
3. Initialise the program and its GUI.
4. Perform the aerodynamic calculation.
5. Write the results to disk.
6. Open and process the output files to extract the required data.

Repeatedly performing these operations makes the interface inefficient, particularly when generating large amounts of aerodynamic data.

### Proposed Improvements

Develop a small Java library to provide a more efficient programmatic interface to XFOIL.

The primary goals are:

- **Persistent XFOIL process:** Launch XFOIL once and keep the subprocess alive across multiple calculations.
- **Inter-process communication (IPC):** Prefer standard input and output pipes to communicate with XFOIL and avoid unnecessary disk operations.
- **Reduced file I/O:** If pipes prove impractical, investigate memory-backed files or other alternatives that minimise disk access.
- **Headless operation:** Disable the GUI wherever possible to avoid unnecessary graphical overhead.
- **Efficient data handling:** Retrieve and parse only the output required by the simulation.
- **Reusable interface:** Expose a simple API that allows other components to request aerodynamic calculations without managing XFOIL's execution details.

The initial objective is to reduce wrapper overhead enough to unblock development of the existing MATLAB simulation and make aerodynamic data generation practical.

## Planned Simulation Architecture

The final simulation will move away from MATLAB to a compiled language. This is intended to improve execution speed and provide better integration with C, since the control algorithms will most likely be written in C for portability.

The planned architecture is:

1. **Aerodynamic data generation:** Use XFOIL to calculate lift and drag coefficients across the required flight conditions.
2. **Data preprocessing:** Store the results in lookup tables suitable for fast interpolation.
3. **Flight simulation:** Implement the physics model in a compiled language, using the precomputed aerodynamic data.
4. **Control integration:** Interface the simulation with the flight-control algorithms, likely written in C.
5. **Testing and iteration:** Use the simulation to develop and test the control algorithms without relying exclusively on physical testing.

This separates computationally expensive aerodynamic analysis from the time-critical simulation loop.

## Immediate Priorities

The immediate focus is to remove the bottlenecks preventing further development.

### Task 1: Improve the XFOIL Wrapper

- Investigate communicating with XFOIL through standard input and output pipes.
- Implement a persistent XFOIL subprocess.
- Disable GUI initialisation where possible.
- Reduce file I/O and output-processing overhead.
- Benchmark the improved interface against the existing implementation.
- Confirm that repeated calculations produce valid, consistent results.

**Goal:** Make aerodynamic calculations efficient enough to support development of the current MATLAB simulation and generation of precomputed data.

### Task 2: Select a Language for the Final Simulation

Evaluate suitable compiled languages based on:

- Runtime performance.
- Ease of integration with C.
- Availability of numerical and scientific computing libraries.
- Support for fast lookup-table access and interpolation.
- Portability across development and target platforms.
- Ease of testing, debugging, and long-term maintenance.

Choose a language that provides sufficient performance without unnecessarily complicating integration with the control algorithms.

### Task 3: Define the Aerodynamic Lookup Tables

Once the wrapper is sufficiently efficient:

- Identify the flight conditions over which aerodynamic data must be generated.
- Define the independent variables required to index the data.
- Generate and validate the lookup tables.
- Implement linear interpolation in the simulation.
- Compare interpolated results against direct XFOIL calculations.
- Measure simulation runtime and determine whether real-time performance is achievable.

## Next Steps

The immediate priorities are to **improve the XFOIL wrapper and select the implementation language for the final simulation**.

The wrapper is the first dependency to address because it will accelerate aerodynamic data generation and allow development to continue using the existing MATLAB implementation. In parallel, selecting the final simulation language will establish the foundation for a faster, more portable implementation that can integrate with the control algorithms.

Once these two tasks are underway, the next major milestone is to generate the aerodynamic lookup tables and integrate them into the simulation, removing the need to run XFOIL during flight simulation.
