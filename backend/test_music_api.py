#!/usr/bin/env python
"""
Simple test script to verify music recommendation API endpoints
"""
import os
import sys
import django
import json

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sideeye_backend.settings')
django.setup()

from django.test import Client
from django.urls import reverse
from api.models import MusicGenre, YouTubePlaylist, UserPreferences

def test_music_api():
    """Test music recommendation API endpoints"""
    
    client = Client()
    
    print("Testing Music Recommendation API...")
    print("=" * 50)
    
    # Test 1: Get available genres
    print("\n1. Testing genres endpoint...")
    response = client.get('/api/music/playlists/genres/')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Found {data['total_genres']} genres")
        for genre in data['genres'][:3]:  # Show first 3
            print(f"  - {genre['name']}: {genre['playlist_count']} playlists")
    
    # Test 2: Create a test playlist
    print("\n2. Creating test playlist...")
    pop_genre = MusicGenre.objects.filter(name='pop').first()
    if pop_genre:
        playlist, created = YouTubePlaylist.objects.get_or_create(
            youtube_id='PLtest_api_123',
            defaults={
                'title': 'Test API Playlist',
                'description': 'Test playlist for API verification',
                'channel_title': 'Test Channel',
                'energy_level': 0.7,
                'emotional_tags': ['happy', 'excited'],
                'acceptance_rate': 0.8,
                'user_rating': 4.5
            }
        )
        if created:
            playlist.genres.add(pop_genre)
            print(f"Created playlist: {playlist.title}")
        else:
            print(f"Using existing playlist: {playlist.title}")
    
    # Test 3: Get music recommendations
    print("\n3. Testing music recommendations...")
    recommendation_data = {
        'emotions': {'happy': 0.8, 'neutral': 0.2},
        'energy_level': 0.7,
        'max_recommendations': 3
    }
    
    response = client.post(
        '/api/music/recommendations/get_recommendations/',
        data=json.dumps(recommendation_data),
        content_type='application/json'
    )
    
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        recommendations = data['recommendations']
        print(f"Got {len(recommendations)} recommendations")
        
        for i, rec in enumerate(recommendations, 1):
            print(f"  {i}. {rec['title']} (confidence: {rec['confidence_score']:.2f})")
        
        # Test 4: Submit feedback for first recommendation
        if recommendations:
            print("\n4. Testing feedback submission...")
            feedback_data = {
                'recommendation_id': recommendations[0]['recommendation_id'],
                'response': 'accepted'
            }
            
            response = client.post(
                '/api/music/recommendations/feedback/',
                data=json.dumps(feedback_data),
                content_type='application/json'
            )
            
            print(f"Feedback status: {response.status_code}")
            if response.status_code == 200:
                print("Feedback recorded successfully")
    
    # Test 5: Get music statistics
    print("\n5. Testing music statistics...")
    response = client.get('/api/music/recommendations/stats/')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Total recommendations: {data.get('total_recommendations', 0)}")
        print(f"Acceptance rate: {data.get('acceptance_rate', 0)}%")
    
    # Test 6: List playlists
    print("\n6. Testing playlist listing...")
    response = client.get('/api/music/playlists/')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        playlists = response.json()
        print(f"Found {len(playlists)} playlists")
        for playlist in playlists[:3]:  # Show first 3
            print(f"  - {playlist['title']} (energy: {playlist['energy_level']})")
    
    # Test 7: Rate a playlist
    print("\n7. Testing playlist rating...")
    test_playlist = YouTubePlaylist.objects.filter(youtube_id='PLtest_api_123').first()
    if test_playlist:
        rating_data = {'rating': 4.8}
        
        response = client.post(
            f'/api/music/playlists/{test_playlist.pk}/rate/',
            data=json.dumps(rating_data),
            content_type='application/json'
        )
        
        print(f"Rating status: {response.status_code}")
        if response.status_code == 200:
            print("Playlist rated successfully")
    
    print("\n" + "=" * 50)
    print("Music API testing completed!")

if __name__ == '__main__':
    test_music_api()