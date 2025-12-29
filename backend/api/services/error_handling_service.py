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