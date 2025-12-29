#!/usr/bin/env python
"""
Integration test for task management system
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sideeye_backend.settings')
django.setup()

from api.models import Task
from api.services.task_service import TaskService
from api.serializers import TaskSerializer

def test_task_model_functionality():
    """Test Task model core functionality"""
    print("Testing Task Model Functionality")
    print("-" * 30)
    
    # Clear existing tasks
    Task.objects.all().delete()
    
    # Create tasks with different complexities
    simple_task = Task.objects.create(
        title="Simple Task",
        description="A simple administrative task",
        complexity="simple",
        priority="low"
    )
    
    moderate_task = Task.objects.create(
        title="Moderate Task", 
        description="A moderate complexity task",
        complexity="moderate",
        priority="medium"
    )
    
    complex_task = Task.objects.create(
        title="Complex Task",
        description="A complex analytical task",
        complexity="complex",
        priority="high"
    )
    
    creative_task = Task.objects.create(
        title="Creative Task",
        description="A creative design task",
        complexity="creative",
        priority="urgent"
    )
    
    print(f"Created {Task.objects.count()} tasks")
    
    # Test complexity score calculation
    print(f"Simple task complexity score: {simple_task.complexity_score:.3f}")
    print(f"Moderate task complexity score: {moderate_task.complexity_score:.3f}")
    print(f"Complex task complexity score: {complex_task.complexity_score:.3f}")
    print(f"Creative task complexity score: {creative_task.complexity_score:.3f}")
    
    # Test optimal energy level setting
    print(f"Simple task optimal energy: {simple_task.optimal_energy_level:.3f}")
    print(f"Complex task optimal energy: {complex_task.optimal_energy_level:.3f}")
    
    # Test energy match scoring
    high_energy = 0.9
    low_energy = 0.2
    
    print(f"\nEnergy Match Scores for High Energy ({high_energy}):")
    print(f"  Simple task: {simple_task.get_energy_match_score(high_energy):.3f}")
    print(f"  Complex task: {complex_task.get_energy_match_score(high_energy):.3f}")
    
    print(f"\nEnergy Match Scores for Low Energy ({low_energy}):")
    print(f"  Simple task: {simple_task.get_energy_match_score(low_energy):.3f}")
    print(f"  Complex task: {complex_task.get_energy_match_score(low_energy):.3f}")
    
    return [simple_task, moderate_task, complex_task, creative_task]

def test_task_service_functionality(tasks):
    """Test TaskService functionality"""
    print("\n\nTesting Task Service Functionality")
    print("-" * 35)
    
    service = TaskService()
    
    # Test energy-based sorting for high energy
    print("High Energy Sorting (0.9):")
    high_energy_tasks = service.get_energy_sorted_tasks(0.9)
    for i, task in enumerate(high_energy_tasks):
        energy_score = task.get_energy_match_score(0.9)
        print(f"  {i+1}. {task.title} (score: {energy_score:.3f})")
    
    # Test energy-based sorting for low energy
    print("\nLow Energy Sorting (0.2):")
    low_energy_tasks = service.get_energy_sorted_tasks(0.2)
    for i, task in enumerate(low_energy_tasks):
        energy_score = task.get_energy_match_score(0.2)
        print(f"  {i+1}. {task.title} (score: {energy_score:.3f})")
    
    # Test task recommendations
    print("\nTask Recommendations for Medium Energy (0.6):")
    recommendations = service.get_task_recommendations(
        current_energy_level=0.6,
        max_recommendations=3
    )
    
    for i, rec in enumerate(recommendations):
        print(f"  {i+1}. {rec['task'].title}")
        print(f"     Recommendation Score: {rec['recommendation_score']:.3f}")
        print(f"     Explanation: {rec['explanation']}")
    
    # Test task completion and learning
    print("\nTesting Task Learning:")
    learning_task = tasks[1]  # moderate task
    print(f"Initial correlation: {learning_task.user_energy_correlation:.3f}")
    
    # Simulate completing task at different energy levels
    learning_task.update_energy_correlation(0.7)
    learning_task.update_energy_correlation(0.8)
    learning_task.update_energy_correlation(0.6)
    
    print(f"After 3 completions: {learning_task.user_energy_correlation:.3f}")
    print(f"Completion energy levels: {learning_task.completion_energy_levels}")
    
    return service

def test_task_serialization():
    """Test task serialization"""
    print("\n\nTesting Task Serialization")
    print("-" * 27)
    
    task = Task.objects.first()
    serializer = TaskSerializer(task)
    
    print("Serialized task fields:")
    for field, value in serializer.data.items():
        if field not in ['description']:  # Skip long description
            print(f"  {field}: {value}")

def test_task_analytics():
    """Test task analytics"""
    print("\n\nTesting Task Analytics")
    print("-" * 22)
    
    service = TaskService()
    
    # Mark some tasks as completed
    tasks = Task.objects.all()[:2]
    for task in tasks:
        task.status = 'completed'
        task.actual_duration = 45
        task.save()
    
    # Generate analytics
    analytics = service.analyze_task_patterns(days=30)
    
    print("Task Analytics Overview:")
    overview = analytics['overview']
    print(f"  Total tasks: {overview['total_tasks']}")
    print(f"  Completed tasks: {overview['completed_tasks']}")
    print(f"  Completion rate: {overview['completion_rate']:.1f}%")
    
    print("\nComplexity Performance:")
    for complexity, stats in analytics['complexity_performance'].items():
        if stats['completed_count'] > 0:
            print(f"  {complexity}: {stats['completed_count']} completed")
            if stats['average_duration_minutes']:
                print(f"    Avg duration: {stats['average_duration_minutes']:.1f} min")

def main():
    """Run all tests"""
    print("Task Management System Integration Test")
    print("=" * 45)
    
    try:
        # Test model functionality
        tasks = test_task_model_functionality()
        
        # Test service functionality
        service = test_task_service_functionality(tasks)
        
        # Test serialization
        test_task_serialization()
        
        # Test analytics
        test_task_analytics()
        
        print("\n" + "=" * 45)
        print("✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()