# Obraz produkcyjny: frontend wbudowany w jar backendu.
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /app/backend
COPY backend/pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY backend/src ./src
COPY --from=frontend /app/frontend/dist ./src/main/resources/static
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 1001 game
COPY --from=backend /app/backend/target/space-pioneers-backend-*.jar app.jar
USER game
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
