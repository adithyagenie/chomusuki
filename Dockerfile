FROM node:16.19.0-alpine

WORKDIR /app
COPY package*.json .
RUN npm install
ADD ./src ./src
ADD tsconfig.json .
RUN npm run build
RUN rm -rf src
RUN rm ./package.json ./package-lock.json ./tsconfig.json
CMD ["node", "out/index.js"]