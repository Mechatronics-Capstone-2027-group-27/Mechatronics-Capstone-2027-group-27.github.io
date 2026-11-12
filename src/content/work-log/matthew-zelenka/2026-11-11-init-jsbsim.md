---
title: "initial usage and testing of jsbsim"
date: 2026-11-11
author: matthew-zelenka
collaborators: []
timeCommitted: 3
hoursByMember:
  matthew-zelenka: 3
contributions:                                       
  matthew-zelenka: |+
    ## Initial Research and Setup

    I started by looking into JSBSim and its capabilities to get a better understanding of what it can do and how it could be used within the project. Read through some of the documentation and looked at how it simulates aircraft movement, aerodynamics, and flight controls. Also explored some of the example aircraft models and simulation files available.
    
    Downloaded and installed JSBSim along with any required dependencies, then set up the environment needed to run simulations. Once installed, checked that the software was working correctly and familiarised myself with the file structure, including the aircraft configuration files, engine models and example simulations.
    
    ## Initial Testing and Software Exploration

    For the initial testing, I installed [FlightGear](https://www.flightgear.org/) and spent some time trying it out to become familiar with the simulator and its features. Explored the interface, aircraft selection and general flight controls to get a better idea of how the visual simulation environment works.

    I also looked into how FlightGear and JSBSim can work together, with JSBSim handling the aircraft flight dynamics and FlightGear providing the visual representation. This could be useful for the capstone project as it would allow the flight controller to interact with a simulated aircraft while also providing a visual way to observe its behaviour.

    ## Investigating Controller Integration
    The main area of interest was investigating how JSBSim could be connected to the flight controller being developed for the capstone project. The idea is to use JSBSim as a simulated aircraft that the controller can interact with, allowing the controller's performance and responses to be tested without initially needing a physical aircraft.

    Additionally I looked into how JSBSim accepts external control inputs, such as aileron, elevator, rudder and throttle commands, and how these could potentially be provided by the flight controller. I also considered how information from the simulation, including aircraft orientation, angular rates, altitude and velocity, could be sent back to the controller as feedback.

    Another area explored was how Python and C++ could be used to connect the different parts of the system. Python could be useful for initial testing, scripting and communicating with JSBSim, while C++ could allow for more direct integration with the flight controller or other project software. Investigating these options will help determine the best way to structure the overall system.
    
    ## Setting Up A Simulated Environment
    After getting familiar with the software, I started using the JSBSim API to set up and run my own simulations. The initial tests involved creating an environment where a glider was released from an altitude of around 10 km and allowed to descend while observing its flight behaviour. This provided an opportunity to experiment with the API and see how the aircraft responded to the simulated flight conditions.

    During the simulation, data was collected on the glider's flight and used it to generate a 3D graph (see below) showing its trajectory as it descended. I also created several 2D graphs to look more closely at the different environmental conditions and flight parameters throughout the descent. This included looking at how conditions around the aircraft changed as it lost altitude and how these conditions related to its flight behaviour.

    <iframe
      src="/graphs/2026-11-11-init-jsbsim/glider_3d_trajectory.html"
      width="100%"
      height="600"
      style="background: transparent; border: none;"
      frameborder="0"
    ></iframe> 

    <iframe
      src="/graphs/2026-11-11-init-jsbsim/glider_flight_dashboard.html"
      width="100%"
      height="600"
      style="background: transparent; border: none;"
      frameborder="0"
    ></iframe> 

    Overall this was useful for getting a better understanding of how to run simulations through the API, access the simulation data and process it into graphs for analysis. It also provided an initial example of how JSBSim could be used to generate useful flight data that could eventually be passed to or used alongside the flight controller.

    ## Next Steps
    The next step is to start looking into the design and development of the flight controller itself. This will involve deciding on the overall controller structure, identifying the inputs required from the aircraft and determining what outputs will be needed to control its flight. I will also start looking into suitable control methods and how these could be used to manage the aircraft's attitude, stability and response to different flight conditions.

draft: false
---

### Objectives
The aim of this work was to get [JSBSim](https://github.com/JSBSim-Team/jsbsim) installed and set up as a starting point for potentially using it within the project. This involved becoming familiar with the software, exploring its main features and understanding how it works as a flight dynamics simulator. I wanted to investigate what JSBSim is capable of, how aircraft models are set up and configured, what types of simulation data it can produce, and how different aspects of an aircraft can be controlled within the simulator.

Another main focus was to explore how JSBSim could potentially be integrated into the capstone for software in the loop testing and how it could communicate with other software or systems. This included looking into the available interfaces, the possibility of using Python/C++ to interact with the simulator, how external inputs could be sent to control an aircraft, and how simulation outputs could be collected and used elsewhere. The overall goal was to get a general understanding of the software, establish a working installation and identify how it could fit into the capstone before moving on to more detailed development and testing.
