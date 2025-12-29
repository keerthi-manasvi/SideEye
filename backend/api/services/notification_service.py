"""
Notification Service

This service handles notification scheduling, rate limiting, and delivery
with personality-based message generation.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from django.utils import timezone
from django.core.cache import cache
from django.db.models import Q

from ..models import UserPreferences, EmotionReading

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Service for managing notifications with rate limiting and personality
    """
    
    # Rate limiting constants
    GENERAL_RATE_LIMIT = 2  # notifications per 5 minutes
    GENERAL_WINDOW_MINUTES = 5
    WELLNESS_RATE_LIMIT = 1  # notifications per hour
    WELLNESS_WINDOW_MINUTES = 60
    
    # Notification queue cache key
    NOTIFICATION_QUEUE_KEY = 'notification_queue'
    
    def __init__(self):
        self.cache_timeout = 3600  # 1 hour
    
    def schedule_notification(self, notification_data: Dict) -> Dict:
        """
        Schedule a notification with rate limiting
        
        Args:
            notification_data: Notification details
            
        Returns:
            Dictionary with scheduling result
        """
        try:
            notification_type = notification_data.get('category', 'general')
            
            # Check rate limits
            can_send, reason = self._check_rate_limit(notification_type)
            
            if can_send:
                # Send immediately
                result = self._send_notification(notification_data)
                self._update_rate_limit_cache(notification_type)
                
                logger.info(f"Notification sent immediately: {notification_data.get('type', 'unknown')}")
                return {
                    'status': 'sent',
                    'notification': result,
                    'message': 'Notification sent successfully'
                }
            else:
                # Queue for later
                self._queue_notification(notification_data)
                
                logger.info(f"Notification queued due to rate limit: {notification_data.get('type', 'unknown')}")
                return {
                    'status': 'queued',
                    'message': reason,
                    'notification': notification_data
                }
                
        except Exception as e:
            logger.error(f"Error scheduling notification: {e}")
            return {
                'status': 'error',
                'message': f'Failed to schedule notification: {str(e)}'
            }
    
    def process_notification_queue(self) -> Dict:
        """
        Process queued notifications that can now be sent
        
        Returns:
            Dictionary with processing results
        """
        try:
            queue = cache.get(self.NOTIFICATION_QUEUE_KEY, [])
            
            if not queue:
                return {
                    'processed': 0,
                    'remaining': 0,
                    'message': 'No notifications in queue'
                }
            
            sent_notifications = []
            remaining_queue = []
            
            for notification in queue:
                notification_type = notification.get('category', 'general')
                can_send, reason = self._check_rate_limit(notification_type)
                
                if can_send:
                    # Send the notification
                    result = self._send_notification(notification)
                    self._update_rate_limit_cache(notification_type)
                    sent_notifications.append(result)
                    
                    # Only send one notification per processing cycle to respect rate limits
                    remaining_queue.extend(queue[queue.index(notification) + 1:])
                    break
                else:
                    # Check if notification is too old (older than 1 hour)
                    notification_time = datetime.fromisoformat(notification.get('timestamp', timezone.now().isoformat()))
                    if timezone.now() - notification_time > timedelta(hours=1):
                        logger.info(f"Dropping old notification: {notification.get('type', 'unknown')}")
                        continue  # Drop old notifications
                    
                    remaining_queue.append(notification)
            
            # Update queue
            cache.set(self.NOTIFICATION_QUEUE_KEY, remaining_queue, timeout=self.cache_timeout)
            
            logger.info(f"Processed notification queue: {len(sent_notifications)} sent, {len(remaining_queue)} remaining")
            
            return {
                'processed': len(sent_notifications),
                'remaining': len(remaining_queue),
                'sent_notifications': sent_notifications,
                'message': f'Processed {len(sent_notifications)} notifications'
            }
            
        except Exception as e:
            logger.error(f"Error processing notification queue: {e}")
            return {
                'processed': 0,
                'remaining': 0,
                'error': f'Failed to process queue: {str(e)}'
            }
    
    def get_notification_status(self) -> Dict:
        """
        Get current notification system status
        
        Returns:
            Dictionary with notification system status
        """
        try:
            # Get rate limit status
            general_times = cache.get('general_notifications', [])
            wellness_times = cache.get('wellness_notifications', [])
            
            # Clean old timestamps
            current_time = timezone.now()
            general_times = [t for t in general_times if current_time - t < timedelta(minutes=self.GENERAL_WINDOW_MINUTES)]
            wellness_times = [t for t in wellness_times if current_time - t < timedelta(minutes=self.WELLNESS_WINDOW_MINUTES)]
            
            # Get queue status
            queue = cache.get(self.NOTIFICATION_QUEUE_KEY, [])
            
            # Calculate next available times
            next_general = None
            next_wellness = None
            
            if len(general_times) >= self.GENERAL_RATE_LIMIT:
                next_general = general_times[0] + timedelta(minutes=self.GENERAL_WINDOW_MINUTES)
            
            if len(wellness_times) >= self.WELLNESS_RATE_LIMIT:
                next_wellness = wellness_times[0] + timedelta(minutes=self.WELLNESS_WINDOW_MINUTES)
            
            return {
                'rate_limits': {
                    'general': {
                        'current': len(general_times),
                        'limit': self.GENERAL_RATE_LIMIT,
                        'window_minutes': self.GENERAL_WINDOW_MINUTES,
                        'next_available': next_general.isoformat() if next_general else None
                    },
                    'wellness': {
                        'current': len(wellness_times),
                        'limit': self.WELLNESS_RATE_LIMIT,
                        'window_minutes': self.WELLNESS_WINDOW_MINUTES,
                        'next_available': next_wellness.isoformat() if next_wellness else None
                    }
                },
                'queue': {
                    'size': len(queue),
                    'notifications': queue
                },
                'status': 'active',
                'timestamp': current_time.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting notification status: {e}")
            return {
                'status': 'error',
                'message': f'Failed to get status: {str(e)}'
            }
    
    def generate_contextual_message(self, message_type: str, context: Dict, user_preferences: Optional[UserPreferences] = None) -> str:
        """
        Generate contextual notification messages with personality
        
        Args:
            message_type: Type of message to generate
            context: Context data (emotion, energy, etc.)
            user_preferences: User notification preferences
            
        Returns:
            Generated message string
        """
        try:
            tone = user_preferences.notification_tone if user_preferences else 'balanced'
            
            # Base messages for different types
            base_messages = {
                'productivity_boost': [
                    "You're in a great mood with high energy - perfect time for challenging tasks!",
                    "High energy detected - time to tackle that complex project!",
                    "You're feeling good and energized - make the most of it!"
                ],
                'mood_support': [
                    "Feeling down? Maybe some uplifting music or a quick break would help.",
                    "Low energy detected - consider a mood-boosting activity.",
                    "Time for some self-care - you deserve it!"
                ],
                'posture_reminder': [
                    "Poor posture detected - time to straighten up!",
                    "Your back will thank you for sitting up straight.",
                    "Posture check! Adjust your position for better health."
                ],
                'eye_strain': [
                    "Low blink rate detected - give your eyes a break!",
                    "Your eyes need a rest - try the 20-20-20 rule.",
                    "Blink more often to keep your eyes healthy!"
                ],
                'energy_low': [
                    "Energy levels are very low - consider taking a break.",
                    "Time to recharge - step away from the screen.",
                    "Low energy alert - maybe grab a healthy snack?"
                ]
            }
            
            # Get base message
            messages = base_messages.get(message_type, ["System notification"])
            import random
            base_message = random.choice(messages)
            
            # Adjust for tone
            return self._apply_personality_tone(base_message, tone, context)
            
        except Exception as e:
            logger.error(f"Error generating contextual message: {e}")
            return "System notification"
    
    def _check_rate_limit(self, notification_type: str) -> tuple:
        """
        Check if notification can be sent based on rate limits
        
        Args:
            notification_type: Type of notification ('general' or 'wellness')
            
        Returns:
            Tuple of (can_send: bool, reason: str)
        """
        try:
            current_time = timezone.now()
            
            if notification_type == 'wellness':
                cache_key = 'wellness_notifications'
                window_minutes = self.WELLNESS_WINDOW_MINUTES
                rate_limit = self.WELLNESS_RATE_LIMIT
            else:
                cache_key = 'general_notifications'
                window_minutes = self.GENERAL_WINDOW_MINUTES
                rate_limit = self.GENERAL_RATE_LIMIT
            
            # Get notification timestamps from cache
            notification_times = cache.get(cache_key, [])
            
            # Remove old notifications outside the window
            window_start = current_time - timedelta(minutes=window_minutes)
            notification_times = [
                timestamp for timestamp in notification_times 
                if timestamp > window_start
            ]
            
            # Update cache with cleaned timestamps
            cache.set(cache_key, notification_times, timeout=window_minutes * 60)
            
            # Check if we can send a new notification
            if len(notification_times) >= rate_limit:
                next_available = notification_times[0] + timedelta(minutes=window_minutes)
                wait_minutes = (next_available - current_time).total_seconds() / 60
                
                return False, f"Rate limit exceeded. Next {notification_type} notification available in {wait_minutes:.1f} minutes."
            
            return True, "Rate limit check passed"
            
        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            return False, "Rate limit check failed"
    
    def _update_rate_limit_cache(self, notification_type: str):
        """
        Update rate limit cache with new notification timestamp
        
        Args:
            notification_type: Type of notification
        """
        try:
            current_time = timezone.now()
            
            if notification_type == 'wellness':
                cache_key = 'wellness_notifications'
                window_minutes = self.WELLNESS_WINDOW_MINUTES
            else:
                cache_key = 'general_notifications'
                window_minutes = self.GENERAL_WINDOW_MINUTES
            
            # Get current timestamps
            notification_times = cache.get(cache_key, [])
            
            # Add new timestamp
            notification_times.append(current_time)
            
            # Update cache
            cache.set(cache_key, notification_times, timeout=window_minutes * 60)
            
        except Exception as e:
            logger.error(f"Error updating rate limit cache: {e}")
    
    def _queue_notification(self, notification_data: Dict):
        """
        Add notification to queue for later processing
        
        Args:
            notification_data: Notification to queue
        """
        try:
            queue = cache.get(self.NOTIFICATION_QUEUE_KEY, [])
            
            # Add timestamp if not present
            if 'timestamp' not in notification_data:
                notification_data['timestamp'] = timezone.now().isoformat()
            
            queue.append(notification_data)
            
            # Limit queue size (keep only last 50 notifications)
            if len(queue) > 50:
                queue = queue[-50:]
            
            cache.set(self.NOTIFICATION_QUEUE_KEY, queue, timeout=self.cache_timeout)
            
        except Exception as e:
            logger.error(f"Error queuing notification: {e}")
    
    def _send_notification(self, notification_data: Dict) -> Dict:
        """
        Send notification (placeholder for actual notification delivery)
        
        Args:
            notification_data: Notification to send
            
        Returns:
            Dictionary with send result
        """
        try:
            # In a real implementation, this would send the notification
            # to the frontend via WebSocket, push notification, etc.
            
            # For now, just log and return success
            logger.info(f"Sending notification: {notification_data.get('message', 'No message')}")
            
            return {
                **notification_data,
                'sent_at': timezone.now().isoformat(),
                'status': 'delivered'
            }
            
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
            return {
                **notification_data,
                'status': 'failed',
                'error': str(e)
            }
    
    def _apply_personality_tone(self, message: str, tone: str, context: Dict) -> str:
        """
        Apply personality tone to notification message
        
        Args:
            message: Base message
            tone: Desired tone
            context: Context for personalization
            
        Returns:
            Message with applied tone
        """
        try:
            if tone == 'sarcastic':
                sarcastic_prefixes = [
                    "Oh look, ",
                    "Well well, ",
                    "Surprise! ",
                    "Fancy that, ",
                    "How shocking, "
                ]
                sarcastic_suffixes = [
                    " Who would have thought?",
                    " What a revelation!",
                    " I'm sure you're thrilled.",
                    " How unexpected!"
                ]
                
                import random
                prefix = random.choice(sarcastic_prefixes)
                suffix = random.choice(sarcastic_suffixes) if random.random() > 0.5 else ""
                
                return prefix + message.lower() + suffix
            
            elif tone == 'motivational':
                motivational_prefixes = [
                    "You've got this! ",
                    "Great opportunity: ",
                    "Time to shine! ",
                    "Let's make it happen! ",
                    "Here's your chance: ",
                    "Ready to excel? "
                ]
                motivational_suffixes = [
                    " You can do it!",
                    " Make it count!",
                    " Show your best self!",
                    " Success awaits!"
                ]
                
                import random
                prefix = random.choice(motivational_prefixes)
                suffix = random.choice(motivational_suffixes) if random.random() > 0.6 else ""
                
                return prefix + message + suffix
            
            elif tone == 'minimal':
                # Simplify message - just the core information
                sentences = message.split('.')
                return sentences[0].strip() + '.'
            
            else:  # balanced
                # Add context-aware personalization
                energy = context.get('energy_level', 0.5)
                
                if energy > 0.7:
                    return f"High energy detected! {message}"
                elif energy < 0.3:
                    return f"Low energy noticed. {message}"
                else:
                    return message
                    
        except Exception as e:
            logger.error(f"Error applying personality tone: {e}")
            return message