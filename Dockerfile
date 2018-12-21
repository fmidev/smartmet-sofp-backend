FROM sofp/core:master

# Switch to root to allow copying and building the project

USER root

# Note that this module uses a .dockerignore file that prohibits copying node_modules, dist and package-lock.json
COPY . backends/smartmet-sofp-backend

WORKDIR  ./backends/smartmet-sofp-backend
RUN npm install
RUN npm run build
# RUN npm run test


# Revert back to the original work directory and the proper user

WORKDIR ../../

USER sofp-user