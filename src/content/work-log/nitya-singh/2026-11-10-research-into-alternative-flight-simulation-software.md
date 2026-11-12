---
title: "Research into Alternative Flight Simulation Software"
date: 2026-11-10
author: nitya-singh
collaborators: []
timeCommitted: 1
hoursByMember:
  nitya-singh: 1
contributions:                                       
  nitya-singh: "
### Results

JSBSim was selected due to its greater flexibility in aerodynamic modelling and control-system development. It can use precomputed aerodynamic coefficients, reducing the need to repeatedly run XFOIL during flight simulations. However, reliable coefficient data is still required.

Next Steps

- Install and configure JSBSim and investigate its aircraft modelling structure.
- Create a preliminary glider model using the current geometry, mass, and aerodynamic parameters.
- Investigate importing aerodynamic coefficient lookup tables from XFOIL or alternative sources.
- Configure elevator, rudder, and aileron inputs for control-system testing.
- Integrate JSBSim with MATLAB or Python to collect flight data and evaluate control algorithms.
"
# Posted from issue #28 by @sky1515
draft: false
---

### Objectives
Following the numerical convergence issues encountered with XFOIL, alternative flight simulation software was investigated to identify a more reliable and efficient approach for modelling the glider's flight dynamics. The main objective was to find software that could simulate the glider's aerodynamic behaviour, support control of the elevator, rudder, and ailerons, and provide flight data for further analysis.
Two potential platforms were investigated: Microsoft Flight Simulator 2020 (MSFS 2020) and JSBSim. 

### Process

- **Microsoft Flight Simulator 2020**: Supports customizable aircraft properties, environmental conditions, and flight data extraction through SimConnect. However, it offers limited flexibility for custom aerodynamic models and high-altitude simulations.

- JSBSim: An open-source flight dynamics engine supporting custom aerodynamic coefficient lookup tables, control-surface modelling, atmospheric conditions, and MATLAB/Python integration. It also allows automated simulations and flight data extraction.
