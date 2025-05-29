FROM node:18

WORKDIR /app

# Copy package.json and package-lock.json (or pnpm-lock.yaml if used)
COPY package*.json ./

# Install dependencies
# If you are using pnpm, change this to `RUN pnpm install`
# If you are using yarn, change this to `RUN yarn install`
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application in production mode
CMD ["npm", "run", "start:prod"]
