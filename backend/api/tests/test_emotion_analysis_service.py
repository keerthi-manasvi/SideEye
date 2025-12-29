"""
Unit tests for EmotionAnalysisService
"""

import unittest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from django.core.cache import cache
from datetime import timedelta
import json

from ..models import EmotionReading, UserPreferences, UserFeedback
from ..services.emotion_analysis_service import EmotionAnalysisService


class EmotionAnalysisServiceTestCase(TestCase):
    """Test cases for EmotionAnalysisService"""
    
    def setUp(self):
        """Set up test data"""
        self.service = EmotionAnalysisService()
        
        # Clear cache before each test
        cache.clear()
        
        # Sample emotion data
        self.sample_emotions = {
            'happy': 0.7,
            'neutral': 0.2,
            'sad': 0.1
        }
        
        self.sample_emotion_data = {
            'emotions': self.sample_emotions,
            'energy_level': 0.6,
            'posture_score': 0.8,
            'blink_rate': 15.0,
            'confidence': 0.9
        }
        
        # Create test user preferences
        self.user_preferences = UserPreferences.objects.create(
            notification_frequency=5,
            wellness_reminder_interval=60,
            notification_tone='balanced'
        )
    
    def tearDown(self):
        """Clean up after each test"""
        cache.clear()
    
    def test_calculate_energy_level_happy_emotions(self):
        """Test energy calculation with happy emotions"""
        emotions = {'happy': 0.8, 'neutral': 0.2}
        energy = self.service.calculate_energy_level(emotions)
        
        # Happy emotions should result in higher energy
        self.assertGreater(energy, 0.6)
        self.assertLessEqual(energy, 1.0)
    
    def test_calculate_energy_level_sad_emotions(self):
        """Test energy calculation with sad emotions"""
        emotions = {'sad': 0.8, 'neutral': 0.2}
        energy = self.service.calculate_energy_level(emotions)
        
        # Sad emotions should result in lower energy
        self.assertLess(energy, 0.4)
        self.assertGreaterEqual(energy, 0.0)
    
    def test_calculate_energy_level_mixed_emotions(self):
        """Test energy calculation with mixed emotions"""
        emotions = {
            'happy': 0.3,
            'sad': 0.3,
            'neutral': 0.4
        }
        energy = self.service.calculate_energy_level(emotions)
        
        # Mixed emotions should result in moderate energy
        self.assertGreater(energy, 0.2)
        self.assertLess(energy, 0.8)
    
    def test_calculate_energy_level_empty_emotions(self):
        """Test energy calculation with empty emotions"""
        emotions = {}
        energy = self.service.calculate_energy_level(emotions)
        
        # Empty emotions should return default neutral energy
        self.assertEqual(energy, 0.5)
    
    def test_calculate_energy_level_unknown_emotions(self):
        """Test energy calculation with unknown emotions"""
        emotions = {'unknown_emotion': 0.8, 'another_unknown': 0.2}
        energy = self.service.calculate_energy_level(emotions)
        
        # Unknown emotions should return default neutral energy
        self.assertEqual(energy, 0.5)
    
    def test_process_emotion_reading_valid_data(self):
        """Test processing valid emotion reading data"""
        result = self.service.process_emotion_reading(self.sample_emotion_data)
        
        self.assertIn('energy_level', result)
        self.assertIn('calculated_energy', result)
        self.assertIn('dominant_emotion', result)
        self.assertIn('analysis_timestamp', result)
        
        # Check dominant emotion
        dominant = result['dominant_emotion']
        self.assertEqual(dominant['emotion'], 'happy')
        self.assertEqual(dominant['probability'], 0.7)
    
    def test_process_emotion_reading_recalculate_energy(self):
        """Test that energy level is recalculated if significantly different"""
        # Provide energy level that differs significantly from calculated
        data = {
            **self.sample_emotion_data,
            'energy_level': 0.1  # Very low, but emotions suggest high energy
        }
        
        result = self.service.process_emotion_reading(data)
        
        # Energy should be recalculated based on emotions
        self.assertNotEqual(result['energy_level'], 0.1)
        self.assertGreater(result['energy_level'], 0.5)
    
    def test_process_emotion_reading_invalid_data(self):
        """Test processing invalid emotion reading data"""
        invalid_data = {'invalid': 'data'}
        
        result = self.service.process_emotion_reading(invalid_data)
        
        # Should return original data with error handling
        self.assertIn('energy_level', result)
        self.assertEqual(result['energy_level'], 0.5)  # Default
    
    def test_analyze_emotion_trends_no_data(self):
        """Test emotion trend analysis with no data"""
        result = self.service.analyze_emotion_trends(24)
        
        self.assertEqual(result['total_readings'], 0)
        self.assertIn('message', result)
    
    def test_analyze_emotion_trends_with_data(self):
        """Test emotion trend analysis with sample data"""
        # Create test emotion readings
        for i in range(5):
            EmotionReading.objects.create(
                emotions={'happy': 0.6 + i * 0.1, 'neutral': 0.4 - i * 0.1},
                energy_level=0.5 + i * 0.1,
                posture_score=0.7,
                blink_rate=15.0,
                confidence=0.8
            )
        
        result = self.service.analyze_emotion_trends(24)
        
        self.assertEqual(result['total_readings'], 5)
        self.assertIn('averages', result)
        self.assertIn('emotion_distribution', result)
        self.assertIn('energy_timeline', result)
        self.assertIn('patterns', result)
        self.assertIn('insights', result)
        
        # Check averages
        averages = result['averages']
        self.assertIn('energy_level', averages)
        self.assertIn('posture_score', averages)
        self.assertIn('blink_rate', averages)
        
        # Check emotion distribution
        emotion_dist = result['emotion_distribution']
        self.assertIn('happy', emotion_dist)
        self.assertEqual(emotion_dist['happy']['count'], 5)
    
    def test_detect_patterns_increasing_trend(self):
        """Test pattern detection with increasing energy trend"""
        # Create timeline with increasing energy
        timeline = []
        for i in range(10):
            timeline.append({
                'timestamp': timezone.now().isoformat(),
                'energy_level': 0.3 + i * 0.05,
                'dominant_emotion': 'happy'
            })
        
        patterns = self.service._detect_patterns(timeline)
        
        self.assertEqual(patterns['trend'], 'increasing')
        self.assertIn('volatility', patterns)
        self.assertIn('current_energy', patterns)
    
    def test_detect_patterns_decreasing_trend(self):
        """Test pattern detection with decreasing energy trend"""
        # Create timeline with decreasing energy
        timeline = []
        for i in range(10):
            timeline.append({
                'timestamp': timezone.now().isoformat(),
                'energy_level': 0.8 - i * 0.05,
                'dominant_emotion': 'sad'
            })
        
        patterns = self.service._detect_patterns(timeline)
        
        self.assertEqual(patterns['trend'], 'decreasing')
    
    def test_detect_patterns_insufficient_data(self):
        """Test pattern detection with insufficient data"""
        timeline = [
            {
                'timestamp': timezone.now().isoformat(),
                'energy_level': 0.5,
                'dominant_emotion': 'neutral'
            }
        ]
        
        patterns = self.service._detect_patterns(timeline)
        
        self.assertIn('message', patterns)
    
    def test_generate_insights_high_energy(self):
        """Test insight generation for high energy levels"""
        emotion_stats = {
            'happy': {'count': 10, 'percentage': 80.0}
        }
        
        insights = self.service._generate_insights(emotion_stats, 0.8, {})
        
        self.assertIsInstance(insights, list)
        self.assertGreater(len(insights), 0)
        # Should contain insight about high energy
        high_energy_insight = any('high energy' in insight.lower() for insight in insights)
        self.assertTrue(high_energy_insight)
    
    def test_generate_insights_low_energy(self):
        """Test insight generation for low energy levels"""
        emotion_stats = {
            'sad': {'count': 10, 'percentage': 80.0}
        }
        
        insights = self.service._generate_insights(emotion_stats, 0.2, {})
        
        self.assertIsInstance(insights, list)
        self.assertGreater(len(insights), 0)
        # Should contain insight about low energy
        low_energy_insight = any('low' in insight.lower() for insight in insights)
        self.assertTrue(low_energy_insight)
    
    def test_check_notification_rate_limit_general_allowed(self):
        """Test general notification rate limit when allowed"""
        can_send, reason = self.service.check_notification_rate_limit('general')
        
        self.assertTrue(can_send)
        self.assertEqual(reason, "Rate limit check passed")
    
    def test_check_notification_rate_limit_general_exceeded(self):
        """Test general notification rate limit when exceeded"""
        # Fill up the rate limit
        current_time = timezone.now()
        notification_times = [current_time, current_time]
        cache.set('general_notifications', notification_times, timeout=300)
        
        can_send, reason = self.service.check_notification_rate_limit('general')
        
        self.assertFalse(can_send)
        self.assertIn('Rate limit exceeded', reason)
    
    def test_check_notification_rate_limit_wellness_allowed(self):
        """Test wellness notification rate limit when allowed"""
        can_send, reason = self.service.check_notification_rate_limit('wellness')
        
        self.assertTrue(can_send)
        self.assertEqual(reason, "Rate limit check passed")
    
    def test_check_notification_rate_limit_wellness_exceeded(self):
        """Test wellness notification rate limit when exceeded"""
        # Fill up the wellness rate limit
        current_time = timezone.now()
        notification_times = [current_time]
        cache.set('wellness_notifications', notification_times, timeout=3600)
        
        can_send, reason = self.service.check_notification_rate_limit('wellness')
        
        self.assertFalse(can_send)
        self.assertIn('Rate limit exceeded', reason)
    
    def test_should_trigger_notification_poor_posture(self):
        """Test notification trigger for poor posture"""
        # Create emotion reading with poor posture
        emotion_reading = EmotionReading.objects.create(
            emotions={'neutral': 1.0},
            energy_level=0.5,
            posture_score=0.3,  # Poor posture
            blink_rate=15.0,
            confidence=0.8
        )
        
        result = self.service.should_trigger_notification(emotion_reading, self.user_preferences)
        
        self.assertTrue(result['should_notify'])
        self.assertGreater(len(result['notifications']), 0)
        
        # Check for posture notification
        posture_notification = any(
            notif['type'] == 'posture' for notif in result['notifications']
        )
        self.assertTrue(posture_notification)
    
    def test_should_trigger_notification_low_blink_rate(self):
        """Test notification trigger for low blink rate"""
        # Create emotion reading with low blink rate
        emotion_reading = EmotionReading.objects.create(
            emotions={'neutral': 1.0},
            energy_level=0.5,
            posture_score=0.8,
            blink_rate=5.0,  # Low blink rate
            confidence=0.8
        )
        
        result = self.service.should_trigger_notification(emotion_reading, self.user_preferences)
        
        self.assertTrue(result['should_notify'])
        
        # Check for eye strain notification
        eye_strain_notification = any(
            notif['type'] == 'eye_strain' for notif in result['notifications']
        )
        self.assertTrue(eye_strain_notification)
    
    def test_should_trigger_notification_very_low_energy(self):
        """Test notification trigger for very low energy"""
        # Create emotion reading with very low energy
        emotion_reading = EmotionReading.objects.create(
            emotions={'sad': 0.8, 'neutral': 0.2},
            energy_level=0.1,  # Very low energy
            posture_score=0.8,
            blink_rate=15.0,
            confidence=0.8
        )
        
        result = self.service.should_trigger_notification(emotion_reading, self.user_preferences)
        
        self.assertTrue(result['should_notify'])
        
        # Check for low energy notification
        low_energy_notification = any(
            notif['type'] == 'low_energy' for notif in result['notifications']
        )
        self.assertTrue(low_energy_notification)
    
    def test_should_trigger_notification_happy_high_energy(self):
        """Test notification trigger for happy mood with high energy"""
        # Create emotion reading with happy mood and high energy
        emotion_reading = EmotionReading.objects.create(
            emotions={'happy': 0.8, 'neutral': 0.2},
            energy_level=0.8,  # High energy
            posture_score=0.8,
            blink_rate=15.0,
            confidence=0.8
        )
        
        result = self.service.should_trigger_notification(emotion_reading, self.user_preferences)
        
        # Should trigger productivity boost notification
        if result['should_notify']:
            productivity_notification = any(
                notif['type'] == 'productivity_boost' for notif in result['notifications']
            )
            self.assertTrue(productivity_notification)
    
    def test_should_trigger_notification_no_triggers(self):
        """Test notification trigger with normal readings"""
        # Create normal emotion reading
        emotion_reading = EmotionReading.objects.create(
            emotions={'neutral': 0.8, 'happy': 0.2},
            energy_level=0.5,
            posture_score=0.7,
            blink_rate=15.0,
            confidence=0.8
        )
        
        result = self.service.should_trigger_notification(emotion_reading, self.user_preferences)
        
        # Should not trigger notifications for normal readings
        self.assertFalse(result['should_notify'])
        self.assertEqual(len(result['notifications']), 0)
    
    def test_adjust_message_tone_sarcastic(self):
        """Test message tone adjustment for sarcastic tone"""
        message = "You need to take a break."
        adjusted = self.service._adjust_message_tone(message, 'sarcastic')
        
        self.assertNotEqual(adjusted, message)
        self.assertTrue(adjusted.lower().startswith(('oh look', 'well well', 'surprise', 'fancy that')))
    
    def test_adjust_message_tone_motivational(self):
        """Test message tone adjustment for motivational tone"""
        message = "Time to work on challenging tasks."
        adjusted = self.service._adjust_message_tone(message, 'motivational')
        
        self.assertNotEqual(adjusted, message)
        self.assertTrue(any(prefix in adjusted for prefix in [
            "You've got this!", "Great opportunity:", "Time to shine!", "Let's make it happen!"
        ]))
    
    def test_adjust_message_tone_minimal(self):
        """Test message tone adjustment for minimal tone"""
        message = "You need to take a break. This is important for your health."
        adjusted = self.service._adjust_message_tone(message, 'minimal')
        
        # Should only keep first sentence
        self.assertEqual(adjusted, "You need to take a break.")
    
    def test_adjust_message_tone_balanced(self):
        """Test message tone adjustment for balanced tone"""
        message = "You need to take a break."
        adjusted = self.service._adjust_message_tone(message, 'balanced')
        
        # Balanced tone should return original message
        self.assertEqual(adjusted, message)
    
    def test_emotion_energy_weights_coverage(self):
        """Test that all expected emotions have energy weights"""
        expected_emotions = ['happy', 'surprised', 'neutral', 'disgusted', 'angry', 'fearful', 'sad']
        
        for emotion in expected_emotions:
            self.assertIn(emotion, self.service.EMOTION_ENERGY_WEIGHTS)
            weight = self.service.EMOTION_ENERGY_WEIGHTS[emotion]
            self.assertGreaterEqual(weight, 0.0)
            self.assertLessEqual(weight, 1.0)
    
    def test_rate_limit_constants(self):
        """Test that rate limit constants are properly defined"""
        self.assertEqual(self.service.NOTIFICATION_RATE_LIMIT, 2)
        self.assertEqual(self.service.NOTIFICATION_WINDOW_MINUTES, 5)
        self.assertEqual(self.service.WELLNESS_RATE_LIMIT, 1)
        self.assertEqual(self.service.WELLNESS_WINDOW_MINUTES, 60)
    
    @patch('backend.api.services.emotion_analysis_service.logger')
    def test_error_handling_in_calculate_energy(self, mock_logger):
        """Test error handling in calculate_energy_level method"""
        # Test with invalid emotion data that might cause an exception
        with patch.object(self.service, 'EMOTION_ENERGY_WEIGHTS', side_effect=Exception("Test error")):
            energy = self.service.calculate_energy_level({'happy': 0.8})
            
            # Should return default energy on error
            self.assertEqual(energy, 0.5)
            mock_logger.error.assert_called()
    
    @patch('backend.api.services.emotion_analysis_service.logger')
    def test_error_handling_in_process_emotion_reading(self, mock_logger):
        """Test error handling in process_emotion_reading method"""
        # Test with data that causes an exception
        with patch.object(self.service, 'calculate_energy_level', side_effect=Exception("Test error")):
            result = self.service.process_emotion_reading(self.sample_emotion_data)
            
            # Should return original data with error handling
            self.assertIn('error', result)
            mock_logger.error.assert_called()
    
    def test_cache_integration(self):
        """Test that the service properly integrates with Django cache"""
        # Test rate limiting uses cache
        can_send1, _ = self.service.check_notification_rate_limit('general')
        self.assertTrue(can_send1)
        
        # Check that cache was updated
        cached_times = cache.get('general_notifications', [])
        self.assertEqual(len(cached_times), 1)
        
        # Test second notification
        can_send2, _ = self.service.check_notification_rate_limit('general')
        self.assertTrue(can_send2)  # Should still be allowed (limit is 2)
        
        # Check cache again
        cached_times = cache.get('general_notifications', [])
        self.assertEqual(len(cached_times), 2)
        
        # Test third notification (should be blocked)
        can_send3, reason = self.service.check_notification_rate_limit('general')
        self.assertFalse(can_send3)
        self.assertIn('Rate limit exceeded', reason)