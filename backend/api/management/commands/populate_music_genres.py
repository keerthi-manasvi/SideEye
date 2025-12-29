"""
Management command to populate initial music genres with emotional associations
"""
from django.core.management.base import BaseCommand
from api.models import MusicGenre


class Command(BaseCommand):
    help = 'Populate initial music genres with emotional associations'
    
    def handle(self, *args, **options):
        """Create initial music genres"""
        
        genres_data = [
            {
                'name': 'pop',
                'emotional_associations': {
                    'happy': 0.8,
                    'excited': 0.7,
                    'neutral': 0.6
                },
                'typical_energy_range': [0.5, 0.8]
            },
            {
                'name': 'rock',
                'emotional_associations': {
                    'angry': 0.7,
                    'excited': 0.8,
                    'happy': 0.6
                },
                'typical_energy_range': [0.6, 0.9]
            },
            {
                'name': 'electronic',
                'emotional_associations': {
                    'excited': 0.9,
                    'happy': 0.7,
                    'focused': 0.6
                },
                'typical_energy_range': [0.4, 0.9]
            },
            {
                'name': 'classical',
                'emotional_associations': {
                    'calm': 0.8,
                    'focused': 0.9,
                    'sad': 0.5
                },
                'typical_energy_range': [0.2, 0.7]
            },
            {
                'name': 'jazz',
                'emotional_associations': {
                    'calm': 0.7,
                    'focused': 0.8,
                    'nostalgic': 0.6
                },
                'typical_energy_range': [0.3, 0.6]
            },
            {
                'name': 'hip-hop',
                'emotional_associations': {
                    'excited': 0.8,
                    'angry': 0.6,
                    'happy': 0.7
                },
                'typical_energy_range': [0.5, 0.9]
            },
            {
                'name': 'indie',
                'emotional_associations': {
                    'calm': 0.6,
                    'nostalgic': 0.7,
                    'sad': 0.5
                },
                'typical_energy_range': [0.3, 0.7]
            },
            {
                'name': 'folk',
                'emotional_associations': {
                    'calm': 0.8,
                    'nostalgic': 0.8,
                    'sad': 0.6
                },
                'typical_energy_range': [0.2, 0.5]
            },
            {
                'name': 'ambient',
                'emotional_associations': {
                    'calm': 0.9,
                    'focused': 0.8,
                    'neutral': 0.7
                },
                'typical_energy_range': [0.1, 0.4]
            },
            {
                'name': 'instrumental',
                'emotional_associations': {
                    'focused': 0.9,
                    'calm': 0.7,
                    'neutral': 0.8
                },
                'typical_energy_range': [0.2, 0.6]
            },
            {
                'name': 'blues',
                'emotional_associations': {
                    'sad': 0.8,
                    'nostalgic': 0.7,
                    'calm': 0.5
                },
                'typical_energy_range': [0.2, 0.5]
            },
            {
                'name': 'country',
                'emotional_associations': {
                    'nostalgic': 0.8,
                    'happy': 0.6,
                    'sad': 0.5
                },
                'typical_energy_range': [0.3, 0.7]
            },
            {
                'name': 'reggae',
                'emotional_associations': {
                    'calm': 0.8,
                    'happy': 0.7,
                    'neutral': 0.6
                },
                'typical_energy_range': [0.3, 0.6]
            },
            {
                'name': 'metal',
                'emotional_associations': {
                    'angry': 0.9,
                    'excited': 0.8,
                    'focused': 0.6
                },
                'typical_energy_range': [0.7, 1.0]
            },
            {
                'name': 'r&b',
                'emotional_associations': {
                    'calm': 0.6,
                    'happy': 0.7,
                    'nostalgic': 0.5
                },
                'typical_energy_range': [0.4, 0.7]
            }
        ]
        
        created_count = 0
        updated_count = 0
        
        for genre_data in genres_data:
            genre, created = MusicGenre.objects.get_or_create(
                name=genre_data['name'],
                defaults={
                    'emotional_associations': genre_data['emotional_associations'],
                    'typical_energy_range': genre_data['typical_energy_range']
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created genre: {genre.name}')
                )
            else:
                # Update existing genre
                genre.emotional_associations = genre_data['emotional_associations']
                genre.typical_energy_range = genre_data['typical_energy_range']
                genre.save()
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'Updated genre: {genre.name}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully processed {len(genres_data)} genres: '
                f'{created_count} created, {updated_count} updated'
            )
        )