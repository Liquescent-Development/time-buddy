FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY server.js ./
COPY public ./public

EXPOSE 3000

CMD ["node", "server.js"]