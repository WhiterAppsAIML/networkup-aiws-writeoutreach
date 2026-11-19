# Use the official Node.js image as the base image
FROM node:25.2.1
# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies in the container
RUN npm install

# # Rebuild bcrypt to match the Linux environment
# RUN npm rebuild bcrypt --build-from-source


# Rebuild native dependencies like bcrypt to match the container's environment
RUN npm rebuild

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]