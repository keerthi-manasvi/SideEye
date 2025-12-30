
import logging
import traceback
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
import os
import sys

logger = logging.getLogger(__name__)


class ErrorHandlingService:
    """
    Comprehensive error handling and recovery service for the Django backend
    """
    
    def __init__(self):
        self.error_log = []
        self.max_log_size = 1000
        self.recovery_strategies = {}
        self.error_callbacks = {}
        self.setup_logging()
    
    def setup_logging(self):
        """Setup enhanced logging configuration"""
        # Create logs directory if it doesn't exist
        log_dir = os.path.join(settings.BASE_DIR, 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        # Configure error-specific logger
        error_logger = logging.getLogger('sideeye.errors')
        error_logger.setLevel(logging.ERROR)
        
        # File handler for errors
        error_file_handler = logging.FileHandler(
            os.path.join(log_dir, 'errors.log')
        )
        error_file_handler.setLevel(logging.ERROR)
        
        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        error_file_handler.setFormatter(formatter)
        
        if not error_logger.handlers:
            error_logger.addHandler(error_file_handler)
    
    def log_error(self, error_data: Dict[str, Any]) -> str:
        """
        Log an error with comprehensive details
        
        Args:
            error_data: Dictionary containing error information
            
        Returns:
            str: Error ID for tracking
        """
        error_id = f"err_{int(datetime.now().timestamp())}_{hash(str(error_data)) % 10000}"
        
        error_entry = {
            'id': error_id,
            'timestamp': timezone.now().isoformat(),
            'type': error_data.get('type', 'unknown'),
            'message': error_data.get('message', ''),
            'stack_trace': error_data.get('stack_trace', ''),
            'context': error_data.get('context', {}),
            'severity': self._determine_severity(error_data),
            'user_agent': error_data.get('user_agent', ''),
            'url': error_data.get('url', ''),
            'additional_data': error_data.get('additional_data', {})
        }
        
        # Add to in-memory log
        self.error_log.insert(0, error_entry)
        
        # Maintain log size
        if len(self.error_log) > self.max_log_size:
            self.error_log = self.error_log[:self.max_log_size]
        
        # Log to file
        error_logger = logging.getLogger('sideeye.errors')
        error_logger.error(f"[{error_id}] {error_entry['type']}: {error_entry['message']}")
        
        # Store in cache for quick access
        cache.set(f"error_{error_id}", error_entry, timeout=3600)  # 1 hour
        
        # Trigger callbacks
        self._trigger_error_callbacks(error_entry)
        
        # Attempt automatic recovery if applicable
        self._attempt_automatic_recovery(error_entry)
        
        return error_id
    
    def _determine_severity(self, error_data: Dict[str, Any]) -> str:
        """Determine error severity based on error data"""
        error_type = error_data.get('type', '').lower()
        message = error_data.get('message', '').lower()
        
        # Critical errors
        critical_patterns = [
            'database', 'connection', 'memory', 'disk', 'permission denied',
            'authentication failed', 'security'
        ]
        
        # High severity errors
        high_patterns = [
            'api_error', 'service_error', 'timeout', 'validation',
            'not found', 'bad request'
        ]
        
        # Medium severity errors
        medium_patterns = [
            'warning', 'deprecated', 'performance'
        ]
        
        if any(pattern in error_type or pattern in message for pattern in critical_patterns):
            return 'critical'
        elif any(pattern in error_type or pattern in message for pattern in high_patterns):
            return 'high'
        elif any(pattern in error_type or pattern in message for pattern in medium_patterns):
            return 'medium'
        else:
            return 'low'
    
    def _trigger_error_callbacks(self, error_entry: Dict[str, Any]):
        """Trigger registered error callbacks"""
        error_type = error_entry['type']
        
        # Type-specific callbacks
        if error_type in self.error_callbacks:
            for callback in self.error_callbacks[error_type]:
                try:
                    callback(error_entry)
                except Exception as e:
                    logger.error(f"Error in error callback: {e}")
        
        # Global callbacks
        if '*' in self.error_callbacks:
            for callback in self.error_callbacks['*']:
                try:
                    callback(error_entry)
                except Exception as e:
                    logger.error(f"Error in global error callback: {e}")
    
    def _attempt_automatic_recovery(self, error_entry: Dict[str, Any]):
        """Attempt automatic recovery based on error type"""
        error_type = error_entry['type']
        
        if error_type in self.recovery_strategies:
            try:
                strategy = self.recovery_strategies[error_type]
                recovery_result = strategy(error_entry)
                
                if recovery_result:
                    logger.info(f"Automatic recovery successful for error {error_entry['id']}")
                    error_entry['recovery_attempted'] = True
                    error_entry['recovery_successful'] = True
                else:
                    logger.warning(f"Automatic recovery failed for error {error_entry['id']}")
                    error_entry['recovery_attempted'] = True
                    error_entry['recovery_successful'] = False
                    
            except Exception as e:
                logger.error(f"Error during automatic recovery: {e}")
                error_entry['recovery_attempted'] = True
                error_entry['recovery_successful'] = False
                error_entry['recovery_error'] = str(e)
    
    def register_error_callback(self, error_type: str, callback):
        """Register a callback for specific error types"""
        if error_type not in self.error_callbacks:
            self.error_callbacks[error_type] = []
        self.error_callbacks[error_type].append(callback)
    
    def register_recovery_strategy(self, error_type: str, strategy):
        """Register a recovery strategy for specific error types"""
        self.recovery_strategies[error_type] = strategy
    
    def get_error_stats(self) -> Dict[str, Any]:
        """Get comprehensive error statistics"""
        if not self.error_log:
            return {
                'total_errors': 0,
                'by_type': {},
                'by_severity': {},
                'recent_errors': 0,
                'recovery_rate': 0
            }
        
        # Calculate time ranges
        now = timezone.now()
        one_hour_ago = now - timedelta(hours=1)
        
        stats = {
            'total_errors': len(self.error_log),
            'by_type': {},
            'by_severity': {},
            'recent_errors': 0,
            'recovery_attempts': 0,
            'successful_recoveries': 0
        }
        
        for error in self.error_log:
            error_time = datetime.fromisoformat(error['timestamp'].replace('Z', '+00:00'))
            
            # Count by type
            error_type = error['type']
            stats['by_type'][error_type] = stats['by_type'].get(error_type, 0) + 1
            
            # Count by severity
            severity = error['severity']
            stats['by_severity'][severity] = stats['by_severity'].get(severity, 0) + 1
            
            # Count recent errors
            if error_time > one_hour_ago:
                stats['recent_errors'] += 1
            
            # Count recovery attempts
            if error.get('recovery_attempted'):
                stats['recovery_attempts'] += 1
                if error.get('recovery_successful'):
                    stats['successful_recoveries'] += 1
        
        # Calculate recovery rate
        if stats['recovery_attempts'] > 0:
            stats['recovery_rate'] = (stats['successful_recoveries'] / stats['recovery_attempts']) * 100
        else:
            stats['recovery_rate'] = 0
        
        return stats
    
    def get_recent_errors(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent errors with optional limit"""
        return self.error_log[:limit]
    
    def get_error_by_id(self, error_id: str) -> Optional[Dict[str, Any]]:
        """Get error details by ID"""
        # First check cache
        cached_error = cache.get(f"error_{error_id}")
        if cached_error:
            return cached_error
        
        # Search in memory log
        for error in self.error_log:
            if error['id'] == error_id:
                return error
        
        return None
    
    def get_user_friendly_error_message(self, error: Dict[str, Any]) -> str:
        """Generate user-friendly error message"""
        if not error:
            return "An unknown error occurred"
        
        error_type = error.get('type', 'unknown')
        severity = error.get('severity', 'low')
        
        # Generate friendly messages based on error type and severity
        if 'frontend' in error_type.lower():
            if severity == 'critical':
                return "A critical error occurred in the application. Please refresh the page and try again."
            elif severity == 'high':
                return "An error occurred while processing your request. Please try again."
            else:
                return "A minor issue was detected. The application should continue working normally."
        
        elif 'api' in error_type.lower():
            return "There was a problem connecting to the server. Please check your connection and try again."
        
        elif 'database' in error_type.lower():
            return "There was a problem accessing your data. Please try again in a moment."
        
        else:
            return f"An error occurred: {error.get('message', 'Unknown error')}"
    
    def create_error_report(self, error_id: str) -> Dict[str, Any]:
        """Create comprehensive error report"""
        error = self.get_error_by_id(error_id)
        
        if not error:
            return {'error': 'Error not found'}
        
        # Get similar errors
        similar_errors = []
        error_type = error.get('type')
        for e in self.error_log:
            if e['id'] != error_id and e.get('type') == error_type:
                similar_errors.append(e)
                if len(similar_errors) >= 5:
                    break
        
        return {
            'error_details': error,
            'similar_errors': similar_errors,
            'user_friendly_message': self.get_user_friendly_error_message(error),
            'recovery_suggestions': self._get_recovery_suggestions(error),
            'timestamp': timezone.now().isoformat()
        }
    
    def _get_recovery_suggestions(self, error: Dict[str, Any]) -> List[str]:
        """Get recovery suggestions for an error"""
        error_type = error.get('type', '').lower()
        suggestions = []
        
        if 'frontend' in error_type:
            suggestions.extend([
                "Refresh the page and try again",
                "Clear your browser cache",
                "Try using a different browser"
            ])
        elif 'api' in error_type:
            suggestions.extend([
                "Check your internet connection",
                "Try again in a few moments",
                "Contact support if the problem persists"
            ])
        elif 'database' in error_type:
            suggestions.extend([
                "Wait a moment and try again",
                "Check if the service is running",
                "Contact an administrator"
            ])
        else:
            suggestions.append("Try refreshing the page or restarting the application")
        
        return suggestions
    
    def clear_error_log(self):
        """Clear the error log"""
        self.error_log.clear()
        
        # Clear cached errors
        cache_keys = cache.keys()
        error_keys = [key for key in cache_keys if key.startswith('error_')]
        if error_keys:
            cache.delete_many(error_keys)
    
    def export_error_log(self) -> str:
        """Export error log as JSON"""
        export_data = {
            'export_timestamp': timezone.now().isoformat(),
            'total_errors': len(self.error_log),
            'errors': self.error_log
        }
        return json.dumps(export_data, indent=2)
    
    def get_system_health_status(self) -> Dict[str, Any]:
        """Get comprehensive system health status"""
        now = timezone.now()
        startup_time_str = cache.get('django_startup_time')
        
        if startup_time_str:
            startup_time = datetime.fromisoformat(startup_time_str.replace('Z', '+00:00'))
            uptime_seconds = (now - startup_time).total_seconds()
        else:
            uptime_seconds = 0
        
        # Get recent error counts
        recent_errors = self.get_recent_errors(50)
        critical_errors = [e for e in recent_errors if e.get('severity') == 'critical']
        high_errors = [e for e in recent_errors if e.get('severity') == 'high']
        
        # Determine overall status
        if len(critical_errors) > 0:
            overall_status = 'critical'
        elif len(high_errors) > 3:
            overall_status = 'degraded'
        elif len(recent_errors) > 10:
            overall_status = 'warning'
        else:
            overall_status = 'healthy'
        
        return {
            'overall_status': overall_status,
            'uptime_seconds': uptime_seconds,
            'error_counts': {
                'total_recent': len(recent_errors),
                'critical': len(critical_errors),
                'high': len(high_errors)
            },
            'services': {
                'error_handling': 'active',
                'logging': 'active'
            },
            'recovery_status': {
                'auto_recovery_enabled': True,
                'recent_recoveries': len([e for e in recent_errors if e.get('recovery_attempted')])
            },
            'timestamp': now.isoformat()
        }
    
    def check_and_attempt_scheduled_recoveries(self) -> Dict[str, Any]:
        """Check and attempt any scheduled recoveries"""
        # This is a placeholder for scheduled recovery logic
        return {
            'scheduled_recoveries_checked': True,
            'recoveries_attempted': 0,
            'recoveries_successful': 0
        }
    
    def enable_offline_mode(self, reason: str = 'manual') -> bool:
        """Enable offline mode"""
        try:
            cache.set('offline_mode_enabled', True, timeout=None)
            cache.set('offline_mode_reason', reason, timeout=None)
            cache.set('offline_mode_timestamp', timezone.now().isoformat(), timeout=None)
            logger.info(f"Offline mode enabled: {reason}")
            return True
        except Exception as e:
            logger.error(f"Failed to enable offline mode: {e}")
            return False
    
    def disable_offline_mode(self) -> bool:
        """Disable offline mode"""
        try:
            was_offline = cache.get('offline_mode_enabled', False)
            cache.delete('offline_mode_enabled')
            cache.delete('offline_mode_reason')
            cache.delete('offline_mode_timestamp')
            logger.info("Offline mode disabled")
            return was_offline
        except Exception as e:
            logger.error(f"Failed to disable offline mode: {e}")
            return False
    
    def is_offline_mode(self) -> bool:
        """Check if system is in offline mode"""
        return cache.get('offline_mode_enabled', False)
    
    def get_offline_mode_info(self) -> Dict[str, Any]:
        """Get offline mode information"""
        is_offline = self.is_offline_mode()
        return {
            'offline': is_offline,
            'reason': cache.get('offline_mode_reason', '') if is_offline else '',
            'timestamp': cache.get('offline_mode_timestamp', '') if is_offline else '',
            'duration_seconds': 0  # Could calculate based on timestamp
        }
    
    def handle_service_degradation(self, service_name: str, error: Exception, degradation_level: str = 'partial') -> Dict[str, Any]:
        """Handle service degradation"""
        degradation_key = f"service_degradation_{service_name}"
        
        degradation_info = {
            'service_name': service_name,
            'degradation_level': degradation_level,
            'error_message': str(error),
            'timestamp': timezone.now().isoformat(),
            'recovery_attempted': False
        }
        
        # Store degradation info
        cache.set(degradation_key, degradation_info, timeout=3600)  # 1 hour
        
        # Log the degradation
        self.log_error({
            'type': 'service_degradation',
            'message': f"Service {service_name} degraded: {degradation_level}",
            'context': {
                'service_name': service_name,
                'degradation_level': degradation_level,
                'error': str(error)
            }
        })
        
        return {
            'success': True,
            'service_name': service_name,
            'degradation_level': degradation_level,
            'timestamp': degradation_info['timestamp']
        }
    
    def handle_memory_pressure(self) -> bool:
        """Handle memory pressure by cleaning up caches"""
        try:
            # Clear old error cache entries
            cache_keys = cache.keys()
            error_keys = [key for key in cache_keys if key.startswith('error_')]
            
            # Keep only recent errors (last 100)
            if len(error_keys) > 100:
                old_keys = error_keys[100:]
                cache.delete_many(old_keys)
            
            # Trim in-memory error log
            if len(self.error_log) > 500:
                self.error_log = self.error_log[:500]
            
            logger.info("Memory cleanup completed")
            return True
            
        except Exception as e:
            logger.error(f"Memory cleanup failed: {e}")
            return False
    
    def _get_service_recovery_suggestions(self, service_name: str) -> List[str]:
        """Get recovery suggestions for a specific service"""
        suggestions = {
            'api': [
                "Check API endpoint availability",
                "Verify network connectivity",
                "Review API rate limits"
            ],
            'database': [
                "Check database connection",
                "Verify database server status",
                "Review connection pool settings"
            ],
            'frontend': [
                "Refresh the browser page",
                "Clear browser cache",
                "Check JavaScript console for errors"
            ]
        }
        
        return suggestions.get(service_name.lower(), [
            "Restart the service",
            "Check service logs",
            "Verify service configuration"
        ])


# Global instance
error_handling_service = ErrorHandlingService()
# Register default recovery strategies
def database_recovery_strategy(error_entry):
    """Default database error recovery strategy"""
    try:
        from django.db import connection
        
        # Close existing connections to force reconnection
        connection.close()
        
        # Test connection
        connection.ensure_connection()
        
        logger.info("Database recovery successful")
        return True
        
    except Exception as e:
        logger.error(f"Database recovery failed: {e}")
        return False

def api_recovery_strategy(error_entry):
    """Default API error recovery strategy"""
    try:
        # Clear API-related cache
        api_keys = [key for key in cache.keys() if 'api_' in key]
        if api_keys:
            cache.delete_many(api_keys)
        
        # Reset rate limiting if applicable
        rate_limit_keys = [key for key in cache.keys() if 'rate_limit' in key]
        if rate_limit_keys:
            cache.delete_many(rate_limit_keys)
        
        logger.info("API recovery completed")
        return True
        
    except Exception as e:
        logger.error(f"API recovery failed: {e}")
        return False

# Register default strategies
error_handling_service.register_recovery_strategy('database_error', database_recovery_strategy)
error_handling_service.register_recovery_strategy('api_error', api_recovery_strategy)

# Set Django startup time for uptime calculation
cache.set('django_startup_time', timezone.now().isoformat(), timeout=None)