#!/usr/bin/env python
"""
Test script for notification API endpoints

This script tests the notification service API endpoints to ensure they work correctly.
"""

import os
import sys
import django
import requests
import json
from datetime import datetime

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sideeye_backend.settings')
django.setup()

from django.test import Client
from django.urls import reverse
from api.models import UserPreferences


def test_notification_api():
    """Test notification API endpoints"""
    client = Client()
    
    print("Testing Notification API Endpoints")
    print("=" * 50)
    
    # Create user preferences for testing
    preferences = UserPreferences.objects.create(
        notification_frequency=5,
        wellness_reminder_interval=60,
        notification_tone='sarcastic'
    )
    
    # Test 1: Get notification status
    print("\n1. Testing notification status endpoint...")
    response = client.get('/api/notifications/status/')
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Rate Limits: {data.get('rate_limits', {})}")
        print(f"Queue Size: {data.get('queue', {}).get('size', 0)}")
        print("✓ Status endpoint working")
    else:
        print(f"✗ Status endpoint failed: {response.content}")
    
    # Test 2: Generate contextual message
    print("\n2. Testing message generation endpoint...")
    message_data = {
        'message_type': 'productivity_boost',
        'context': {
            'energy_level': 0.8,
            'emotions': {'happy': 0.7, 'neutral': 0.3}
        }
    }
    response = client.post('/api/notifications/generate_message/', 
                          data=json.dumps(message_data),
                          content_type='application/json')
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Generated Message: {data.get('generated_message')}")
        print("✓ Message generation working")
    else:
        print(f"✗ Message generation failed: {response.content}")
    
    # Test 3: Test different message types
    print("\n3. Testing different message types...")
    message_types = [
        ('mood_support', {'energy_level': 0.2, 'emotions': {'sad': 0.6}}),
        ('posture_reminder', {'posture_score': 0.3}),
        ('eye_strain', {'blink_rate': 8.0}),
        ('energy_low', {'energy_level': 0.1})
    ]
    
    for msg_type, context in message_types:
        message_data = {
            'message_type': msg_type,
            'context': context
        }
        response = client.post('/api/notifications/generate_message/', 
                              data=json.dumps(message_data),
                              content_type='application/json')
        if response.status_code == 200:
            data = response.json()
            print(f"  {msg_type}: {data.get('generated_message')}")
        else:
            print(f"  ✗ {msg_type} failed")
    
    # Test 4: Test different personality tones
    print("\n4. Testing personality tones...")
    tones = ['sarcastic', 'motivational', 'balanced', 'minimal']
    
    for tone in tones:
        preferences.notification_tone = tone
        preferences.save()
        
        message_data = {
            'message_type': 'productivity_boost',
            'context': {'energy_level': 0.8}
        }
        response = client.post('/api/notifications/generate_message/', 
                              data=json.dumps(message_data),
                              content_type='application/json')
        if response.status_code == 200:
            data = response.json()
            print(f"  {tone}: {data.get('generated_message')}")
        else:
            print(f"  ✗ {tone} failed")
    
    # Test 5: Process notification queue
    print("\n5. Testing notification queue processing...")
    response = client.post('/api/notifications/process_queue/')
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Processed: {data.get('processed', 0)}")
        print(f"Remaining: {data.get('remaining', 0)}")
        print("✓ Queue processing working")
    else:
        print(f"✗ Queue processing failed: {response.content}")
    
    # Test 6: Test emotion analysis integration
    print("\n6. Testing emotion analysis integration...")
    emotion_data = {
        'emotions': {'happy': 0.8, 'neutral': 0.2},
        'energy_level': 0.9,
        'posture_score': 0.7,
        'blink_rate': 12.0,
        'confidence': 0.95
    }
    response = client.post('/api/emotions/analyze/', 
                          data=json.dumps(emotion_data),
                          content_type='application/json')
    print(f"Status Code: {response.status_code}")
    if response.status_code == 201:
        data = response.json()
        notifications = data.get('notifications', {})
        print(f"Notifications Triggered: {notifications.get('triggered', False)}")
        print(f"Notification Count: {notifications.get('count', 0)}")
        if notifications.get('scheduled'):
            for i, notif in enumerate(notifications['scheduled']):
                print(f"  Notification {i+1}: {notif.get('status', 'unknown')}")
        print("✓ Emotion analysis integration working")
    else:
        print(f"✗ Emotion analysis integration failed: {response.content}")
    
    print("\n" + "=" * 50)
    print("Notification API testing completed!")


if __name__ == '__main__':
    test_notification_api()