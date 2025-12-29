# Music Recommendation System Integration

This document describes the YouTube playlist integration and music recommendation system implemented for the SideEye workspace application.

## Overview

The music recommendation system provides emotion-based playlist suggestions using YouTube Data API v3 integration. It learns from user feedback to improve recommendations over time and supports offline fallback mechanisms.

## Features

### Core Functionality

- **Emotion-based Recommendations**: Suggests playlists based on detected emotions and energy levels
- **User Preference Learning**: Adapts to user feedback and preferences over time
- **Genre Management**: Supports multiple music genres with emotional associations
- **Playlist Caching**: Caches playlist data to reduce API calls
- **Offline Fallback**: Works without internet connection using cached data

### API Endpoints

#### Music Recommendations

- `POST /api/music/recommendations/get_recommendations/` - Get music recommendations
- `POST /api/music/recommendations/feedback/` - Submit user feedback
- `GET /api/music/recommendations/stats/` - Get recommendation statistics
- `POST /api/music/recommendations/discover_playlists/` - Discover new playlists

#### Playlist Management

- `GET /api/music/playlists/` - List cached playlists
- `POST /api/music/playlists/{id}/rate/` - Rate a playlist
- `POST /api/music/playlists/{id}/validate/` - Validate playlist exists on YouTube
- `GET /api/music/playlists/genres/` - Get available music genres

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. YouTube API Configuration (Optional)

To enable YouTube playlist discovery, set up a YouTube Data API v3 key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create credentials (API Key)
5. Set the API key in your environment:
   ```bash
   export YOUTUBE_API_KEY=your_api_key_here
   ```

**Note**: The system works without YouTube API key using cached playlists only.

### 3. Database Setup

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py populate_music_genres
```

## Usage Examples

### Getting Music Recommendations

```python
import requests

# Request recommendations
response = requests.post('http://localhost:8000/api/music/recommendations/get_recommendations/', json={
    'emotions': {'happy': 0.8, 'neutral': 0.2},
    'energy_level': 0.7,
    'max_recommendations': 5
})

recommendations = response.json()['recommendations']
for rec in recommendations:
    print(f"Playlist: {rec['title']} (Confidence: {rec['confidence_score']:.2f})")
```

### Submitting Feedback

```python
# Submit positive feedback
requests.post('http://localhost:8000/api/music/recommendations/feedback/', json={
    'recommendation_id': 123,
    'response': 'accepted'
})

# Submit negative feedback with alternative
requests.post('http://localhost:8000/api/music/recommendations/feedback/', json={
    'recommendation_id': 124,
    'response': 'rejected',
    'alternative_choice': {
        'genre': 'ambient',
        'energy_level': 0.3,
        'reason': 'Prefer more calming music'
    }
})
```

### Discovering New Playlists

```python
# Discover playlists by emotion
response = requests.post('http://localhost:8000/api/music/recommendations/discover_playlists/', json={
    'search_type': 'emotion',
    'query': 'happy',
    'energy_level': 0.8,
    'max_results': 10
})

# Discover playlists by genre
response = requests.post('http://localhost:8000/api/music/recommendations/discover_playlists/', json={
    'search_type': 'genre',
    'query': 'classical',
    'max_results': 10
})
```

## Data Models

### MusicGenre

Stores music genres with emotional associations:

```python
{
    'name': 'pop',
    'emotional_associations': {'happy': 0.8, 'excited': 0.7},
    'typical_energy_range': [0.5, 0.8]
}
```

### YouTubePlaylist

Cached playlist information:

```python
{
    'youtube_id': 'PLxxx',
    'title': 'Happy Pop Songs',
    'energy_level': 0.7,
    'emotional_tags': ['happy', 'excited'],
    'acceptance_rate': 0.85,
    'user_rating': 4.5
}
```

### MusicRecommendation

Tracks recommendation history and feedback:

```python
{
    'emotion_context': {'emotions': {'happy': 0.8}, 'energy_level': 0.7},
    'recommended_playlist': playlist_object,
    'confidence_score': 0.85,
    'user_response': 'accepted'
}
```

## Algorithm Details

### Recommendation Scoring

Playlists are scored based on multiple factors:

- **Emotion Match (40%)**: How well playlist emotions match detected emotions
- **Energy Level Match (30%)**: Similarity between playlist and user energy levels
- **User Acceptance Rate (20%)**: Historical user acceptance of this playlist
- **User Rating (10%)**: Explicit user rating of the playlist

### Learning System

The system learns from user feedback by:

1. Updating playlist acceptance rates based on user responses
2. Adjusting user preferences when alternatives are provided
3. Tracking energy-emotion correlations for better future recommendations
4. Penalizing recently recommended playlists to avoid repetition

### Fallback Mechanisms

- **No YouTube API**: Uses cached playlists only
- **No Internet**: Works with local database
- **No Matching Playlists**: Returns empty results gracefully
- **API Errors**: Logs errors and continues with cached data

## Testing

### Run Integration Tests

```bash
python manage.py test api.tests.test_music_integration --verbosity=2
```

### Manual API Testing

```bash
python test_music_api.py
```

## Performance Considerations

### Caching Strategy

- Playlist data cached for 1 hour by default
- Batch validation of playlists to reduce API calls
- Intelligent discovery only when needed

### Rate Limiting

- Respects YouTube API quotas
- Implements exponential backoff for failed requests
- Batches multiple operations when possible

### Database Optimization

- Indexed fields for fast queries
- Efficient playlist matching algorithms
- Cleanup of old recommendation records

## Troubleshooting

### Common Issues

1. **YouTube API Key Not Found**

   - System works without API key using cached data
   - Set `YOUTUBE_API_KEY` environment variable for full functionality

2. **No Recommendations Returned**

   - Check if playlists exist in database
   - Run `python manage.py populate_music_genres`
   - Verify emotion data format

3. **API Errors**
   - Check Django logs for detailed error messages
   - Verify API endpoints are correctly configured
   - Ensure database migrations are applied

### Debug Mode

Enable debug logging by setting:

```python
LOGGING = {
    'loggers': {
        'api.services.music_recommendation_service': {
            'level': 'DEBUG',
        }
    }
}
```

## Future Enhancements

### Planned Features

- Spotify integration as alternative to YouTube
- Machine learning-based recommendation improvements
- User playlist creation and management
- Social features (sharing recommendations)
- Advanced filtering options

### Scalability Improvements

- Redis caching for better performance
- Celery background tasks for playlist discovery
- Database sharding for large user bases
- CDN integration for playlist metadata

## API Reference

For detailed API documentation, see the Django REST Framework browsable API at:
`http://localhost:8000/api/`

All endpoints support standard HTTP methods and return JSON responses with appropriate status codes.
