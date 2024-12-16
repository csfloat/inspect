FROM node:22.12

# Create app directory
WORKDIR /inspect

# Copy the source code.
COPY . .

RUN npm install

EXPOSE 8080

CMD [ "node", "--max-old-space-size=40096", "index.js" ]
