---
title: "Research into Alternative Flight Simulation Software"
date: 2026-11-10
author: nitya-singh
collaborators: []
timeCommitted: 1
hoursByMember:
  nitya-singh: 1
contributions:                                       
  nitya-singh: |+
    ### Results
    
    Based on the investigation, JSBSim was selected as the preferred simulation platform for the glider project.
    
    Although MSFS 2020 provides better visualization, JSBSim offers greater flexibility for aerodynamic modelling, control-system development, and quantitative analysis.
    
    The main findings from the comparison are summarized below:
    
    | Criteria | MSFS 2020 | JSBSim |
    |---|---|---|
    | Custom aerodynamic coefficients | Limited flexibility | Highly configurable |
    | Control-surface modelling | Supported | Supported |
    | MATLAB/Python integration | Through SimConnect | Direct integration available |
    | Atmospheric conditions | Customizable | Customizable |
    | Flight data extraction | SimConnect API | Native data logging |
    | Automated simulations | More complex | Well supported |
    | Flight visualization | Excellent | Requires additional software |
    
    JSBSim was considered more suitable because the team can define the glider's aerodynamic characteristics using coefficient tables and simulate its response to different control inputs. Its ability to integrate with external control algorithms will also be beneficial when developing the glider's guidance and control system.
    
    While JSBSim does not directly resolve XFOIL's convergence issues, it separates aerodynamic coefficient generation from flight simulation, allowing the flight dynamics to be evaluated efficiently once reliable aerodynamic data is available.
    
    
    ### Next Steps
    
    - Install and configure JSBSim and investigate its aircraft modelling structure.
    - Create a preliminary glider model using the current geometry, mass, and aerodynamic parameters.
    - Investigate importing aerodynamic coefficient lookup tables from XFOIL or alternative sources.
    - Configure elevator, rudder, and aileron inputs for control-system testing.
    - Integrate JSBSim with MATLAB or Python to collect flight data and evaluate control algorithms.

# Posted from issue #28 by @sky1515
draft: false
---

### Objectives
Following the numerical convergence issues encountered with XFOIL, alternative flight simulation software was investigated to identify a more reliable and efficient approach for modelling the glider's flight dynamics. The main objective was to find software that could simulate the glider's aerodynamic behaviour, support control of the elevator, rudder, and ailerons, and provide flight data for further analysis.
Two potential platforms were investigated: Microsoft Flight Simulator 2020 (MSFS 2020) and JSBSim. 

### Process

1. Microsoft Flight Simulator 2020
  - MSFS 2020 was investigated for its realistic flight physics, customizable aircraft properties, and environmental conditions.
  - Its SimConnect API allows flight data such as altitude, airspeed, orientation, and control-surface positions to be extracted. It also supports external control inputs through MATLAB or Python integration.
  - However, MSFS has limited flexibility for custom aerodynamic models and is less suitable for simulating the extreme atmospheric conditions during high-altitude descent.
2. JSBSim
  - JSBSim is an open-source flight dynamics simulator that offers greater flexibility in modelling aircraft aerodynamics, control surfaces, and atmospheric conditions.
  - It supports aerodynamic coefficient lookup tables, allowing precomputed XFOIL data to be used without repeatedly running XFOIL during simulations. However, the coefficient data must still be validated.
  - JSBSim can integrate with MATLAB or Python for control-system development and supports automated simulations and data extraction, making it more suitable for evaluating the glider's flight performance.
