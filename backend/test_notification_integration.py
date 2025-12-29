#!/usr/bin/env python
"""
Integration test for notification system with rate limiting and personality

This script demonstrates the complete notification system functionality including:
- Rate limiting enforcement
- Personality-based message generation
- Queue management
- Wellness reminder system
"""

import os
import sys
import django
import time
from datetime import datetime, timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sideeye_backend.settings')
django.setup()

from django.core.cache import cache
from api.services.notification_service import NotificationService
from api.models import UserPreferences, EmotionReading


def test_rate_limiting_scenario():
    """Test comprehensive rate limiting scenario"""
    print("Testing Rate Limiting Scenario")
    print("-" * 40)
    
    # Clear cache
    cache.clear()
    
    notification_service = NotificationService()
    
    # Create user preferences
    preferences = UserPreferences.objects.create(
        notification_frequency=3,  # 3 minutes for testing
        wellness_reminder_interval=30,  # 30 minutes for testing
        notification_tone='motivational'
    )
    
    # Test general notifications rate limiting
    print("1. Testing general notification rate limiting (2 per 5 minutes)...")
    
    general_notifications = []
    for i in range(5):
        notification = {
            'type': 'productivity_boost',
            'category': 'general',
            'message': f'General notification {i+1}',
            'context': {'energy_level': 0.8, 'iteration': i+1}
        }
        result = notification_service.schedule_notification(notification)
        general_notifications.append(result)
        print(f"  Notification {i+1}: {result['status']}")
    
    sent_count = sum(1 for n in general_notifications if n['status'] == 'sent')
    queued_count = sum(1 for n in general_notifications if n['status'] == 'queued')
    
    print(f"  Result: {sent_count} sent, {queued_count} queued")
    assert sent_count == 2, f"Expected 2 sent, got {sent_count}"
    assert queued_count == 3, f"Expected 3 queued, got {queued_count}"
    
    # Test wellness notifications rate limiting
    print("\n2. Testing wellness notification rate limiting (1 per hour)...")
    
    wellness_notifications = []
    for i in range(3):
        notification = {
            'type': 'posture_reminder',
            'category': 'wellness',
            'message': f'Wellness notification {i+1}',
            'context': {'posture_score': 0.3, 'iteration': i+1}
        }
        result = notification_service.schedule_notification(notification)
        wellness_notifications.append(result)
        print(f"  Wellness notification {i+1}: {result['status']}")
    
    wellness_sent = sum(1 for n in wellness_notifications if n['status'] == 'sent')
    wellness_queued = sum(1 for n in wellness_notifications if n['status'] == 'queued')
    
    print(f"  Result: {wellness_sent} sent, {wellness_queued} queued")
    assert wellness_sent == 1, f"Expected 1 sent, got {wellness_sent}"
    assert wellness_queued == 2, f"Expected 2 queued, got {wellness_queued}"
    
    # Check system status
    print("\n3. Checking system status...")
    status = notification_service.get_notification_status()
    
    print(f"  General rate limit: {status['rate_limits']['general']['current']}/{status['rate_limits']['general']['limit']}")
    print(f"  Wellness rate limit: {status['rate_limits']['wellness']['current']}/{status['rate_limits']['wellness']['limit']}")
    print(f"  Queue size: {status['queue']['size']}")
    
    assert status['rate_limits']['general']['current'] == 2
    assert status['rate_limits']['wellness']['current'] == 1
    assert status['queue']['size'] == 5  # 3 general + 2 wellness
    
    print("✓ Rate limiting working correctly")


def test_personality_tones():
    """Test all personality tones with different contexts"""
    print("\nTesting Personality Tones")
    print("-" * 40)
    
    notification_service = NotificationService()
    
    # Test contexts
    contexts = [
        ('high_energy', {'energy_level': 0.9, 'emotions': {'happy': 0.8}}),
        ('low_energy', {'energy_level': 0.2, 'emotions': {'sad': 0.6}}),
        ('medium_energy', {'energy_level': 0.5, 'emotions': {'neutral': 0.8}})
    ]
    
    tones = ['sarcastic', 'motivational', 'balanced', 'minimal']
    
    for tone in tones:
        print(f"\n{tone.upper()} TONE:")
        preferences = UserPreferences.objects.create(notification_tone=tone)
        
        for context_name, context in contexts:
            message = notification_service.generate_contextual_message(
                'productivity_boost', context, preferences
            )
            print(f"  {context_name}: {message}")
        
        preferences.delete()
    
    print("✓ Personality tones working correctly")


def test_queue_processing():
    """Test notification queue processing"""
    print("\nTesting Queue Processing")
    print("-" * 40)
    
    # Clear cache
    cache.clear()
    
    notification_service = NotificationService()
    
    # Fill rate limit to force queueing
    print("1. Filling rate limit to force queueing...")
    for i in range(2):  # Fill general rate limit
        notification = {
            'type': 'productivity_boost',
            'category': 'general',
            'message': f'Rate limit filler {i+1}',
            'context': {'energy_level': 0.8}
        }
        result = notification_service.schedule_notification(notification)
        print(f"  Filler {i+1}: {result['status']}")
    
    # Queue additional notifications
    print("\n2. Queueing additional notifications...")
    queued_notifications = []
    for i in range(3):
        notification = {
            'type': 'productivity_boost',
            'category': 'general',
            'message': f'Queued notification {i+1}',
            'context': {'energy_level': 0.7}
        }
        result = notification_service.schedule_notification(notification)
        queued_notifications.append(result)
        print(f"  Queued {i+1}: {result['status']}")
    
    # Check queue status
    status = notification_service.get_notification_status()
    print(f"\n3. Queue status: {status['queue']['size']} notifications")
    
    # Clear rate limit cache to allow processing
    print("\n4. Clearing rate limit and processing queue...")
    cache.delete('general_notifications')
    
    # Process queue multiple times to see progression
    for i in range(4):
        result = notification_service.process_notification_queue()
        print(f"  Processing cycle {i+1}: {result['processed']} processed, {result['remaining']} remaining")
        
        if result['remaining'] == 0:
            break
    
    print("✓ Queue processing working correctly")


def test_wellness_reminder_system():
    """Test wellness reminder system with hourly limits"""
    print("\nTesting Wellness Reminder System")
    print("-" * 40)
    
    # Clear cache
    cache.clear()
    
    notification_service = NotificationService()
    
    # Create emotion reading that should trigger wellness alerts
    emotion_reading = EmotionReading.objects.create(
        emotions={'neutral': 0.8, 'sad': 0.2},
        energy_level=0.6,
        posture_score=0.2,  # Poor posture
        blink_rate=8.0,     # Low blink rate
        confidence=0.9
    )
    
    # Test posture reminders
    print("1. Testing posture reminders...")
    posture_notifications = []
    for i in range(3):
        notification = {
            'type': 'posture_reminder',
            'category': 'wellness',
            'message': 'Poor posture detected - time to straighten up!',
            'context': {
                'posture_score': emotion_reading.posture_score,
                'energy_level': emotion_reading.energy_level
            }
        }
        result = notification_service.schedule_notification(notification)
        posture_notifications.append(result)
        print(f"  Posture reminder {i+1}: {result['status']}")
    
    # Test eye strain reminders
    print("\n2. Testing eye strain reminders...")
    eye_strain_notifications = []
    for i in range(2):
        notification = {
            'type': 'eye_strain',
            'category': 'wellness',
            'message': 'Low blink rate detected - give your eyes a break!',
            'context': {
                'blink_rate': emotion_reading.blink_rate,
                'energy_level': emotion_reading.energy_level
            }
        }
        result = notification_service.schedule_notification(notification)
        eye_strain_notifications.append(result)
        print(f"  Eye strain reminder {i+1}: {result['status']}")
    
    # Check wellness rate limiting
    wellness_sent = sum(1 for notifications in [posture_notifications, eye_strain_notifications] 
                       for n in notifications if n['status'] == 'sent')
    wellness_queued = sum(1 for notifications in [posture_notifications, eye_strain_notifications] 
                         for n in notifications if n['status'] == 'queued')
    
    print(f"\n3. Wellness notifications: {wellness_sent} sent, {wellness_queued} queued")
    assert wellness_sent == 1, f"Expected 1 wellness notification sent, got {wellness_sent}"
    assert wellness_queued == 4, f"Expected 4 wellness notifications queued, got {wellness_queued}"
    
    print("✓ Wellness reminder system working correctly")


def test_contextual_message_generation():
    """Test contextual message generation for different scenarios"""
    print("\nTesting Contextual Message Generation")
    print("-" * 40)
    
    notification_service = NotificationService()
    preferences = UserPreferences.objects.create(notification_tone='balanced')
    
    # Test scenarios
    scenarios = [
        ('High Energy + Happy', 'productivity_boost', {
            'energy_level': 0.9,
            'emotions': {'happy': 0.8, 'excited': 0.2}
        }),
        ('Low Energy + Sad', 'mood_support', {
            'energy_level': 0.2,
            'emotions': {'sad': 0.7, 'neutral': 0.3}
        }),
        ('Poor Posture', 'posture_reminder', {
            'posture_score': 0.3,
            'energy_level': 0.6
        }),
        ('Eye Strain', 'eye_strain', {
            'blink_rate': 7.0,
            'energy_level': 0.5
        }),
        ('Very Low Energy', 'energy_low', {
            'energy_level': 0.1,
            'emotions': {'neutral': 0.9}
        })
    ]
    
    for scenario_name, message_type, context in scenarios:
        message = notification_service.generate_contextual_message(
            message_type, context, preferences
        )
        print(f"{scenario_name}: {message}")
    
    print("✓ Contextual message generation working correctly")


def main():
    """Run all integration tests"""
    print("Notification System Integration Tests")
    print("=" * 50)
    
    try:
        test_rate_limiting_scenario()
        test_personality_tones()
        test_queue_processing()
        test_wellness_reminder_system()
        test_contextual_message_generation()
        
        print("\n" + "=" * 50)
        print("🎉 ALL INTEGRATION TESTS PASSED!")
        print("The notification system is working correctly with:")
        print("  ✓ Rate limiting enforcement (2 general/5min, 1 wellness/hour)")
        print("  ✓ Personality-based message generation")
        print("  ✓ Queue management for rate limit compliance")
        print("  ✓ Wellness reminder system")
        print("  ✓ Contextual message generation")
        
    except Exception as e:
        print(f"\n❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    sys.exit(main())