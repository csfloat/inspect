FROM node:18.15

# Create app directory
WORKDIR /inspect

# Copy the source code.
COPY ./inspect ./

RUN npm install

EXPOSE 80

CMD [ "/bin/bash", "docker_start.sh" ]
