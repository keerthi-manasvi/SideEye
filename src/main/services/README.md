# Django Service Management

This directory contains the Django service management implementation for the SideEye Electron application. The service manager handles the complete lifecycle of the Django backend service, including startup, shutdown, health monitoring, and automatic restart capabilities.

## Architecture

### DjangoServiceManager Class

The `DjangoServiceManager` is the core component that manages the Django backend service. It extends Node.js EventEmitter to provide real-time status updates and event notifications.

#### Key Features

1. **Automatic Service Lifecycle Management**

   - Starts Django service on application startup
   - Graceful shutdown on application exit
   - Automatic restart on unexpected failures

2. **Health Monitoring**

   - Periodic health checks via HTTP endpoint
   - Automatic restart on health check failures
   - Configurable health check intervals

3. **Error Handling and Recovery**

   - Graceful error handling for all failure scenarios
   - Exponential backoff for restart attempts
   - Maximum restart attempt limits

4. **API Communication**

   - Built-in API client for Django service communication
   - Connection error detection and handling
   - Request timeout management

5. **Event-Driven Architecture**
   - Real-time status updates via events
   - Comprehensive logging and monitoring
   - Integration with Electron main process

## Configuration Options

```javascript
const serviceManager = new DjangoServiceManager({
  port: 8000, // Django service port
  host: "localhost", // Django service host
  isDev: false, // Development mode flag
  maxRestartAttempts: 3, // Maximum automatic restart attempts
  restartDelay: 2000, // Delay between restart attempts (ms)
  healthCheckInterval: 10000, // Health check interval (ms)
  startupTimeout: 30000, // Service startup timeout (ms)
  shutdownTimeout: 10000, // Service shutdown timeout (ms)
});
```

## Events

The service manager emits the following events:

### Lifecycle Events

- `starting` - Service is starting up
- `started` - Service started successfully
- `stopping` - Service is shutting down
- `stopped` - Service stopped
- `restarting` - Service is restarting

### Health Events

- `healthy` - Health check passed
- `unhealthy` - Health check failed

### Error Events

- `error` - Critical error occurred
- `warning` - Warning message
- `info` - Informational message

### Process Events

- `stdout` - Django process stdout output
- `stderr` - Django process stderr output
- `process-exit` - Django process exited
- `process-error` - Django process error
- `api-error` - API communication error

## API Methods

### Service Control

- `start()` - Start the Django service
- `stop()` - Stop the Django service
- `restart()` - Restart the Django service
- `healthCheck()` - Perform health check
- `getStatus()` - Get current service status

### API Communication

- `apiCall(endpoint, method, data)` - Make API call to Django service

## Integration with Electron

### Main Process Integration

The service manager is integrated into the Electron main process (`src/main/main.js`) with:

1. **Automatic Initialization**

   ```javascript
   const djangoServiceManager = new DjangoServiceManager(options);
   ```

2. **Event Forwarding**

   - Service events are forwarded to renderer process
   - Status updates sent via IPC

3. **IPC Handlers**
   - `django-service-start` - Start service
   - `django-service-stop` - Stop service
   - `django-service-restart` - Restart service
   - `django-service-status` - Get status
   - `django-service-health-check` - Health check
   - `django-api-call` - API communication

### Renderer Process Integration

The renderer process can interact with the service via the preload API:

```javascript
// Start service
const result = await window.electronAPI.djangoService.start();

// Get status
const status = await window.electronAPI.djangoService.getStatus();

// Listen to status updates
window.electronAPI.djangoService.onStatusUpdate((data) => {
  console.log("Service status:", data.status);
});

// Make API call
const apiResult = await window.electronAPI.callDjangoAPI("/health/", "GET");
```

## Error Handling

### Startup Failures

- Connection timeout handling
- Process spawn failures
- Health check failures during startup

### Runtime Failures

- Unexpected process exits
- Health check failures
- API communication errors

### Shutdown Failures

- Graceful shutdown with SIGTERM
- Force kill with SIGKILL after timeout
- Resource cleanup

## Development vs Production

### Development Mode (`isDev: true`)

- Service management is disabled
- Django runs separately via npm scripts
- All API calls still work normally

### Production Mode (`isDev: false`)

- Full service lifecycle management
- Automatic startup and shutdown
- Health monitoring and restart

## Health Check Endpoint

The Django service must provide a health check endpoint at `/api/health/` that returns:

```json
{
  "status": "healthy",
  "service": "SideEye Django Backend",
  "version": "1.0.0",
  "timestamp": "2023-12-29T10:30:00Z"
}
```

## Testing

### Unit Tests

- `DjangoServiceManager.test.js` - Comprehensive unit tests
- Mock process and network dependencies
- Test all lifecycle scenarios

### Integration Tests

- `django-service-integration.test.js` - Electron integration tests
- Test IPC communication
- Test event forwarding

### Manual Testing

- `manual-test.js` - Manual test script
- Can be run independently
- Tests real Django service interaction

### Running Tests

```bash
# Run unit tests
npm test -- --testPathPattern="DjangoServiceManager"

# Run integration tests
npm test -- --testPathPattern="django-service-integration"

# Run manual test (requires Django service)
node src/main/services/__tests__/manual-test.js
```

## Troubleshooting

### Common Issues

1. **Service Won't Start**

   - Check if Django dependencies are installed
   - Verify Python is available in PATH
   - Check port availability (default 8000)

2. **Health Checks Failing**

   - Verify Django service is running
   - Check health endpoint is accessible
   - Review Django logs for errors

3. **Automatic Restart Not Working**
   - Check restart attempt limits
   - Review error logs for failure reasons
   - Verify service manager event listeners

### Debugging

Enable verbose logging by listening to all events:

```javascript
serviceManager.on("stdout", console.log);
serviceManager.on("stderr", console.error);
serviceManager.on("error", console.error);
serviceManager.on("warning", console.warn);
serviceManager.on("info", console.log);
```

## Security Considerations

1. **Local Communication Only**

   - Service only accepts localhost connections
   - No external network exposure

2. **Process Isolation**

   - Django runs as separate process
   - Proper cleanup on application exit

3. **Command Validation**
   - Safe process spawning
   - No shell injection vulnerabilities

## Performance

### Resource Usage

- Minimal CPU overhead for health monitoring
- Memory usage scales with Django service
- Network traffic limited to health checks and API calls

### Optimization

- Configurable health check intervals
- Efficient event handling
- Proper resource cleanup

## Future Enhancements

1. **Service Discovery**

   - Automatic port detection
   - Multiple service instance support

2. **Advanced Health Checks**

   - Database connectivity checks
   - Custom health metrics

3. **Performance Monitoring**

   - Response time tracking
   - Resource usage monitoring

4. **Configuration Management**
   - Dynamic configuration updates
   - Environment-specific settings
