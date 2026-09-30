FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js admin.html ./
EXPOSE 8080
CMD ["npm","start"]
