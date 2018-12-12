FROM sofp/core:master

# Switch to root to allow copying and building the project

USER root

# Note that this example module uses a .dockerignore file that prohibits copying node_modules, dist and package-lock.json
COPY . backends/sofp-example-backend

WORKDIR  ./backends/sofp-example-backend
RUN npm install
RUN npm run build
RUN npm run test


# Revert back to the original work directory and the proper user

WORKDIR ../../

USER sofp-user