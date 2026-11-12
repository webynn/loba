FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node . .
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
