# week05/backend/order_service/Dockerfile

FROM python:3.10-slim-buster

# Set working directory
WORKDIR /code

# Copy dependencies
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app /code/app

# Expose the correct port (8001, matches k8s Service/Deployment config)
EXPOSE 8001

# Start the app on port 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
