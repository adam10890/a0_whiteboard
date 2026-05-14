FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

EXPOSE 4173

# Use Vite dev server with increased header limit
ENV NODE_OPTIONS="--max-http-header-size=32768"
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
