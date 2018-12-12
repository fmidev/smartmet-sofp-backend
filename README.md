# Sofp Example Backend

This is an example backend for for Simple Observation Features Pilot WFS 3.0 project. The core is available at https://github.com/vaisala-oss/sofp-core

© 2018 Vaisala Corporation

## Developing

You can run the entire server with this backend using ```npm start```. This will watch the typescript source files, recompile when necessary and restart the server. For this to work, sofp-core must be cloned alongside this backend module directory and compiled (npm install, npm run build).

The step-by-step is as follows:

  cd /where/you/store/projects
  git clone https://github.com/vaisala-oss/sofp-core.git
  git clone https://github.com/vaisala-oss/sofp-example-backend.git
  cd sofp-core
  npm install && npm run build
  cd ..
  cd sofp-example-backend
  npm start

## Packaging

Backends are packaged as docker containers that are built on top of the sofp-core container. A full server is the core + at least one backend. Multiple backends can be packaged by chaining together backends so that the first backend starts from the sofp-core container, then next uses the output of the previous backend container and so forth until all backends are included.

To build this particular mock backend, you can use the Dockerfile in the repository along this documentation. Clone the project, then run:

  docker build --no-cache -t sofp/example-backend .

To start the image (removing the container when stopped):

  docker run --rm -p 127.0.0.1:8080:3000/tcp sofp/example-backend
