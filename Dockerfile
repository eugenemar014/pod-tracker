FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm install \
    && npm --prefix server install \
    && npm --prefix client install

COPY . .

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
