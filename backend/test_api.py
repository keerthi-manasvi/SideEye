#!/usr/bin/env python
"""
Quick API test script for task management endpoints
"""
import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_task_creation():
    """Test task creation endpoint"""
    url = f"{BASE_URL}/tasks/"
    data = {
        "title": "API Test Task",
        "description": "Testing task creation via API",
        "complexity": "complex",
        "priority": "high",
        "estimated_duration": 90
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"Task Creation - Status: {response.status_code}")
        if response.status_code == 201:
            task = response.json()
            print(f"Created task: {task['title']}")
            print(f"Complexity score: {task['complexity_score']}")
            print(f"Optimal energy level: {task['optimal_energy_level']}")
            return task['id']
        else:
            print(f"Error: {response.text}")
            return None
    except Exception as e:
        print(f"Error testing task creation: {e}")
        return None

def test_task_sorting():
    """Test energy-based task sorting"""
    url = f"{BASE_URL}/tasks/sort_by_energy/"
    data = {
        "current_energy_level": 0.8,
        "sort_method": "energy_match",
        "include_completed": False
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"\nTask Sorting - Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Sorted {result['total_count']} tasks by energy match")
            for i, task in enumerate(result['tasks'][:3]):  # Show top 3
                print(f"  {i+1}. {task['title']} (score: {task['energy_match_score']:.3f})")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing task sorting: {e}")

def test_task_recommendations():
    """Test task recommendations"""
    url = f"{BASE_URL}/tasks/recommend/"
    data = {
        "current_energy_level": 0.7,
        "max_tasks": 3,
        "include_completed": False
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"\nTask Recommendations - Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Generated {len(result['recommendations'])} recommendations")
            for i, rec in enumerate(result['recommendations']):
                print(f"  {i+1}. {rec['title']}")
                print(f"     Score: {rec['recommendation_score']:.3f}")
                print(f"     Reason: {rec['recommendation_reason']}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing task recommendations: {e}")

def test_task_analytics():
    """Test task analytics"""
    url = f"{BASE_URL}/tasks/analytics/"
    
    try:
        response = requests.get(url)
        print(f"\nTask Analytics - Status: {response.status_code}")
        if response.status_code == 200:
            analytics = response.json()
            overview = analytics['overview']
            print(f"Total tasks: {overview['total_tasks']}")
            print(f"Completed tasks: {overview['completed_tasks']}")
            print(f"Completion rate: {overview['completion_rate']}%")
            
            print("\nComplexity Analysis:")
            for complexity, stats in analytics['complexity_analysis'].items():
                print(f"  {complexity}: {stats['completed']}/{stats['total']} ({stats['completion_rate']:.1f}%)")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing task analytics: {e}")

if __name__ == "__main__":
    print("Testing Task Management API Endpoints")
    print("=" * 40)
    
    # Test task creation
    task_id = test_task_creation()
    
    # Test sorting
    test_task_sorting()
    
    # Test recommendations
    test_task_recommendations()
    
    # Test analytics
    test_task_analytics()
    
    print("\n" + "=" * 40)
    print("API testing completed!")