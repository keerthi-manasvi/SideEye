"""
Emotion Analysis Service

This service processes raw emotion data from the frontend and provides:
- Energy level calculation based on emotion combinations
- Emotion trend analysis and pattern detection
- Notification rate limiting logic
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from django.utils import timezone
from django.db.models import Avg, Count
from django.core.cache import cache

from ..models import EmotionReading, UserFeedback, UserPreferences

logger = logging.getLogger(__name__)


class EmotionAnalysisService:
    """
    Service for analyzing emotion data and calculating energy levels
    """
    
    # Emotion weights for energy calculation
    EMOTION_ENERGY_WEIGHTS = {
        'happy': 0.8,
        'surprised': 0.7,
        'neutral': 0.5,
        'disgusted': 0.3,
        'angry': 0.4,
        'fearful': 0.2,
        'sad': 0.1
    }
    
    # Notification rate limits
    NOTIFICATION_RATE_LIMIT = 2  # per 5 minutes
    NOTIFICATION_WINDOW_MINUTES = 5
    WELLNESS_RATE_LIMIT = 1  # per hour
    WELLNESS_WINDOW_MINUTES = 60
    
    def __init__(self):
        self.cache_timeout = 300  # 5 minutes
    
    def calculate_energy_level(self, emotions: Dict[str, float]) -> float:
        """
        Calculate energy level based on emotion probabilities
        
        Args:
            emotions: Dictionary of emotion probabilities
            
        Returns:
            Energy level between 0.0 and 1.0
        """
        try:
            if not emotions:
                logger.warning("Empty emotions dictionary provided")
                return 0.5  # Default neutral energy
            
            # Calculate weighted energy based on emotion probabilities
            total_weighted_energy = 0.0
            total_probability = 0.0
            
            for emotion, probability in emotions.items():
                if emotion in self.EMOTION_ENERGY_WEIGHTS:
                    weight = self.EMOTION_ENERGY_WEIGHTS[emotion]
                    total_weighted_energy += probability * weight
                    total_probability += probability
                else:
                    logger.warning(f"Unknown emotion: {emotion}")
            
            if total_probability == 0:
                logger.warning("No valid emotions found")
                return 0.5
            
            # Normalize by total probability to handle cases where probabilities don't sum to 1
            energy_level = total_weighted_energy / total_probability if total_probability > 0 else 0.5
            
            # Ensure energy level is within bounds
            energy_level = max(0.0, min(1.0, energy_level))
            
            logger.debug(f"Calculated energy level: {energy_level} from emotions: {emotions}")
            return energy_level
            
        except Exception as e:
            logger.error(f"Error calculating energy level: {e}")
            return 0.5  # Default neutral energy on error
    
    def process_emotion_reading(self, emotion_data: Dict) -> Dict:
        """
        Process raw emotion data from frontend and enhance with analysis
        
        Args:
            emotion_data: Raw emotion data from frontend
            
        Returns:
            Enhanced emotion data with calculated energy level and analysis
        """
        try:
            emotions = emotion_data.get('emotions', {})
            
            # Calculate energy level if not provided or recalculate for consistency
            calculated_energy = self.calculate_energy_level(emotions)
            
            # Use provided energy level or calculated one
            energy_level = emotion_data.get('energy_level', calculated_energy)
            
            # Validate and adjust energy level if it differs significantly from calculated
            if abs(energy_level - calculated_energy) > 0.3:
                logger.warning(f"Provided energy level {energy_level} differs significantly from calculated {calculated_energy}")
                energy_level = calculated_energy
            
            # Get dominant emotion
            dominant_emotion = max(emotions.items(), key=lambda x: x[1]) if emotions else ('neutral', 0.5)
            
            # Enhance the data
            enhanced_data = {
                **emotion_data,
                'energy_level': energy_level,
                'calculated_energy': calculated_energy,
                'dominant_emotion': {
                    'emotion': dominant_emotion[0],
                    'probability': dominant_emotion[1]
                },
                'analysis_timestamp': timezone.now().isoformat()
            }
            
            logger.info(f"Processed emotion reading: {dominant_emotion[0]} ({dominant_emotion[1]:.2f}), energy: {energy_level:.2f}")
            return enhanced_data
            
        except Exception as e:
            logger.error(f"Error processing emotion reading: {e}")
            # Return original data with minimal enhancement
            return {
                **emotion_data,
                'energy_level': emotion_data.get('energy_level', 0.5),
                'error': 'Processing failed'
            }
    
    def analyze_emotion_trends(self, hours: int = 24) -> Dict:
        """
        Analyze emotion trends over the specified time period
        
        Args:
            hours: Number of hours to analyze (default: 24)
            
        Returns:
            Dictionary containing trend analysis
        """
        try:
            # Get emotion readings from the specified time period
            since = timezone.now() - timedelta(hours=hours)
            readings = EmotionReading.objects.filter(
                timestamp__gte=since,
                confidence__gte=0.5  # Only include confident readings
            ).order_by('timestamp')
            
            if not readings.exists():
                return {
                    'period_hours': hours,
                    'total_readings': 0,
                    'message': 'No emotion readings found for the specified period'
                }
            
            # Calculate basic statistics
            total_readings = readings.count()
            avg_energy = readings.aggregate(Avg('energy_level'))['energy_level__avg']
            avg_posture = readings.aggregate(Avg('posture_score'))['posture_score__avg']
            avg_blink_rate = readings.aggregate(Avg('blink_rate'))['blink_rate__avg']
            
            # Analyze emotion distribution
            emotion_stats = {}
            energy_over_time = []
            
            for reading in readings:
                # Track energy over time
                energy_over_time.append({
                    'timestamp': reading.timestamp.isoformat(),
                    'energy_level': reading.energy_level,
                    'dominant_emotion': reading.get_dominant_emotion()[0] if reading.get_dominant_emotion() else 'neutral'
                })
                
                # Count emotion occurrences
                dominant = reading.get_dominant_emotion()
                if dominant:
                    emotion = dominant[0]
                    if emotion not in emotion_stats:
                        emotion_stats[emotion] = {'count': 0, 'total_probability': 0.0, 'energy_sum': 0.0}
                    emotion_stats[emotion]['count'] += 1
                    emotion_stats[emotion]['total_probability'] += dominant[1]
                    emotion_stats[emotion]['energy_sum'] += reading.energy_level
            
            # Calculate emotion averages
            for emotion, stats in emotion_stats.items():
                stats['avg_probability'] = stats['total_probability'] / stats['count']
                stats['avg_energy'] = stats['energy_sum'] / stats['count']
                stats['percentage'] = (stats['count'] / total_readings) * 100
            
            # Detect patterns
            patterns = self._detect_patterns(energy_over_time)
            
            # Generate insights
            insights = self._generate_insights(emotion_stats, avg_energy, patterns)
            
            analysis = {
                'period_hours': hours,
                'total_readings': total_readings,
                'averages': {
                    'energy_level': round(avg_energy, 3) if avg_energy else 0,
                    'posture_score': round(avg_posture, 3) if avg_posture else 0,
                    'blink_rate': round(avg_blink_rate, 1) if avg_blink_rate else 0
                },
                'emotion_distribution': emotion_stats,
                'energy_timeline': energy_over_time[-50:],  # Last 50 readings for timeline
                'patterns': patterns,
                'insights': insights,
                'analysis_timestamp': timezone.now().isoformat()
            }
            
            logger.info(f"Generated emotion trend analysis for {hours} hours: {total_readings} readings")
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing emotion trends: {e}")
            return {
                'period_hours': hours,
                'error': 'Failed to analyze trends',
                'message': str(e)
            }
    
    def _detect_patterns(self, energy_timeline: List[Dict]) -> Dict:
        """
        Detect patterns in energy levels over time
        
        Args:
            energy_timeline: List of energy readings with timestamps
            
        Returns:
            Dictionary containing detected patterns
        """
        try:
            if len(energy_timeline) < 3:
                return {'message': 'Insufficient data for pattern detection'}
            
            energy_levels = [reading['energy_level'] for reading in energy_timeline]
            
            # Detect trends
            trend = 'stable'
            if len(energy_levels) >= 5:
                recent_avg = sum(energy_levels[-5:]) / 5
                earlier_avg = sum(energy_levels[:5]) / 5
                
                if recent_avg > earlier_avg + 0.1:
                    trend = 'increasing'
                elif recent_avg < earlier_avg - 0.1:
                    trend = 'decreasing'
            
            # Detect volatility
            if len(energy_levels) >= 10:
                differences = [abs(energy_levels[i] - energy_levels[i-1]) for i in range(1, len(energy_levels))]
                avg_volatility = sum(differences) / len(differences)
                volatility = 'high' if avg_volatility > 0.2 else 'low' if avg_volatility < 0.1 else 'moderate'
            else:
                volatility = 'unknown'
            
            # Detect energy peaks and dips
            peaks = []
            dips = []
            
            for i in range(1, len(energy_levels) - 1):
                if energy_levels[i] > energy_levels[i-1] and energy_levels[i] > energy_levels[i+1]:
                    if energy_levels[i] > 0.7:  # High energy peak
                        peaks.append({
                            'timestamp': energy_timeline[i]['timestamp'],
                            'energy': energy_levels[i],
                            'emotion': energy_timeline[i]['dominant_emotion']
                        })
                elif energy_levels[i] < energy_levels[i-1] and energy_levels[i] < energy_levels[i+1]:
                    if energy_levels[i] < 0.3:  # Low energy dip
                        dips.append({
                            'timestamp': energy_timeline[i]['timestamp'],
                            'energy': energy_levels[i],
                            'emotion': energy_timeline[i]['dominant_emotion']
                        })
            
            return {
                'trend': trend,
                'volatility': volatility,
                'energy_peaks': peaks[-5:],  # Last 5 peaks
                'energy_dips': dips[-5:],    # Last 5 dips
                'current_energy': energy_levels[-1] if energy_levels else 0.5
            }
            
        except Exception as e:
            logger.error(f"Error detecting patterns: {e}")
            return {'error': 'Pattern detection failed'}
    
    def _generate_insights(self, emotion_stats: Dict, avg_energy: float, patterns: Dict) -> List[str]:
        """
        Generate insights based on emotion analysis
        
        Args:
            emotion_stats: Emotion distribution statistics
            avg_energy: Average energy level
            patterns: Detected patterns
            
        Returns:
            List of insight strings
        """
        insights = []
        
        try:
            # Energy level insights
            if avg_energy > 0.7:
                insights.append("You've been maintaining high energy levels - great for tackling complex tasks!")
            elif avg_energy < 0.3:
                insights.append("Your energy levels have been low - consider taking breaks or doing lighter tasks.")
            else:
                insights.append("Your energy levels are balanced - good for a mix of different task types.")
            
            # Dominant emotion insights
            if emotion_stats:
                most_common = max(emotion_stats.items(), key=lambda x: x[1]['count'])
                emotion_name, stats = most_common
                
                if stats['percentage'] > 50:
                    if emotion_name == 'happy':
                        insights.append(f"You've been predominantly happy ({stats['percentage']:.1f}% of the time) - perfect for creative work!")
                    elif emotion_name == 'neutral':
                        insights.append(f"You've been mostly neutral ({stats['percentage']:.1f}% of the time) - good for focused, analytical tasks.")
                    elif emotion_name in ['sad', 'angry']:
                        insights.append(f"You've been experiencing {emotion_name} emotions frequently - consider taking breaks or lighter tasks.")
            
            # Pattern insights
            if patterns.get('trend') == 'increasing':
                insights.append("Your energy trend is increasing - you're building momentum!")
            elif patterns.get('trend') == 'decreasing':
                insights.append("Your energy trend is decreasing - might be time for a break or energy boost.")
            
            if patterns.get('volatility') == 'high':
                insights.append("Your energy levels are quite variable - try to identify what causes the fluctuations.")
            
            # Peak and dip insights
            peaks = patterns.get('energy_peaks', [])
            dips = patterns.get('energy_dips', [])
            
            if len(peaks) > len(dips):
                insights.append("You have more energy peaks than dips - you're managing your energy well!")
            elif len(dips) > len(peaks):
                insights.append("You're experiencing more energy dips - consider what might be draining your energy.")
            
        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            insights.append("Unable to generate insights due to analysis error.")
        
        return insights[:5]  # Limit to 5 insights
    
    def check_notification_rate_limit(self, notification_type: str = 'general') -> Tuple[bool, str]:
        """
        Check if notification rate limits allow sending a new notification
        
        Args:
            notification_type: Type of notification ('general' or 'wellness')
            
        Returns:
            Tuple of (can_send, reason)
        """
        try:
            current_time = timezone.now()
            
            if notification_type == 'wellness':
                # Check wellness notification rate limit (1 per hour)
                cache_key = 'wellness_notifications'
                window_minutes = self.WELLNESS_WINDOW_MINUTES
                rate_limit = self.WELLNESS_RATE_LIMIT
            else:
                # Check general notification rate limit (2 per 5 minutes)
                cache_key = 'general_notifications'
                window_minutes = self.NOTIFICATION_WINDOW_MINUTES
                rate_limit = self.NOTIFICATION_RATE_LIMIT
            
            # Get notification timestamps from cache
            notification_times = cache.get(cache_key, [])
            
            # Remove old notifications outside the window
            window_start = current_time - timedelta(minutes=window_minutes)
            notification_times = [
                timestamp for timestamp in notification_times 
                if timestamp > window_start
            ]
            
            # Check if we can send a new notification
            if len(notification_times) >= rate_limit:
                next_available = notification_times[0] + timedelta(minutes=window_minutes)
                wait_minutes = (next_available - current_time).total_seconds() / 60
                
                return False, f"Rate limit exceeded. Next {notification_type} notification available in {wait_minutes:.1f} minutes."
            
            # Add current notification time and update cache
            notification_times.append(current_time)
            cache.set(cache_key, notification_times, timeout=window_minutes * 60)
            
            logger.info(f"Notification rate limit check passed for {notification_type}: {len(notification_times)}/{rate_limit}")
            return True, "Rate limit check passed"
            
        except Exception as e:
            logger.error(f"Error checking notification rate limit: {e}")
            return False, "Rate limit check failed"
    
    def should_trigger_notification(self, emotion_reading: EmotionReading, user_preferences: Optional[UserPreferences] = None) -> Dict:
        """
        Determine if a notification should be triggered based on emotion reading
        
        Args:
            emotion_reading: Current emotion reading
            user_preferences: User preferences for notifications
            
        Returns:
            Dictionary with notification decision and details
        """
        try:
            if not user_preferences:
                user_preferences = UserPreferences.objects.first()
            
            notifications = []
            
            # Check for wellness notifications
            wellness_triggers = []
            
            # Poor posture check
            if emotion_reading.posture_score < 0.4:
                wellness_triggers.append({
                    'type': 'posture',
                    'message': 'Poor posture detected - time to straighten up!',
                    'severity': 'medium'
                })
            
            # Low blink rate check (eye strain)
            if emotion_reading.blink_rate < 10:  # Less than 10 blinks per minute
                wellness_triggers.append({
                    'type': 'eye_strain',
                    'message': 'Low blink rate detected - give your eyes a break!',
                    'severity': 'medium'
                })
            
            # Very low energy check
            if emotion_reading.energy_level < 0.2:
                wellness_triggers.append({
                    'type': 'low_energy',
                    'message': 'Energy levels are very low - consider taking a break.',
                    'severity': 'high'
                })
            
            # Check wellness notification rate limits
            for trigger in wellness_triggers:
                can_send, reason = self.check_notification_rate_limit('wellness')
                if can_send:
                    notifications.append({
                        'category': 'wellness',
                        'type': trigger['type'],
                        'message': trigger['message'],
                        'severity': trigger['severity'],
                        'timestamp': timezone.now().isoformat()
                    })
                    break  # Only send one wellness notification at a time
            
            # Check for general notifications (mood-based)
            general_triggers = []
            
            dominant_emotion = emotion_reading.get_dominant_emotion()
            if dominant_emotion:
                emotion, probability = dominant_emotion
                
                # High confidence emotion-based notifications
                if probability > 0.7:
                    if emotion == 'happy' and emotion_reading.energy_level > 0.7:
                        general_triggers.append({
                            'type': 'productivity_boost',
                            'message': "You're in a great mood with high energy - perfect time for challenging tasks!",
                            'tone': 'motivational'
                        })
                    elif emotion == 'sad' and emotion_reading.energy_level < 0.4:
                        general_triggers.append({
                            'type': 'mood_support',
                            'message': "Feeling down? Maybe some uplifting music or a quick break would help.",
                            'tone': 'supportive'
                        })
                    elif emotion == 'angry':
                        general_triggers.append({
                            'type': 'anger_management',
                            'message': "Detected some frustration - perhaps a calming playlist or a short walk?",
                            'tone': 'calming'
                        })
            
            # Check general notification rate limits
            for trigger in general_triggers:
                can_send, reason = self.check_notification_rate_limit('general')
                if can_send:
                    # Adjust message tone based on user preferences
                    tone = user_preferences.notification_tone if user_preferences else 'balanced'
                    adjusted_message = self._adjust_message_tone(trigger['message'], tone)
                    
                    notifications.append({
                        'category': 'general',
                        'type': trigger['type'],
                        'message': adjusted_message,
                        'tone': tone,
                        'timestamp': timezone.now().isoformat()
                    })
                    break  # Only send one general notification at a time
            
            result = {
                'should_notify': len(notifications) > 0,
                'notifications': notifications,
                'emotion_context': {
                    'dominant_emotion': dominant_emotion[0] if dominant_emotion else 'neutral',
                    'energy_level': emotion_reading.energy_level,
                    'posture_score': emotion_reading.posture_score,
                    'blink_rate': emotion_reading.blink_rate
                }
            }
            
            if notifications:
                logger.info(f"Triggered {len(notifications)} notifications for emotion reading")
            
            return result
            
        except Exception as e:
            logger.error(f"Error determining notification triggers: {e}")
            return {
                'should_notify': False,
                'notifications': [],
                'error': 'Failed to determine notification triggers'
            }
    
    def _adjust_message_tone(self, message: str, tone: str) -> str:
        """
        Adjust notification message based on user's preferred tone
        
        Args:
            message: Original message
            tone: Preferred tone ('sarcastic', 'motivational', 'balanced', 'minimal')
            
        Returns:
            Adjusted message
        """
        try:
            if tone == 'sarcastic':
                # Add sarcastic elements
                sarcastic_prefixes = [
                    "Oh look, ",
                    "Well well, ",
                    "Surprise! ",
                    "Fancy that, "
                ]
                import random
                return random.choice(sarcastic_prefixes) + message.lower()
            
            elif tone == 'motivational':
                # Add motivational elements
                motivational_prefixes = [
                    "You've got this! ",
                    "Great opportunity: ",
                    "Time to shine! ",
                    "Let's make it happen! "
                ]
                import random
                return random.choice(motivational_prefixes) + message
            
            elif tone == 'minimal':
                # Simplify message
                return message.split('.')[0] + '.'  # Just the first sentence
            
            else:  # balanced
                return message
                
        except Exception as e:
            logger.error(f"Error adjusting message tone: {e}")
            return message