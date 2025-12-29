"""
YouTube API service for playlist discovery and management
"""
import os
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache

from ..models import YouTubePlaylist, MusicGenre

logger = logging.getLogger(__name__)


class YouTubeService:
    """
    Service for interacting with YouTube Data API v3
    """
    
    def __init__(self):
        self.api_key = getattr(settings, 'YOUTUBE_API_KEY', os.getenv('YOUTUBE_API_KEY'))
        self.youtube = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize YouTube API client"""
        if not self.api_key:
            logger.warning("YouTube API key not found. YouTube integration will be disabled.")
            return
        
        try:
            self.youtube = build('youtube', 'v3', developerKey=self.api_key)
            logger.info("YouTube API client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize YouTube API client: {e}")
            self.youtube = None
    
    def is_available(self) -> bool:
        """Check if YouTube API is available"""
        return self.youtube is not None
    
    def search_playlists(self, query: str, max_results: int = 25) -> List[Dict]:
        """
        Search for playlists on YouTube
        
        Args:
            query: Search query string
            max_results: Maximum number of results to return
            
        Returns:
            List of playlist dictionaries
        """
        if not self.is_available():
            logger.warning("YouTube API not available for playlist search")
            return []
        
        try:
            # Search for playlists
            search_response = self.youtube.search().list(
                q=query,
                part='snippet',
                type='playlist',
                maxResults=max_results,
                order='relevance'
            ).execute()
            
            playlists = []
            for item in search_response.get('items', []):
                playlist_data = {
                    'youtube_id': item['id']['playlistId'],
                    'title': item['snippet']['title'],
                    'description': item['snippet']['description'],
                    'channel_title': item['snippet']['channelTitle'],
                    'published_at': item['snippet']['publishedAt']
                }
                playlists.append(playlist_data)
            
            logger.info(f"Found {len(playlists)} playlists for query: {query}")
            return playlists
            
        except HttpError as e:
            logger.error(f"YouTube API error during playlist search: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error during playlist search: {e}")
            return []
    
    def get_playlist_details(self, playlist_id: str) -> Optional[Dict]:
        """
        Get detailed information about a specific playlist
        
        Args:
            playlist_id: YouTube playlist ID
            
        Returns:
            Playlist details dictionary or None if not found
        """
        if not self.is_available():
            return None
        
        try:
            # Get playlist details
            playlist_response = self.youtube.playlists().list(
                part='snippet,contentDetails',
                id=playlist_id
            ).execute()
            
            if not playlist_response.get('items'):
                logger.warning(f"Playlist not found: {playlist_id}")
                return None
            
            playlist_item = playlist_response['items'][0]
            
            playlist_data = {
                'youtube_id': playlist_item['id'],
                'title': playlist_item['snippet']['title'],
                'description': playlist_item['snippet']['description'],
                'channel_title': playlist_item['snippet']['channelTitle'],
                'video_count': playlist_item['contentDetails']['itemCount'],
                'published_at': playlist_item['snippet']['publishedAt']
            }
            
            return playlist_data
            
        except HttpError as e:
            logger.error(f"YouTube API error getting playlist details: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting playlist details: {e}")
            return None
    
    def get_playlist_videos(self, playlist_id: str, max_results: int = 50) -> List[Dict]:
        """
        Get videos from a playlist
        
        Args:
            playlist_id: YouTube playlist ID
            max_results: Maximum number of videos to return
            
        Returns:
            List of video dictionaries
        """
        if not self.is_available():
            return []
        
        try:
            videos = []
            next_page_token = None
            
            while len(videos) < max_results:
                # Get playlist items
                request = self.youtube.playlistItems().list(
                    part='snippet',
                    playlistId=playlist_id,
                    maxResults=min(50, max_results - len(videos)),
                    pageToken=next_page_token
                )
                
                response = request.execute()
                
                for item in response.get('items', []):
                    video_data = {
                        'video_id': item['snippet']['resourceId']['videoId'],
                        'title': item['snippet']['title'],
                        'description': item['snippet']['description'],
                        'position': item['snippet']['position']
                    }
                    videos.append(video_data)
                
                next_page_token = response.get('nextPageToken')
                if not next_page_token:
                    break
            
            return videos
            
        except HttpError as e:
            logger.error(f"YouTube API error getting playlist videos: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting playlist videos: {e}")
            return []
    
    def discover_playlists_by_genre(self, genre: str, max_results: int = 20) -> List[Dict]:
        """
        Discover playlists for a specific music genre
        
        Args:
            genre: Music genre name
            max_results: Maximum number of playlists to return
            
        Returns:
            List of playlist dictionaries
        """
        # Create search queries for the genre
        search_queries = [
            f"{genre} music playlist",
            f"best {genre} songs",
            f"{genre} hits playlist",
            f"{genre} music mix"
        ]
        
        all_playlists = []
        results_per_query = max_results // len(search_queries)
        
        for query in search_queries:
            playlists = self.search_playlists(query, results_per_query)
            all_playlists.extend(playlists)
            
            if len(all_playlists) >= max_results:
                break
        
        # Remove duplicates based on playlist ID
        unique_playlists = {}
        for playlist in all_playlists:
            playlist_id = playlist['youtube_id']
            if playlist_id not in unique_playlists:
                unique_playlists[playlist_id] = playlist
        
        return list(unique_playlists.values())[:max_results]
    
    def discover_playlists_by_emotion(self, emotion: str, energy_level: float = 0.5, max_results: int = 15) -> List[Dict]:
        """
        Discover playlists based on emotional state and energy level
        
        Args:
            emotion: Primary emotion (happy, sad, angry, etc.)
            energy_level: Energy level from 0.0 to 1.0
            max_results: Maximum number of playlists to return
            
        Returns:
            List of playlist dictionaries
        """
        # Map emotions to search terms
        emotion_queries = {
            'happy': ['upbeat music', 'happy songs', 'feel good music', 'positive vibes'],
            'sad': ['sad songs', 'melancholy music', 'emotional ballads', 'heartbreak songs'],
            'angry': ['aggressive music', 'intense songs', 'powerful music', 'energetic rock'],
            'calm': ['relaxing music', 'chill songs', 'ambient music', 'peaceful sounds'],
            'excited': ['party music', 'dance songs', 'high energy music', 'pump up songs'],
            'focused': ['focus music', 'concentration songs', 'study music', 'instrumental'],
            'nostalgic': ['throwback songs', 'classic hits', 'nostalgic music', 'retro playlist']
        }
        
        # Adjust queries based on energy level
        if energy_level > 0.7:
            energy_terms = ['high energy', 'upbeat', 'energetic', 'pump up']
        elif energy_level < 0.3:
            energy_terms = ['chill', 'relaxing', 'calm', 'mellow']
        else:
            energy_terms = ['moderate', 'balanced', 'steady']
        
        # Get base queries for emotion
        base_queries = emotion_queries.get(emotion, ['music playlist'])
        
        # Combine with energy terms
        search_queries = []
        for base_query in base_queries[:2]:  # Limit to 2 base queries
            for energy_term in energy_terms[:2]:  # Limit to 2 energy terms
                search_queries.append(f"{energy_term} {base_query}")
        
        # Add some direct emotion queries
        search_queries.extend(base_queries[:2])
        
        all_playlists = []
        results_per_query = max(1, max_results // len(search_queries))
        
        for query in search_queries:
            playlists = self.search_playlists(query, results_per_query)
            all_playlists.extend(playlists)
            
            if len(all_playlists) >= max_results:
                break
        
        # Remove duplicates and return
        unique_playlists = {}
        for playlist in all_playlists:
            playlist_id = playlist['youtube_id']
            if playlist_id not in unique_playlists:
                unique_playlists[playlist_id] = playlist
        
        return list(unique_playlists.values())[:max_results]
    
    def cache_playlist_data(self, playlist_id: str, cache_duration: int = 3600) -> bool:
        """
        Cache playlist data to reduce API calls
        
        Args:
            playlist_id: YouTube playlist ID
            cache_duration: Cache duration in seconds
            
        Returns:
            True if caching was successful
        """
        cache_key = f"youtube_playlist_{playlist_id}"
        
        # Check if already cached
        if cache.get(cache_key):
            return True
        
        # Get fresh data from API
        playlist_data = self.get_playlist_details(playlist_id)
        if playlist_data:
            cache.set(cache_key, playlist_data, cache_duration)
            return True
        
        return False
    
    def get_cached_playlist_data(self, playlist_id: str) -> Optional[Dict]:
        """
        Get playlist data from cache
        
        Args:
            playlist_id: YouTube playlist ID
            
        Returns:
            Cached playlist data or None
        """
        cache_key = f"youtube_playlist_{playlist_id}"
        return cache.get(cache_key)
    
    def validate_playlist_exists(self, playlist_id: str) -> bool:
        """
        Validate that a playlist still exists on YouTube
        
        Args:
            playlist_id: YouTube playlist ID
            
        Returns:
            True if playlist exists and is accessible
        """
        playlist_data = self.get_playlist_details(playlist_id)
        return playlist_data is not None
    
    def batch_validate_playlists(self, playlist_ids: List[str]) -> Dict[str, bool]:
        """
        Validate multiple playlists in batch
        
        Args:
            playlist_ids: List of YouTube playlist IDs
            
        Returns:
            Dictionary mapping playlist IDs to their validity status
        """
        if not self.is_available():
            return {pid: False for pid in playlist_ids}
        
        results = {}
        
        # Process in batches of 50 (YouTube API limit)
        batch_size = 50
        for i in range(0, len(playlist_ids), batch_size):
            batch = playlist_ids[i:i + batch_size]
            
            try:
                # Get playlist details for batch
                response = self.youtube.playlists().list(
                    part='id',
                    id=','.join(batch)
                ).execute()
                
                # Mark found playlists as valid
                found_ids = {item['id'] for item in response.get('items', [])}
                
                for playlist_id in batch:
                    results[playlist_id] = playlist_id in found_ids
                    
            except HttpError as e:
                logger.error(f"YouTube API error during batch validation: {e}")
                # Mark all in this batch as invalid
                for playlist_id in batch:
                    results[playlist_id] = False
            except Exception as e:
                logger.error(f"Unexpected error during batch validation: {e}")
                for playlist_id in batch:
                    results[playlist_id] = False
        
        return results


# Global instance
youtube_service = YouTubeService()