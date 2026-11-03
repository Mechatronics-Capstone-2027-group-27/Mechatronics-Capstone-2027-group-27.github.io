
---
title: "Developing a Java XFOIL Wrapper for Aerodynamic Data Generation"
date: 2026-11-03
author: matthew-zelenka
collaborators: []
timeCommitted: 6.0
tags: [Simulation]
draft: false
---

## Motivation

As discussed in the [Flight Simulation Meeting](../flight-simulation-meeting/), integrating aerodynamic data into the flight simulation is an important step towards improving the accuracy of the aircraft model.

The existing MATLAB simulation uses constant lift and drag coefficients. To move towards a more realistic aerodynamic model, the simulation needs to account for how these coefficients change with operating conditions, including angle of attack, Reynolds number, and Mach number.

[XFOIL](https://web.mit.edu/drela/Public/web/xfoil/) provides the aerodynamic analysis capabilities needed to calculate these coefficients for a given airfoil. However, repeatedly launching XFOIL and processing its output introduces considerable overhead.

Since the eventual goal is to use precomputed aerodynamic lookup tables rather than running XFOIL during every simulation step, generating large amounts of aerodynamic data efficiently is important.

To address this, I developed a Java library that provides a programmatic interface to XFOIL.

**Repository:** [Java XFOIL Wrapper](https://github.com/Mechatronics-Capstone-2027-group-27/Java-xFoil-wrapper)

## The Original Problem

The initial approach to communicating with XFOIL involved several operations for every aerodynamic calculation:

1. Write the calculation parameters to disk.
2. Launch a new XFOIL process.
3. Initialise XFOIL and configure the analysis.
4. Execute the aerodynamic calculation.
5. Write the results to output files.
6. Read and parse those files to retrieve the required coefficients.

Although this approach works, repeatedly launching processes and performing disk operations is inefficient.

The overhead becomes particularly significant when generating aerodynamic data over a large range of operating conditions. For example, generating a lookup table requires evaluating many combinations of angle of attack, Reynolds number, and Mach number.

In this situation, the time spent managing XFOIL can become a substantial part of the total calculation time.

## Developing the Java Wrapper

The goal of the library was to encapsulate the interaction with XFOIL behind a reusable Java interface.

Rather than requiring the calling application to manage process execution, command input, and output parsing itself, these responsibilities can be handled by the wrapper.

This provides a cleaner separation between the aerodynamic analysis engine and the application requesting the results.

The intended workflow is:

```text
      Java Application
             |
             v
      Java XFOIL Wrapper
             |
             v
       XFOIL Process
             |
             v
    Aerodynamic Calculation
             |
             v
      Processed Results
             |
             v
        Cl and Cd
```

The wrapper is designed around the aerodynamic parameters required by the flight simulation:

- Airfoil geometry, including NACA profiles.
- Angle of attack.
- Reynolds number.
- Mach number.

The primary outputs of interest are the lift coefficient (\(C_l\)) and drag coefficient (\(C_d\)).

## Process Communication

One of the main engineering challenges was determining how to communicate with XFOIL efficiently.

The initial approach of launching a new process for every calculation introduces unnecessary initialisation overhead. A more efficient approach is to maintain a persistent XFOIL process and reuse it across multiple calculations.

This would allow the wrapper to send commands to an existing process rather than repeatedly starting and stopping the executable.

### Standard Input and Output

The preferred approach was to communicate with XFOIL through standard input and output pipes.

This would eliminate much of the unnecessary file I/O involved in the original implementation:

- Commands could be sent directly to the running process.
- Results could be read directly from its output.
- Intermediate files would no longer be required for routine communication.

However, XFOIL is an interactive terminal application, and its behaviour is not necessarily identical when executed through redirected standard streams.

In particular, during investigation of the MATLAB integration, running `xFoil.exe` directly with standard pipes did not provide the expected output.

### Pseudo-Terminal Investigation

An alternative approach investigated was running XFOIL inside a pseudo-terminal (PTY).

A pseudo-terminal provides an interactive terminal environment to a subprocess, allowing applications that expect terminal input and output to operate in a more conventional way.

One Java library considered for this was [PTY4J](https://github.com/JetBrains/pty4j), which provides cross-platform pseudo-terminal support.

However, integrating PTY4J into the existing MATLAB workflow introduced a dependency compatibility issue. MATLAB relies on JNA (Java Native Access) for native library interaction, but the version available in the MATLAB environment was **JNA 4.1.0**, which is approximately 12 years old.

PTY4J's native integration was not compatible with this outdated JNA dependency. Updating or overriding MATLAB's JNA installation could introduce additional compatibility issues with MATLAB itself.

As a result, **PTY4J was not adopted** for the project.

One alternative investigated involved using SSH with forced pseudo-terminal allocation:

```bash
ssh -tt ...
```

This highlighted an important consideration when integrating external command-line applications into an existing engineering environment: the choice of communication library is not determined solely by its capabilities, but also by the compatibility of its dependencies with the surrounding software ecosystem.

Ultimately, maintaining compatibility with MATLAB was an important constraint when evaluating possible approaches to XFOIL process communication.

## Integration with the Flight Simulation

The wrapper is not intended to run inside the final simulation loop.

Instead, its primary purpose is to make generating aerodynamic data more practical.

The planned workflow is to use XFOIL to evaluate the required operating conditions, store the resulting coefficients, and use those values to construct lookup tables.

The simulation can then retrieve aerodynamic coefficients through interpolation rather than invoking XFOIL directly.

The resulting architecture is:

```text
       XFOIL
         |
         v
  Java XFOIL Wrapper
         |
         v
  Aerodynamic Data Generation
         |
         v
    Lookup Tables
         |
         v
  Flight Simulation
         |
         v
  Flight Control Algorithms
```

This separates the computationally expensive aerodynamic calculations from the time-critical simulation.

It also allows the aerodynamic model and flight simulation to be developed independently.

## Future Work

With the wrapper established as a separate component, the next steps are to evaluate its performance and prepare it for generating the aerodynamic data required by the simulation.

The main priorities are:

- Benchmark the wrapper against the original process-launching approach.
- Verify that repeated calculations return valid and consistent aerodynamic coefficients.
- Improve process communication and reduce unnecessary file operations.
- Generate aerodynamic data across the required ranges of operating conditions.
- Store the results in lookup tables.
- Implement interpolation and integrate the resulting aerodynamic model into the flight simulation.

Once the lookup tables are available, the simulation will no longer need to invoke XFOIL during flight calculations.

## Conclusion

Developing the Java XFOIL Wrapper addresses an important infrastructure requirement for the flight simulation project.

Although XFOIL already provides the aerodynamic analysis capabilities required, integrating it efficiently into an automated workflow requires an additional software layer.

The wrapper provides that layer, making it possible to separate aerodynamic data generation from the simulation itself.

This is an important step towards replacing the existing constant-coefficient model with an aerodynamic model that accounts for changing flight conditions, while keeping the eventual simulation efficient enough for real-time control development.

The next major milestone is to use the wrapper to generate aerodynamic lookup tables and integrate them into the flight simulation.
