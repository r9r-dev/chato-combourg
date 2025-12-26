# Dockerfile for Chateau Combo PWA
# Simple nginx container serving static files
# Can be extended later with a backend API for image analysis

FROM nginx:alpine

# Version label
ARG APP_VERSION=dev
LABEL version=${APP_VERSION}
LABEL description="Chateau Combo Score Calculator PWA"

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy PWA files
COPY index.html /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY icons/ /usr/share/nginx/html/icons/

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# nginx runs as non-root by default in nginx:alpine
CMD ["nginx", "-g", "daemon off;"]
